import "dotenv/config";
import { readFileSync, readdirSync } from "node:fs";
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

// Cloudflare's RUM (Real User Monitoring) pageload event count -- actual
// browser-reported page loads, not raw HTTP requests (which would also
// count every image/JS/CSS asset and API call, wildly overcounting real
// visits). Needs CLOUDFLARE_API_TOKEN to carry "Account Analytics: Read"
// specifically -- confirmed this project's existing Pages-scoped token
// does NOT have this by default (a real, tested 403, not assumed) until
// it was widened 2026-08-28. Fails soft: any error here (missing token,
// insufficient permission, network issue) just omits this one line
// rather than breaking the rest of the report, matching how every other
// optional check in this pipeline degrades.
async function getSiteVisits(): Promise<string> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  const accountTag = process.env.R2_ACCOUNT_ID; // same Cloudflare account as R2, already on hand
  if (!token || !accountTag) return "not available (CLOUDFLARE_API_TOKEN or account id not configured here)";

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
    if (typeof count !== "number") return `not available (${JSON.stringify(data.errors ?? data).slice(0, 200)})`;
    return `${count.toLocaleString()} (last 7 days)`;
  } catch (err: any) {
    return `not available (${err?.message ?? err})`;
  }
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return entry.endsWith(".json") ? [full] : [];
  });
}

async function main() {
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
  console.log(`Site visits:               ${siteVisits}`);
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
