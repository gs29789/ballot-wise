import "dotenv/config";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Prints how much of the candidate dataset actually has each kind of
// content, run daily by the pending-races routine alongside its other
// checks so coverage is visible over time, not just spot-checked on
// request. Reads local pipeline/build/ only -- the caller is responsible
// for making sure that's current (pullFromR2.ts, or a data-snapshot
// checkout) before running this. The one exception to "no fetching of
// its own" is site visits below, which needs a real network call to
// Cloudflare -- everything else here stays a pure local read.
const BUILD_ROOT = join(import.meta.dirname, "..", "..", "build");

// Persists the last run's raw counts so every run can show variance, not
// just a point-in-time snapshot. Git-tracked (small, plain JSON) so it
// survives between routine runs -- the daily routine must commit+push it
// every run, not just on days something else changes, or the "previous
// run" comparison silently resets whenever an ephemeral CCR session ends
// without committing it.
const HISTORY_PATH = join(import.meta.dirname, "coverageStatsHistory.json");

interface StatsSnapshot {
  generatedAt: string;
  totalRaces: number;
  totalCandidates: number;
  incumbents: number;
  background: number;
  anyBioField: number;
  finances: number;
  platformSummary: number;
  video: number;
  campaignSite: number;
  campaignSiteNeverChecked: number;
  incumbentsWithTrackRecord: number;
  siteVisitsRaw: number | null;
}

function loadPrevious(): StatsSnapshot | null {
  if (!existsSync(HISTORY_PATH)) return null;
  try {
    return JSON.parse(readFileSync(HISTORY_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveCurrent(snapshot: StatsSnapshot) {
  writeFileSync(HISTORY_PATH, JSON.stringify(snapshot, null, 2));
}

// Cloudflare's RUM (Real User Monitoring) pageload event count -- actual
// browser-reported page loads, not raw HTTP requests (which would also
// count every image/JS/CSS asset and API call, wildly overcounting real
// visits). Needs CLOUDFLARE_API_TOKEN to carry "Account Analytics: Read"
// specifically -- confirmed this project's existing Pages-scoped token
// does NOT have this by default (a real, tested 403, not assumed) until
// it was widened 2026-08-28. Fails soft: any error here (missing token,
// insufficient permission, network issue) just omits this one line
// rather than breaking the rest of the report, matching how every other
// optional check in this pipeline degrades. Returns the raw count
// alongside the display string so main() can diff it against last run --
// the string alone ("53 (last 7 days)") isn't parseable back out cleanly.
async function getSiteVisits(): Promise<{ display: string; raw: number | null }> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountTag = process.env.R2_ACCOUNT_ID; // same Cloudflare account as R2, already on hand
  if (!token || !accountTag) return { display: "not available (CLOUDFLARE_API_TOKEN or account id not configured here)", raw: null };

  const until = new Date().toISOString();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const query = `query($accountTag: String!, $since: Time!, $until: Time!) {
    viewer {
      accounts(filter: {accountTag: $accountTag}) {
        rumPageloadEventsAdaptiveGroups(limit: 1, filter: {datetime_geq: $since, datetime_leq: $until}) {
          count
        }
      }
    }
  }`;

  try {
    const res = await fetch("https://api.cloudflare.com/client/v4/graphql", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, variables: { accountTag, since, until } }),
    });
    const data: any = await res.json();
    const count = data?.data?.viewer?.accounts?.[0]?.rumPageloadEventsAdaptiveGroups?.[0]?.count;
    if (typeof count !== "number") return { display: `not available (${JSON.stringify(data.errors ?? data).slice(0, 200)})`, raw: null };
    return { display: `${count.toLocaleString()} (last 7 days)`, raw: count };
  } catch (err: any) {
    return { display: `not available (${err?.message ?? err})`, raw: null };
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return entry.endsWith(".json") ? [full] : [];
  });
}

// Formats a raw-count delta against the previous run, e.g. "(+12)" or
// "(-3)" or "(unchanged)". null means no previous run to compare against
// (first run ever, or history file missing/corrupt) -- silent in that
// case rather than printing a misleading "(+N)" against zero.
function delta(current: number, previous: number | null | undefined): string {
  if (previous === null || previous === undefined) return "";
  const d = current - previous;
  if (d === 0) return " (unchanged)";
  return ` (${d > 0 ? "+" : ""}${d})`;
}

async function main() {
  const previous = loadPrevious();
  const siteVisits = await getSiteVisits();
  const files = [...walk(join(BUILD_ROOT, "house")), ...walk(join(BUILD_ROOT, "senate"))];
  let total = 0;
  let incumbents = 0;
  const counts = {
    video: 0,
    background: 0,
    finances: 0,
    platformSummary: 0,
    anyBioField: 0,
    campaignSite: 0,
    campaignSiteNeverChecked: 0,
  };
  let incumbentsWithTrackRecord = 0;

  for (const file of files) {
    const data = JSON.parse(readFileSync(file, "utf8"));
    if (!data || !Array.isArray(data.candidates)) continue;
    for (const c of data.candidates) {
      total++;
      if (c.incumbent) incumbents++;

      if (c.platform_video_url) counts.video++;
      if (c.bio_summary?.value) counts.background++;
      if (typeof c.financials?.totalRaised === "number") counts.finances++;
      if (Array.isArray(c.platform) && c.platform.length > 0) counts.platformSummary++;
      if (c.campaign_site_url) counts.campaignSite++;
      // Distinguishes "checked, FEC genuinely has nothing on file" (the key
      // is present and null) from "this candidate has never been through a
      // buildRace() pass that would even attempt this at all" (the key is
      // absent entirely -- confirmed 2026-08-30 on Sen. Ossoff, whose record
      // predated the field: 904/1108 candidates were in this state before
      // scaleCampaignSiteDiscovery.ts started backfilling it). Without this
      // line, both cases silently look identical -- "no site" -- and an
      // actual gap in pipeline coverage reads the same as a genuine absence.
      if (c.campaign_site_url === undefined) counts.campaignSiteNeverChecked++;

      const bio = c.bio ?? {};
      if (Object.values(bio).some((f: any) => f && f.value)) counts.anyBioField++;

      const hasTrackRecord = (Array.isArray(c.recent_votes) && c.recent_votes.length > 0) || (c.performance && Object.keys(c.performance).length > 0);
      if (hasTrackRecord && c.incumbent) incumbentsWithTrackRecord++;
    }
  }

  const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${n}/${d} (${((n / d) * 100).toFixed(1)}%)`);

  console.log(`COVERAGE_STATS_START`);
  if (!previous) console.log(`(no previous run on file -- this becomes the baseline for next time)`);
  console.log(`Site visits:               ${siteVisits.display}${delta(siteVisits.raw ?? 0, previous?.siteVisitsRaw)}`);
  console.log(
    `${files.length} race files${delta(files.length, previous?.totalRaces)}, ${total} candidates total${delta(total, previous?.totalCandidates)} (${incumbents} incumbents${delta(incumbents, previous?.incumbents)}).`
  );
  console.log(`Background summary:        ${pct(counts.background, total)}${delta(counts.background, previous?.background)}`);
  console.log(`Any structured bio fact:   ${pct(counts.anyBioField, total)}${delta(counts.anyBioField, previous?.anyBioField)}`);
  console.log(`Financial totals on file:  ${pct(counts.finances, total)}${delta(counts.finances, previous?.finances)}`);
  console.log(`Platform/issues summary:   ${pct(counts.platformSummary, total)}${delta(counts.platformSummary, previous?.platformSummary)}`);
  console.log(`Campaign video:            ${pct(counts.video, total)}${delta(counts.video, previous?.video)}`);
  console.log(`Campaign site on file:     ${pct(counts.campaignSite, total)}${delta(counts.campaignSite, previous?.campaignSite)}`);
  console.log(
    `  ...never even checked:   ${pct(counts.campaignSiteNeverChecked, total)}${delta(counts.campaignSiteNeverChecked, previous?.campaignSiteNeverChecked)}`
  );
  console.log(
    `Congress track record:     ${pct(incumbentsWithTrackRecord, incumbents)} of incumbents${delta(incumbentsWithTrackRecord, previous?.incumbentsWithTrackRecord)}`
  );
  if (previous) console.log(`(vs. run on ${previous.generatedAt})`);
  console.log(`COVERAGE_STATS_END`);

  saveCurrent({
    generatedAt: new Date().toISOString(),
    totalRaces: files.length,
    totalCandidates: total,
    incumbents,
    background: counts.background,
    anyBioField: counts.anyBioField,
    finances: counts.finances,
    platformSummary: counts.platformSummary,
    video: counts.video,
    campaignSite: counts.campaignSite,
    campaignSiteNeverChecked: counts.campaignSiteNeverChecked,
    incumbentsWithTrackRecord,
    siteVisitsRaw: siteVisits.raw,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
