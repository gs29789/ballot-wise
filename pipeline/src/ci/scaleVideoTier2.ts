import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RACES } from "../build.js";
import { searchCampaignVideo } from "../sources/campaignVideoSearch.js";

// Runs Tier 2 (search-based) video discovery for candidates Tier 1 didn't
// find one for, paced to stay under YouTube's 10,000-unit/day free quota:
// search.list costs 100 units/call, so DAILY_BUDGET=90 caps this run at
// 9,000 units, leaving headroom for Tier 1's own (much cheaper) ongoing
// usage. Meant to run once a day (see the scheduling note in the commit/
// memory this shipped with) — each run picks up wherever the backlog left
// off rather than needing to be told which candidates to cover.

const BUILD_ROOT = join(import.meta.dirname, "..", "..", "build");
const DAILY_BUDGET = 90;
const REFRESH_DAYS = 30; // shorter than bio's 90-day base — a campaign's YouTube presence is far more time-sensitive mid-cycle than a static bio fact

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

function isDueForTier2Search(attemptedAt: string | null | undefined): boolean {
  if (!attemptedAt) return true;
  const days = (Date.now() - new Date(attemptedAt).getTime()) / 86_400_000;
  return days >= REFRESH_DAYS;
}

interface EligibleEntry {
  outFile: string;
  state: string;
  office: "H" | "S";
  candidate: any;
}

function collectEligible(dataByFile: Map<string, any>): EligibleEntry[] {
  const eligible: EligibleEntry[] = [];
  for (const opts of RACES) {
    const localPath = join(BUILD_ROOT, opts.outFile);
    if (!existsSync(localPath)) continue;
    const data = JSON.parse(readFileSync(localPath, "utf-8"));
    if (!Array.isArray(data.candidates)) continue;
    dataByFile.set(opts.outFile, data);
    for (const candidate of data.candidates) {
      if (candidate.platform_video_url) continue; // Tier 1 already has one
      if (!isDueForTier2Search(candidate._tier2_search_attempted_at)) continue;
      eligible.push({ outFile: opts.outFile, state: opts.state, office: opts.office, candidate });
    }
  }
  // Never-attempted candidates first — clearing the initial backlog with a
  // real shot at a fresh discovery matters more than an early recheck of
  // someone already confirmed absent.
  eligible.sort((a, b) => {
    const aNever = !a.candidate._tier2_search_attempted_at;
    const bNever = !b.candidate._tier2_search_attempted_at;
    return aNever === bNever ? 0 : aNever ? -1 : 1;
  });
  return eligible;
}

async function main() {
  const dataByFile = new Map<string, any>();
  const eligible = collectEligible(dataByFile);
  const batch = eligible.slice(0, DAILY_BUDGET);
  console.log(`${eligible.length} candidates eligible for Tier 2 search, processing ${batch.length} this run.`);

  const touchedFiles = new Set<string>();
  let found = 0;
  let searched = 0;
  let consecutiveErrors = 0;

  for (const entry of batch) {
    const { candidate, state, office, outFile } = entry;
    const stateName = STATE_NAMES[state] ?? state;
    let result: Awaited<ReturnType<typeof searchCampaignVideo>> = null;
    let errored = false;
    try {
      result = await searchCampaignVideo(candidate.full_name, office, stateName);
      consecutiveErrors = 0;
    } catch (err: any) {
      errored = true;
      consecutiveErrors++;
      console.warn(`[scaleVideoTier2] search failed for ${candidate.full_name}: ${err?.message ?? err}`);
    }

    // Only a genuine, completed search (found something, or found nothing
    // that passed the trust check) counts as "attempted" — an API failure
    // (quota, network) isn't a real answer and must not push this
    // candidate into the 30-day recheck cycle before it was ever actually
    // checked. See the throw in searchCampaignVideo for the incident that
    // made this necessary: a same-day third test run silently would have
    // deferred 90 never-actually-searched candidates for a month.
    if (!errored) {
      candidate._tier2_search_attempted_at = new Date().toISOString();
      searched++;
    }
    if (result) {
      candidate.platform_video_url = result.videoUrl;
      candidate.platform_video_title = result.videoTitle;
      // No campaign-site page to cite — this came from a YouTube search,
      // not a link on the candidate's own site. platform_video_tier lets
      // the frontend show that distinction honestly instead of reusing
      // Tier 1's "linked from the candidate's own campaign site" citation
      // for a fact that isn't true here.
      candidate.platform_video_source_url = null;
      candidate.platform_video_tier = 2;
      candidate._platform_video_resolved_at = new Date().toISOString();
      found++;
      console.log(`FOUND (tier 2): ${candidate.full_name} (${state}) — "${result.videoTitle}" [channel: ${result.channelTitle}]`);
    }
    touchedFiles.add(outFile);

    // 5 straight failures is a real, sustained problem (quota exhaustion,
    // the API being down) rather than per-candidate noise — stop instead
    // of burning through the rest of today's batch on calls guaranteed to
    // fail the same way. Confirmed necessary, not theoretical: this exact
    // scenario happened on the day this safeguard was added.
    if (consecutiveErrors >= 5) {
      console.warn(`[scaleVideoTier2] ${consecutiveErrors} consecutive failures — stopping this run early rather than continuing to fail. Will resume the backlog next run.`);
      break;
    }
  }

  for (const file of touchedFiles) {
    writeFileSync(join(BUILD_ROOT, file), JSON.stringify(dataByFile.get(file), null, 2));
  }

  console.log(`\nDone. ${searched}/${batch.length} candidates actually searched, ${found} videos found, ${touchedFiles.size} race files changed.`);
  console.log(`${eligible.length - searched} still eligible for a future run (includes any this run failed to reach or errored on).`);
  if (found > 0) console.log(`Run the same independent audit as Tier 1 before publishing — see ballotwise_campaign_video_feature memory for method.`);
}

main();
