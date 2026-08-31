import "dotenv/config";
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { verifyVideoViaOembed } from "./scaleReachableSiteExtraction.js";

// One-time reconciliation: the "Ballot-Wise weekly free refresh" cloud
// routine has been running unattended on its own schedule (Mondays) since
// 2026-08-24, holding real results on origin/data-weekly-review for human
// review -- nothing has ever merged them in. That branch's snapshot
// predates all of today's local work (campaign-site discovery, extraction,
// today's publish), so a wholesale overwrite from it would REGRESS today's
// newer results. Only pulls in what's genuinely safe and additive:
//   - hard_metrics / financials / performance / recent_votes / committees:
//     official government-record data keyed off already-verified FEC/
//     bioguide IDs, no attribution risk, always take the branch's fresher
//     value (same as refreshKnownFacts.ts's own withFallback logic).
//   - platform_video: ONLY for a candidate with no video at all locally,
//     and only after independent oEmbed verification -- the source
//     routine's own email explicitly flagged these 36 Tier 2 finds as
//     needing exactly this audit before being trusted (no site to anchor
//     identity to, the highest-risk tier in this pipeline).
// Everything else (bio_summary, platform, campaign_site_url, bio{}) is
// left untouched -- those are exactly the fields today's session already
// advanced past this branch's snapshot.
const LOCAL_BUILD = join(import.meta.dirname, "..", "..", "build");
const REVIEW_BUILD = "/tmp/weekly-review-extract/pipeline/build";

interface Stats {
  hardMetricsUpdated: number;
  financialsUpdated: number;
  trackRecordUpdated: number;
  videosApplied: number;
  videosRejectedByOembed: number;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return entry.endsWith(".json") ? [full] : [];
  });
}

async function mergeFile(relPath: string, stats: Stats) {
  const localPath = join(LOCAL_BUILD, relPath);
  const reviewPath = join(REVIEW_BUILD, relPath);
  if (!existsSync(localPath) || !existsSync(reviewPath)) return;

  const local = JSON.parse(readFileSync(localPath, "utf-8"));
  const review = JSON.parse(readFileSync(reviewPath, "utf-8"));
  if (!Array.isArray(local.candidates) || !Array.isArray(review.candidates)) return;

  let changed = false;

  if (review.hard_metrics && JSON.stringify(review.hard_metrics) !== JSON.stringify(local.hard_metrics)) {
    local.hard_metrics = review.hard_metrics;
    stats.hardMetricsUpdated++;
    changed = true;
  }

  const reviewByCandidateId = new Map(review.candidates.map((c: any) => [c.fec_candidate_id, c]));

  for (const localCand of local.candidates) {
    const reviewCand: any = reviewByCandidateId.get(localCand.fec_candidate_id);
    if (!reviewCand) continue;

    if (reviewCand.financials && JSON.stringify(reviewCand.financials) !== JSON.stringify(localCand.financials)) {
      localCand.financials = reviewCand.financials;
      stats.financialsUpdated++;
      changed = true;
    }

    if (localCand.bioguide_id && reviewCand.performance) {
      // committees/enacted_laws/etc. all live nested inside `performance`
      // itself (see build.ts's output object) -- not separate top-level
      // fields, so just these two cover the whole track record.
      const fields = ["performance", "recent_votes"];
      let trackRecordChanged = false;
      for (const f of fields) {
        if (f in reviewCand && JSON.stringify(reviewCand[f]) !== JSON.stringify(localCand[f])) {
          localCand[f] = reviewCand[f];
          trackRecordChanged = true;
        }
      }
      if (trackRecordChanged) {
        stats.trackRecordUpdated++;
        changed = true;
      }
    }

    if (!localCand.platform_video_url && reviewCand.platform_video_url && reviewCand.platform_video_tier === 2) {
      const verified = await verifyVideoViaOembed(reviewCand.platform_video_url, localCand.full_name);
      if (verified) {
        localCand.platform_video_url = reviewCand.platform_video_url;
        localCand.platform_video_title = reviewCand.platform_video_title;
        localCand.platform_video_source_url = reviewCand.platform_video_source_url;
        localCand.platform_video_tier = 2;
        localCand.platform_video_source_type = "youtube_search";
        localCand._platform_video_resolved_at = new Date().toISOString();
        stats.videosApplied++;
        changed = true;
      } else {
        stats.videosRejectedByOembed++;
        console.warn(`[oEmbed-reject] ${localCand.full_name}: Tier2 find "${reviewCand.platform_video_title}" didn't pass oEmbed identity check -- not applied.`);
      }
    }
  }

  if (changed) writeFileSync(localPath, JSON.stringify(local, null, 2));
}

async function main() {
  const stats: Stats = { hardMetricsUpdated: 0, financialsUpdated: 0, trackRecordUpdated: 0, videosApplied: 0, videosRejectedByOembed: 0 };
  const files = [...walk(join(REVIEW_BUILD, "house")).map((f) => "house/" + f.split("/").pop()), ...walk(join(REVIEW_BUILD, "senate")).map((f) => "senate/" + f.split("/").pop())];

  for (const relPath of files) {
    await mergeFile(relPath, stats);
  }

  console.log(`\nDone merging data-weekly-review into local build/.`);
  console.log(`  Race-level hard_metrics updated: ${stats.hardMetricsUpdated}`);
  console.log(`  Candidate financials updated:    ${stats.financialsUpdated}`);
  console.log(`  Incumbent track records updated: ${stats.trackRecordUpdated}`);
  console.log(`  Tier 2 videos applied (oEmbed-verified): ${stats.videosApplied}`);
  console.log(`  Tier 2 videos rejected by oEmbed:         ${stats.videosRejectedByOembed}`);
}

main().then(() => process.exit(0));
