import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RACES } from "../build.js";
import { findCampaignVideoFromSite } from "../sources/campaignVideo.js";

// Scales Tier 1 campaign-video discovery to every already-built candidate
// WITHOUT going through buildRace() — deliberately skips FEC candidate
// lookup, Anthropic bio/platform extraction, and every other field
// buildRace() would also touch. This exists specifically because a normal
// full rebuild couples video discovery to all of that other (rate-limited,
// paid) work, which isn't needed just to find a video: the pipeline already
// knows each candidate's own campaign site from bio/platform extraction
// that already succeeded, published to local build/ output.
//
// Reads and writes pipeline/build/ directly (not R2) so it also picks up
// whatever the last partial buildRace() run already updated locally but
// hasn't been published yet — a plain `npm run publish` afterward pushes
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

// campaign_site_url is the authoritative field build.ts now publishes
// directly (added specifically so this script doesn't need to guess) — it
// exists whenever build.ts ever found a site for this candidate, regardless
// of whether bio/platform extraction from it succeeded. Older-format race
// files that predate that field still fall back to the same proxy this
// script always used: the platform page (most likely to also carry a
// "watch my plan" link), or any bio fact itself sourced from the campaign
// site.
function deriveCampaignSite(candidate: any): { baseUrl: string; extraPageUrl: string | null } | null {
  if (candidate.campaign_site_url) {
    const origin = siteOriginOf(candidate.campaign_site_url);
    if (origin) return { baseUrl: origin, extraPageUrl: candidate.platform_source_url ?? null };
  }
  if (candidate.platform_source_url) {
    const origin = siteOriginOf(candidate.platform_source_url);
    if (origin) return { baseUrl: origin, extraPageUrl: candidate.platform_source_url };
  }
  for (const field of Object.values(candidate.bio ?? {}) as any[]) {
    if (field && CAMPAIGN_SITE_BIO_TYPES.has(field.source_type)) {
      const origin = siteOriginOf(field.source_url);
      if (origin) return { baseUrl: origin, extraPageUrl: field.source_url };
    }
  }
  return null;
}

async function processCandidate(c: any, state: string): Promise<boolean> {
  if (c.platform_video_url) return false; // already has one — full buildRace() owns any refresh cycle
  const site = deriveCampaignSite(c);
  if (!site) return false; // no known campaign site to check — nothing this script can do
  const video = await findCampaignVideoFromSite(site.baseUrl, c.full_name, site.extraPageUrl).catch((err) => {
    console.warn(`[scaleVideoOnly] lookup failed for ${c.full_name}: ${err?.message ?? err}`);
    return null;
  });
  if (!video) return false;
  c.platform_video_url = video.videoUrl;
  c.platform_video_title = video.videoTitle;
  c.platform_video_source_url = video.sourceUrl;
  c._platform_video_resolved_at = new Date().toISOString();
  console.log(`FOUND: ${c.full_name} (${state}) — "${video.videoTitle}"`);
  return true;
}

async function processRace(opts: (typeof RACES)[number]): Promise<{ checked: number; found: number }> {
  const localPath = join(BUILD_ROOT, opts.outFile);
  if (!existsSync(localPath)) return { checked: 0, found: 0 };
  const data = JSON.parse(readFileSync(localPath, "utf-8"));
  if (!Array.isArray(data.candidates)) return { checked: 0, found: 0 };

  const eligible = data.candidates.filter((c: any) => !c.platform_video_url);
  if (!eligible.length) return { checked: 0, found: 0 };

  const results = await Promise.all(eligible.map((c: any) => processCandidate(c, opts.state)));
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
  }
  console.log(`\nDone. ${totalChecked} candidates checked, ${totalFound} videos found across ${racesChanged} race files.`);
  console.log(`Run "npm run publish" to push the updated files to R2.`);
}

main();
