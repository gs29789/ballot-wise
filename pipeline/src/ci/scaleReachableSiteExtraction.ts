import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RACES } from "../build.js";
import { extractPlatformFromSite } from "../sources/campaignPlatform.js";
import { extractBioSummaryFromSite } from "../sources/campaignBioSummary.js";
import { findCampaignVideoFromSite, wordBoundaryMatch } from "../sources/campaignVideo.js";

// Extraction pass for candidates a prior FREE discovery pass
// (scaleCampaignSiteDiscovery.ts) already confirmed reachable -- deliberately
// makes ZERO FEC calls (no getCommitteeWebsite, no getTotals, nothing in
// sources/fec.ts) so it never competes with the hourly discovery-retry cron
// for the same rate-limited quota. Video is free (findCampaignVideoFromSite
// makes zero Anthropic calls, per its own module comment); platform and
// bio_summary cost one Anthropic call each, only when that field is
// genuinely still empty -- "don't search where data already exists."
const BUILD_ROOT = join(import.meta.dirname, "..", "..", "build");

// Every video find gets independently re-verified via YouTube's public
// oEmbed endpoint before being trusted -- confirmed necessary the hard way
// earlier this session: findCampaignVideoFromSite's own built-in name-check
// (passesNameCheck) still let through misattributed videos at a real,
// measured ~50% rate across two separate audit rounds (11/23, then 6/12
// misattributed). This is not optional or a one-off manual step -- any
// script in this pipeline that finds a video must call this before
// persisting it. Fails closed (not verified) on any error, matching every
// other identity check in this pipeline.
export async function verifyVideoViaOembed(videoUrl: string, candidateName: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(videoUrl)}&format=json`);
    if (!res.ok) return false;
    const data: any = await res.json();
    const haystack = `${data.author_name ?? ""} ${data.title ?? ""}`;
    const lastName = (candidateName.split(",")[0] ?? "").trim();
    if (lastName.length > 1 && wordBoundaryMatch(haystack, lastName)) return true;
    return /\bfor (?:congress|senate|house)\b/i.test(haystack);
  } catch {
    return false;
  }
}

interface Gains {
  video: number;
  videoRejectedByOembed: number;
  platform: number;
  bioSummary: number;
}

async function processCandidate(c: any, expectedContext: string): Promise<Gains> {
  const gains: Gains = { video: 0, videoRejectedByOembed: 0, platform: 0, bioSummary: 0 };
  const site = c.campaign_site_url;
  if (!site) return gains;

  if (!c.platform_video_url) {
    const video = await findCampaignVideoFromSite(site, c.full_name, c.platform_source_url).catch(() => null);
    if (video) {
      const verified = await verifyVideoViaOembed(video.videoUrl, c.full_name);
      if (verified) {
        c.platform_video_url = video.videoUrl;
        c.platform_video_title = video.videoTitle;
        c.platform_video_source_url = video.sourceUrl;
        c.platform_video_tier = 1;
        c.platform_video_source_type = "campaign_site";
        c._platform_video_resolved_at = new Date().toISOString();
        gains.video++;
      } else {
        gains.videoRejectedByOembed++;
        console.warn(`[oEmbed-reject] ${c.full_name}: found "${video.videoTitle}" (${video.videoUrl}) but oEmbed author/title didn't match -- not persisted.`);
      }
    }
  }

  if (!(Array.isArray(c.platform) && c.platform.length > 0)) {
    const platform = await extractPlatformFromSite(c.full_name, site, expectedContext).catch(() => null);
    if (platform && platform.positions.length > 0) {
      c.platform = platform.positions;
      c.platform_source_url = platform.sourceUrl;
      c._platform_resolved_at = new Date().toISOString();
      gains.platform++;
    }
  }

  if (!c.bio_summary?.value) {
    const bioSummary = await extractBioSummaryFromSite(c.full_name, site, expectedContext).catch(() => null);
    if (bioSummary) {
      c.bio_summary = { value: bioSummary.summary, source_url: bioSummary.sourceUrl, source_type: bioSummary.sourceType };
      c._bio_summary_resolved_at = new Date().toISOString();
      gains.bioSummary++;
    }
  }

  return gains;
}

async function processRace(opts: (typeof RACES)[number]): Promise<{ checked: number; gains: Gains }> {
  const localPath = join(BUILD_ROOT, opts.outFile);
  const empty = { checked: 0, gains: { video: 0, videoRejectedByOembed: 0, platform: 0, bioSummary: 0 } };
  if (!existsSync(localPath)) return empty;
  const data = JSON.parse(readFileSync(localPath, "utf-8"));
  if (!Array.isArray(data.candidates)) return empty;

  const eligible = data.candidates.filter((c: any) => c._campaign_site_reachability === "reachable");
  if (!eligible.length) return empty;

  const expectedContext = `a candidate for ${opts.office === "H" ? "U.S. House of Representatives" : "U.S. Senate"} from ${opts.state}`;
  const results: Gains[] = await Promise.all(eligible.map((c: any) => processCandidate(c, expectedContext)));
  const gains: Gains = { video: 0, videoRejectedByOembed: 0, platform: 0, bioSummary: 0 };
  for (const g of results) {
    gains.video += g.video;
    gains.videoRejectedByOembed += g.videoRejectedByOembed;
    gains.platform += g.platform;
    gains.bioSummary += g.bioSummary;
  }

  writeFileSync(localPath, JSON.stringify(data, null, 2));
  return { checked: eligible.length, gains };
}

async function main() {
  const totals: Gains = { video: 0, videoRejectedByOembed: 0, platform: 0, bioSummary: 0 };
  let totalChecked = 0;

  for (const opts of RACES) {
    const { checked, gains } = await processRace(opts);
    totalChecked += checked;
    totals.video += gains.video;
    totals.videoRejectedByOembed += gains.videoRejectedByOembed;
    totals.platform += gains.platform;
    totals.bioSummary += gains.bioSummary;
    if (gains.video || gains.platform || gains.bioSummary || gains.videoRejectedByOembed) {
      console.log(`${opts.outFile}: +${gains.video} video, +${gains.platform} platform, +${gains.bioSummary} bio_summary (${gains.videoRejectedByOembed} video rejected by oEmbed)`);
    }
  }

  console.log(`\nDone. ${totalChecked} reachable candidates checked.`);
  console.log(`  New videos (oEmbed-verified):   ${totals.video}`);
  console.log(`  Videos found but oEmbed-rejected: ${totals.videoRejectedByOembed}`);
  console.log(`  New platform entries:           ${totals.platform}`);
  console.log(`  New bio summaries:              ${totals.bioSummary}`);
  console.log(`\nRun "npm run publish" to push the updated files to R2.`);
}

main().then(() => process.exit(0));
