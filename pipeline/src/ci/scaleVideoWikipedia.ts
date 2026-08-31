import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RACES } from "../build.js";
import { findCampaignVideoFromSite } from "../sources/campaignVideo.js";

// Scales Tier 3 (Wikipedia) campaign-video discovery to every already-built
// candidate who lacks a video, same reasoning as scaleVideoOnly.ts (Tier 1):
// deliberately skips buildRace() entirely, since a full rebuild's FEC/bio/
// platform work isn't needed just to check one page for a YouTube link.
//
// Deliberately narrower than "every candidate with no video": only checks
// candidates who ALREADY have a known Wikipedia URL on file (their
// bio_summary was sourced from Wikipedia). Finding a NEW Wikipedia URL for
// a candidate who doesn't have one requires the Wikidata search machinery
// buildRace() itself uses -- expensive, rate-limited, and not worth
// re-running here just for this. This script only spends effort where a
// Wikipedia page is already confirmed to exist.
//
// Reads and writes pipeline/build/ directly (not R2) -- a plain
// `npm run publish` afterward pushes everything, this script's changes
// included.
const BUILD_ROOT = join(import.meta.dirname, "..", "..", "build");

async function processCandidate(c: any, state: string): Promise<boolean> {
  if (c.platform_video_url) return false; // already has one
  const wikipediaUrl = c.bio_summary?.source_type === "wikipedia" ? c.bio_summary.source_url : null;
  if (!wikipediaUrl) return false; // no known Wikipedia page on file -- not this script's job to go find one

  const video = await findCampaignVideoFromSite(wikipediaUrl, c.full_name).catch((err) => {
    console.warn(`[scaleVideoWikipedia] lookup failed for ${c.full_name}: ${err?.message ?? err}`);
    return null;
  });
  if (!video) return false;

  c.platform_video_url = video.videoUrl;
  c.platform_video_title = video.videoTitle;
  c.platform_video_source_url = video.sourceUrl;
  c.platform_video_tier = 3;
  c.platform_video_source_type = "wikipedia";
  c._platform_video_resolved_at = new Date().toISOString();
  console.log(`FOUND: ${c.full_name} (${state}) — "${video.videoTitle}"`);
  return true;
}

async function processRace(opts: (typeof RACES)[number]): Promise<{ checked: number; found: number }> {
  const localPath = join(BUILD_ROOT, opts.outFile);
  if (!existsSync(localPath)) return { checked: 0, found: 0 };
  const data = JSON.parse(readFileSync(localPath, "utf-8"));
  if (!Array.isArray(data.candidates)) return { checked: 0, found: 0 };

  const eligible = data.candidates.filter((c: any) => !c.platform_video_url && c.bio_summary?.source_type === "wikipedia");
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
  console.log(`\nDone. ${totalChecked} candidates checked (had a known Wikipedia page, no video yet), ${totalFound} videos found across ${racesChanged} race files.`);
  console.log(`Run "npm run publish" to push the updated files to R2.`);
}

main();
