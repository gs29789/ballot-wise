import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RACES } from "../build.js";
import { extractBioSummaryFromSite } from "../sources/campaignBioSummary.js";

// Scales bio_summary discovery to every already-built candidate WITHOUT
// going through buildRace() — same rationale as scaleVideoOnly.ts: this
// only needs each candidate's already-resolved campaign site, not a full
// re-run of FEC lookup, bio-fact extraction, platform extraction, etc.
//
// Reads and writes pipeline/build/ directly (not R2), same as
// scaleVideoOnly.ts — a plain `npm run publish` afterward pushes
// everything, this script's changes included.

const BUILD_ROOT = join(import.meta.dirname, "..", "..", "build");

const CAMPAIGN_SITE_BIO_TYPES = new Set(["llm_extracted_campaign_site", "llm_extracted_campaign_site_websearch"]);

function siteOriginOf(url: string): string | null {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}/`;
  } catch {
    return null;
  }
}

// Same fallback chain as scaleVideoOnly.ts's deriveCampaignSite — kept as
// an identical copy rather than a shared import so each scale script stays
// a single self-contained file, matching the existing sibling script.
function deriveCampaignSite(candidate: any): string | null {
  if (candidate.campaign_site_url) {
    const origin = siteOriginOf(candidate.campaign_site_url);
    if (origin) return origin;
  }
  if (candidate.platform_source_url) {
    const origin = siteOriginOf(candidate.platform_source_url);
    if (origin) return origin;
  }
  for (const field of Object.values(candidate.bio ?? {}) as any[]) {
    if (field && CAMPAIGN_SITE_BIO_TYPES.has(field.source_type)) {
      const origin = siteOriginOf(field.source_url);
      if (origin) return origin;
    }
  }
  return null;
}

async function processCandidate(c: any, opts: (typeof RACES)[number]): Promise<boolean> {
  if (c.bio_summary) return false; // already has one — full buildRace() owns any refresh cycle
  const baseUrl = deriveCampaignSite(c);
  if (!baseUrl) return false; // no known campaign site to check — nothing this script can do
  const expectedContext = `a candidate for ${opts.office === "H" ? "U.S. House of Representatives" : "U.S. Senate"} from ${opts.state}`;
  const result = await extractBioSummaryFromSite(c.full_name, baseUrl, expectedContext).catch((err) => {
    console.warn(`[scaleBioSummaryOnly] lookup failed for ${c.full_name}: ${err?.message ?? err}`);
    return null;
  });
  if (!result) return false;
  c.bio_summary = { value: result.summary, source_url: result.sourceUrl };
  c._bio_summary_resolved_at = new Date().toISOString();
  console.log(`FOUND: ${c.full_name} (${opts.state}) — "${result.summary.slice(0, 60)}..."`);
  return true;
}

async function processRace(opts: (typeof RACES)[number]): Promise<{ checked: number; found: number }> {
  const localPath = join(BUILD_ROOT, opts.outFile);
  if (!existsSync(localPath)) return { checked: 0, found: 0 };
  const data = JSON.parse(readFileSync(localPath, "utf-8"));
  if (!Array.isArray(data.candidates)) return { checked: 0, found: 0 };

  const eligible = data.candidates.filter((c: any) => !c.bio_summary);
  if (!eligible.length) return { checked: 0, found: 0 };

  const results = await Promise.all(eligible.map((c: any) => processCandidate(c, opts)));
  const found = results.filter(Boolean).length;
  if (found > 0) writeFileSync(localPath, JSON.stringify(data, null, 2));
  return { checked: eligible.length, found };
}

async function main() {
  let totalChecked = 0;
  let totalFound = 0;
  let racesChanged = 0;
  for (const opts of RACES) {
    const { checked, found } = await processRace(opts);
    totalChecked += checked;
    totalFound += found;
    if (found > 0) racesChanged++;
    if (checked > 0) {
      console.log(`${opts.outFile}: ${found}/${checked} found (running total: ${totalFound})`);
    }
  }
  console.log(`\nDone. ${totalChecked} candidates checked, ${totalFound} bio summaries found across ${racesChanged} race files.`);
  console.log(`Run "npm run publish" to push the updated files to R2.`);
}

main();
