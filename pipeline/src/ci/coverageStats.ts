import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

// Prints how much of the candidate dataset actually has each kind of
// content, run daily by the pending-races routine alongside its other
// checks so coverage is visible over time, not just spot-checked on
// request. Reads local pipeline/build/ only -- the caller is responsible
// for making sure that's current (pullFromR2.ts, or a data-snapshot
// checkout) before running this; it does no fetching of its own.
const BUILD_ROOT = join(import.meta.dirname, "..", "..", "build");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return entry.endsWith(".json") ? [full] : [];
  });
}

function main() {
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

      const bio = c.bio ?? {};
      if (Object.values(bio).some((f: any) => f && f.value)) counts.anyBioField++;

      const hasTrackRecord = (Array.isArray(c.recent_votes) && c.recent_votes.length > 0) || (c.performance && Object.keys(c.performance).length > 0);
      if (hasTrackRecord && c.incumbent) incumbentsWithTrackRecord++;
    }
  }

  const pct = (n: number, d: number) => (d === 0 ? "n/a" : `${n}/${d} (${((n / d) * 100).toFixed(1)}%)`);

  console.log(`COVERAGE_STATS_START`);
  console.log(`${files.length} race files, ${total} candidates total (${incumbents} incumbents).`);
  console.log(`Background summary:        ${pct(counts.background, total)}`);
  console.log(`Any structured bio fact:   ${pct(counts.anyBioField, total)}`);
  console.log(`Financial totals on file:  ${pct(counts.finances, total)}`);
  console.log(`Platform/issues summary:   ${pct(counts.platformSummary, total)}`);
  console.log(`Campaign video:            ${pct(counts.video, total)}`);
  console.log(`Campaign site on file:     ${pct(counts.campaignSite, total)}`);
  console.log(`Congress track record:     ${pct(incumbentsWithTrackRecord, incumbents)} of incumbents`);
  console.log(`COVERAGE_STATS_END`);
}

main();
