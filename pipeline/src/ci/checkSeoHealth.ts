import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

// Deterministic half of the daily SEO-progress report -- pure network
// checks against the live site itself, no external API or credentials
// needed. The routine that wraps this script fills in the other half
// (actual Google visibility) with a direct WebSearch call, since that
// needs the calling agent's own tool access, not something a plain
// script can do. Same split as resolvePendingPrimaries.ts vs. the
// routine that wraps it: this file stays a pure, testable unit.
const SITE_URL = "https://ballot-wise.com";

// Same pattern as coverageStatsHistory.json: persists the last run's
// counts so every run can show variance, not just a point-in-time
// snapshot. Git-tracked, committed unconditionally every run by the
// routine -- without that, an ephemeral CCR session that doesn't reach
// its own commit step would lose today's snapshot and tomorrow's run
// would have nothing to diff against.
const HISTORY_PATH = join(import.meta.dirname, "seoHealthHistory.json");

interface SeoSnapshot {
  generatedAt: string;
  homepageOk: boolean;
  sitemapOk: boolean;
  sitemapUrlCount: number;
  racesPageOk: boolean;
}

function loadPrevious(): SeoSnapshot | null {
  if (!existsSync(HISTORY_PATH)) return null;
  try {
    return JSON.parse(readFileSync(HISTORY_PATH, "utf8"));
  } catch {
    return null;
  }
}

function saveCurrent(snapshot: SeoSnapshot) {
  writeFileSync(HISTORY_PATH, JSON.stringify(snapshot, null, 2));
}

function delta(current: number, previous: number | null | undefined): string {
  if (previous === null || previous === undefined) return "";
  const d = current - previous;
  if (d === 0) return " (unchanged)";
  return ` (${d > 0 ? "+" : ""}${d})`;
}

async function checkOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const previous = loadPrevious();

  const homepageOk = await checkOk(`${SITE_URL}/`);
  const racesPageOk = await checkOk(`${SITE_URL}/races`);

  let sitemapOk = false;
  let sitemapUrlCount = 0;
  try {
    const res = await fetch(`${SITE_URL}/sitemap.xml`);
    sitemapOk = res.ok;
    if (res.ok) {
      const body = await res.text();
      sitemapUrlCount = (body.match(/<loc>/g) ?? []).length;
    }
  } catch {
    // sitemapOk stays false, sitemapUrlCount stays 0 -- reported as-is,
    // not treated as a script failure (a real, worth-reporting fact).
  }

  console.log(`SEO_HEALTH_START`);
  if (!previous) console.log(`(no previous run on file -- this becomes the baseline for next time)`);
  console.log(`Homepage reachable:  ${homepageOk ? "yes" : "NO"}`);
  console.log(`Sitemap reachable:   ${sitemapOk ? "yes" : "NO"}`);
  console.log(`Sitemap URL count:   ${sitemapUrlCount}${delta(sitemapUrlCount, previous?.sitemapUrlCount)}`);
  console.log(`/races page reachable: ${racesPageOk ? "yes" : "NO"}`);
  if (previous) console.log(`(vs. run on ${previous.generatedAt})`);
  console.log(`SEO_HEALTH_END`);

  // A sitemap URL count that DROPS is exactly the regression this script
  // exists to catch early -- the 442-to-9 manifest.json bug (2026-09-15)
  // would have shown up here as a same-day alert instead of only being
  // noticed by chance.
  if (previous && sitemapUrlCount < previous.sitemapUrlCount) {
    console.log(`SITEMAP_REGRESSION: dropped from ${previous.sitemapUrlCount} to ${sitemapUrlCount} URLs`);
  }

  saveCurrent({ generatedAt: new Date().toISOString(), homepageOk, sitemapOk, sitemapUrlCount, racesPageOk });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
