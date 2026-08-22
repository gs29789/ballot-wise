import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RACES } from "../build.js";
import { findCampaignWebsite } from "../sources/webSearchDiscovery.js";
import { extractBioSummaryFromSite } from "../sources/campaignBioSummary.js";
import { extractPlatformFromSite } from "../sources/campaignPlatform.js";

// Targets the population every other scale script skips: candidates with NO
// known campaign site at all (no campaign_site_url, no platform_source_url,
// no bio field sourced from one) -- confirmed 2026-08-22 as the dominant
// share of the bio_summary/platform coverage gap (roughly 73-79% of it),
// NOT a gating bug (verified: build.ts's own site-discovery already runs
// independently of whether bio facts resolved elsewhere -- see
// ballotwise_bio_summary_feature memory). The real lever here is just
// re-attempting web-search-based discovery periodically, since a search
// that finds nothing today can find something once a campaign's site goes
// live later in the cycle -- same "recheck over time" logic as every other
// refresh cycle in this pipeline, just for the discovery step itself rather
// than a field.
//
// Deliberately the most expensive scale script in this pipeline (1
// Anthropic call for search, up to 2 more for bio_summary/platform
// extraction per candidate) -- run this LAST after the cheaper Tier
// 1/Tier 2 video scripts in any shared batch, and expect a modest budget
// (a few hundred candidates/run) rather than clearing the whole backlog in
// one pass.

const BUILD_ROOT = join(import.meta.dirname, "..", "..", "build");
const DAILY_BUDGET = 60; // Anthropic-call-bound, not quota-bound like Tier 2 -- kept modest since search alone can burn 1-3 calls/candidate (see webSearchDiscovery.ts's own retry) before extraction even starts.
const REFRESH_DAYS = 21; // shorter than bio's 90-day base -- "no site yet" is far more time-sensitive than an already-resolved fact, especially as a cycle progresses and campaigns launch sites.

const CAMPAIGN_SITE_BIO_TYPES = new Set(["llm_extracted_campaign_site", "llm_extracted_campaign_site_websearch"]);

function hasKnownSite(c: any): boolean {
  if (c.campaign_site_url) return true;
  if (c.platform_source_url) return true;
  if (c.bio_summary?.source_url) return true;
  if (c.bio) for (const v of Object.values(c.bio) as any[]) if (v && CAMPAIGN_SITE_BIO_TYPES.has(v.source_type)) return true;
  return false;
}

function isDueForRecheck(attemptedAt: string | null | undefined): boolean {
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
      if (hasKnownSite(candidate)) continue;
      if (!isDueForRecheck(candidate._no_site_search_attempted_at)) continue;
      eligible.push({ outFile: opts.outFile, state: opts.state, office: opts.office, candidate });
    }
  }
  eligible.sort((a, b) => {
    const aNever = !a.candidate._no_site_search_attempted_at;
    const bNever = !b.candidate._no_site_search_attempted_at;
    return aNever === bNever ? 0 : aNever ? -1 : 1;
  });
  return eligible;
}

async function main() {
  const dataByFile = new Map<string, any>();
  const eligible = collectEligible(dataByFile);
  const batch = eligible.slice(0, DAILY_BUDGET);
  console.log(`${eligible.length} candidates eligible (no known site), processing ${batch.length} this run.`);

  const touchedFiles = new Set<string>();
  let siteFound = 0, bioSummaryFound = 0, platformFound = 0, searched = 0;

  for (const entry of batch) {
    const { candidate: c, state, office, outFile } = entry;
    const expectedContext = `a candidate for ${office === "H" ? "U.S. House of Representatives" : "U.S. Senate"} from ${state}`;
    let site: string | null = null;
    try {
      site = await findCampaignWebsite(c.full_name, expectedContext);
      searched++;
    } catch (err: any) {
      console.warn(`[scaleNoSiteBacklog] search failed for ${c.full_name}: ${err?.message ?? err}`);
      continue; // API failure, not a genuine negative -- don't mark attempted, same discipline as scaleVideoTier2.ts
    }
    c._no_site_search_attempted_at = new Date().toISOString();
    touchedFiles.add(outFile);
    if (!site) continue;

    siteFound++;
    c.campaign_site_url = site;
    console.log(`SITE FOUND: ${c.full_name} (${state}) -> ${site}`);

    const [summary, platform] = await Promise.all([
      extractBioSummaryFromSite(c.full_name, site, expectedContext).catch(() => null),
      extractPlatformFromSite(c.full_name, site, expectedContext).catch(() => null),
    ]);
    if (summary) {
      c.bio_summary = { value: summary.summary, source_url: summary.sourceUrl };
      c._bio_summary_resolved_at = new Date().toISOString();
      bioSummaryFound++;
    }
    if (platform) {
      c.platform = platform.positions;
      c.platform_source_url = platform.sourceUrl;
      c._platform_resolved_at = new Date().toISOString();
      platformFound++;
    }
  }

  for (const file of touchedFiles) {
    writeFileSync(join(BUILD_ROOT, file), JSON.stringify(dataByFile.get(file), null, 2));
  }

  console.log(`\nDone. ${searched}/${batch.length} searched, ${siteFound} sites found, ${bioSummaryFound} bio summaries, ${platformFound} platforms. ${touchedFiles.size} files changed.`);
  console.log(`${eligible.length - searched} still eligible for a future run.`);
}

main();
