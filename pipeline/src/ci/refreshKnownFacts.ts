// Weekly, zero-Anthropic-cost refresh of already-known candidates' public-
// record facts: congressional activity (recent votes/bills/committees),
// FEC fundraising, DW-NOMINATE ideology score, Bridge Grades bipartisanship
// score, and state-level hard metrics — plus a scan for brand-new FEC
// filers on races we've already built. Every source here is a free-tier
// government/public-data API (congress.gov, FEC, BLS, Census, Voteview,
// Bridge Grades) — no ANTHROPIC_API_KEY or YOUTUBE_API_KEY anywhere in this
// file, by design, so it can run on a schedule without spending money.
//
// Deliberately excludes full-session attendance recompute
// (houseRollCall/senateRollCall's getAttendanceStats): it walks every roll
// call individually (250+ requests per candidate), and testing this script
// against just 2 races tripped a rate limit on clerk.house.gov within
// minutes — at ~440 incumbents run weekly that's 100,000+ requests to a
// small government site. Attendance still gets refreshed normally whenever
// the main build.ts pipeline rebuilds a race; it's just not part of this
// lightweight weekly pass.
//
// Writes updated race JSON back to pipeline/build/*.json (never touches R2,
// never publishes) and produces a findings report — both a structured JSON
// file and a human-readable Markdown table — summarizing what actually
// changed this run, for a routine to quote directly in a notification.
import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RACES, type BuildRaceOptions } from "../build.js";
import { searchCandidates, getTotals } from "../sources/fec.js";
import { getLegislativeActivity, getEnactedLaws } from "../sources/congressGov.js";
import { getCommitteeAssignments } from "../sources/congressLegislators.js";
import { getRecentMemberVotes as getRecentHouseVotes } from "../sources/houseRollCall.js";
import { getRecentMemberVotes as getRecentSenateVotes } from "../sources/senateRollCall.js";
import { getIdeologyScore } from "../sources/voteview.js";
import { getBridgeScore } from "../sources/bridgeGrades.js";
import {
  getUnemploymentRate,
  getViolentCrimeRate,
  getNonfarmEmployment,
  getFederalSpendingByDistrict,
  getStatePopulation,
  getMedianHouseholdIncome,
} from "../sources/hardMetrics.js";

const BUILD_DIR = join(process.cwd(), "build");

type Finding = {
  race: string;
  candidate?: string;
  field: string;
  detail: string;
  priority: "info" | "action"; // "action" = the free-tier signal that paid discovery (Process 2) may be worth running
};

function isEmpty(v: unknown): boolean {
  return v == null || (Array.isArray(v) && v.length === 0);
}
function withFallback<T>(fresh: T, previous: T | undefined): T {
  return isEmpty(fresh) && !isEmpty(previous) ? (previous as T) : fresh;
}
function changed(fresh: unknown, previous: unknown): boolean {
  if (isEmpty(fresh)) return false; // a failed/empty fetch isn't a "change" — withFallback keeps the old value
  return JSON.stringify(fresh) !== JSON.stringify(previous);
}

async function refreshRace(opts: BuildRaceOptions, findings: Finding[]): Promise<boolean> {
  const outPath = join(BUILD_DIR, opts.outFile);
  if (!existsSync(outPath)) return false; // not built yet — this script only refreshes existing races
  const race = JSON.parse(readFileSync(outPath, "utf8"));

  // Hard metrics — same six free calls build.ts makes, race-level not candidate-level.
  const currentYear = new Date().getFullYear();
  const [unemployment, violentCrime, nonfarmEmployment, federalSpending, population, medianIncome] = await Promise.all([
    getUnemploymentRate(opts.state, currentYear - 3, currentYear).catch(() => null),
    getViolentCrimeRate(opts.state, currentYear - 5, currentYear - 1).catch(() => null),
    getNonfarmEmployment(opts.state, currentYear - 3, currentYear).catch(() => null),
    getFederalSpendingByDistrict(opts.state, currentYear - 3, currentYear - 1).catch(() => []),
    getStatePopulation(opts.state, currentYear - 4, currentYear - 1).catch(() => null),
    getMedianHouseholdIncome(opts.state, currentYear - 4, currentYear - 1).catch(() => null),
  ]);
  const prevMetrics = race.hard_metrics ?? {};
  const freshMetrics: Record<string, unknown> = {
    unemployment_rate: unemployment,
    violent_crime_rate_per_100k: violentCrime,
    nonfarm_employment_thousands: nonfarmEmployment,
    federal_spending: federalSpending,
    population,
    median_household_income: medianIncome,
  };
  for (const [key, fresh] of Object.entries(freshMetrics)) {
    if (changed(fresh, prevMetrics[key])) {
      findings.push({ race: opts.outFile, field: `hard_metrics.${key}`, detail: "New data point published", priority: "info" });
    }
    race.hard_metrics[key] = withFallback(fresh, prevMetrics[key]);
  }

  // New-filer scan — the free-tier signal for whether Process 2 (paid bio/
  // platform/site discovery) is worth running for this race.
  // Only meaningful pre-primary: once primary_results has narrowed a race
  // to its general-election advancers, every other FEC filer for that race
  // is a real person but a primary non-advancer (e.g. Alaska's Mary
  // Peltola), not a "new" candidate — confirmed by testing against AK-AL,
  // which otherwise flagged 7 of its own past primary field as new filers.
  if (!race.primary_results) {
    const knownIds = new Set(race.candidates.map((c: any) => c.fec_candidate_id));
    const currentFecList = await searchCandidates(opts.state, opts.office, opts.cycle, opts.office === "H" ? opts.district : undefined).catch(() => []);
    for (const fc of currentFecList) {
      if (!knownIds.has(fc.candidateId)) {
        findings.push({
          race: opts.outFile,
          candidate: fc.name,
          field: "new_filer",
          detail: `New FEC filing (${fc.candidateId}, ${fc.party}, ${fc.incumbentChallenge}) — not yet in our data. No site/bio/platform on file.`,
          priority: "action",
        });
      }
    }
  }

  // Per-candidate refresh: fundraising for everyone, congressional activity
  // only for candidates matched to a sitting member (bioguide_id set).
  for (const cand of race.candidates) {
    const totals = await getTotals(cand.fec_candidate_id, opts.cycle).catch(() => null);
    if (changed(totals, cand.financials)) {
      const oldRaised = cand.financials?.totalRaised ?? 0;
      const newRaised = totals?.totalRaised ?? 0;
      findings.push({
        race: opts.outFile,
        candidate: cand.full_name,
        field: "fundraising",
        detail: `Total raised ${oldRaised.toLocaleString()} → ${newRaised.toLocaleString()}`,
        priority: "info",
      });
    }
    cand.financials = withFallback(totals, cand.financials);

    if (!cand.bioguide_id || !cand.performance) continue;
    const bioguideId = cand.bioguide_id;
    let committees, legislativeActivity, enactedLaws, ideologyScore, bridgeScore, recentVotes;
    if (opts.office === "H") {
      [recentVotes, committees, legislativeActivity, enactedLaws, ideologyScore, bridgeScore] = await Promise.all([
        getRecentHouseVotes(bioguideId, opts.cycle, 5).catch(() => []),
        getCommitteeAssignments(bioguideId).catch(() => []),
        getLegislativeActivity(bioguideId).catch(() => null),
        getEnactedLaws(bioguideId).catch(() => []),
        getIdeologyScore(bioguideId, opts.congress).catch(() => null),
        getBridgeScore(bioguideId, "H").catch(() => null),
      ]);
    } else {
      const lastName = cand.full_name.split(",")[0].trim();
      [recentVotes, committees, legislativeActivity, enactedLaws, ideologyScore, bridgeScore] = await Promise.all([
        getRecentSenateVotes(lastName, opts.state, opts.congress, opts.session, 5).catch(() => []),
        getCommitteeAssignments(bioguideId).catch(() => []),
        getLegislativeActivity(bioguideId).catch(() => null),
        getEnactedLaws(bioguideId).catch(() => []),
        getIdeologyScore(bioguideId, opts.congress).catch(() => null),
        getBridgeScore(bioguideId, "S").catch(() => null),
      ]);
    }

    const perf = cand.performance;
    if (changed(legislativeActivity?.billsSponsored, perf.bills_sponsored) || changed(legislativeActivity?.billsCosponsored, perf.bills_cosponsored)) {
      findings.push({
        race: opts.outFile,
        candidate: cand.full_name,
        field: "bills",
        detail: `Sponsored/cosponsored ${perf.bills_sponsored ?? 0}/${perf.bills_cosponsored ?? 0} → ${legislativeActivity?.billsSponsored ?? perf.bills_sponsored ?? 0}/${legislativeActivity?.billsCosponsored ?? perf.bills_cosponsored ?? 0}`,
        priority: "info",
      });
    }
    if (enactedLaws && enactedLaws.length > (perf.enacted_laws?.length ?? 0)) {
      findings.push({ race: opts.outFile, candidate: cand.full_name, field: "enacted_laws", detail: `${enactedLaws.length - (perf.enacted_laws?.length ?? 0)} newly enacted law(s)`, priority: "info" });
    }
    if (changed(committees, perf.committees)) {
      findings.push({ race: opts.outFile, candidate: cand.full_name, field: "committees", detail: "Committee assignments changed", priority: "info" });
    }
    if (changed(ideologyScore, perf.ideology_score)) {
      findings.push({
        race: opts.outFile,
        candidate: cand.full_name,
        field: "ideology_score",
        detail: `DW-NOMINATE ${perf.ideology_score?.nominateDim1 ?? "n/a"} → ${ideologyScore?.nominateDim1 ?? "n/a"}`,
        priority: "info",
      });
    }
    if (changed(bridgeScore, perf.bridge_score)) {
      findings.push({
        race: opts.outFile,
        candidate: cand.full_name,
        field: "bridge_score",
        detail: `Bridge Grade ${perf.bridge_score?.grade ?? "n/a"} (${perf.bridge_score?.score ?? "n/a"}) → ${bridgeScore?.grade ?? "n/a"} (${bridgeScore?.score ?? "n/a"})`,
        priority: "info",
      });
    }

    cand.recent_votes = withFallback(recentVotes, cand.recent_votes);
    perf.committees = withFallback(committees, perf.committees);
    perf.bills_sponsored = withFallback(legislativeActivity?.billsSponsored ?? null, perf.bills_sponsored);
    perf.bills_cosponsored = withFallback(legislativeActivity?.billsCosponsored ?? null, perf.bills_cosponsored);
    perf.bills_became_law = withFallback(enactedLaws?.length ?? null, perf.bills_became_law);
    perf.enacted_laws = withFallback(enactedLaws, perf.enacted_laws);
    perf.ideology_score = withFallback(ideologyScore, perf.ideology_score);
    perf.bridge_score = withFallback(bridgeScore, perf.bridge_score);
  }

  writeFileSync(outPath, JSON.stringify(race, null, 2) + "\n");
  return true;
}

function renderMarkdown(findings: Finding[]): string {
  const actionItems = findings.filter((f) => f.priority === "action");
  const infoItems = findings.filter((f) => f.priority === "info");
  const lines: string[] = [`# Weekly refresh findings — ${new Date().toISOString().slice(0, 10)}`, ""];
  lines.push(`${findings.length} total change(s): ${actionItems.length} may need the paid discovery process, ${infoItems.length} informational.`, "");
  if (actionItems.length) {
    lines.push("## Needs a decision — new candidates with no bio/platform/site on file", "", "| Race | Candidate | Detail |", "|---|---|---|");
    for (const f of actionItems) lines.push(`| ${f.race} | ${f.candidate ?? ""} | ${f.detail} |`);
    lines.push("");
  }
  if (infoItems.length) {
    lines.push("## Informational — existing candidates' public-record data updated", "", "| Race | Candidate | Field | Detail |", "|---|---|---|---|");
    for (const f of infoItems) lines.push(`| ${f.race} | ${f.candidate ?? ""} | ${f.field} | ${f.detail} |`);
    lines.push("");
  }
  if (!findings.length) lines.push("No changes found this run.");
  return lines.join("\n");
}

async function main() {
  const findings: Finding[] = [];
  let refreshed = 0;
  const TEST_ONLY = process.env.REFRESH_TEST_ONLY?.split(",");

  // Weekly budget + rotation, not the full 441-race roster every run.
  // Confirmed by direct timing: 25 races took ~91s at 10-way concurrency,
  // and RAISING concurrency to 30 made it slightly SLOWER (116s) -- a clear
  // sign of an external throttle already in effect, not a lack of
  // parallelism. Extrapolated, the full roster sequentially exceeded a
  // routine session's turn limit and stalled mid-run without ever reaching
  // the commit/push/email steps. Rather than fight a ceiling that more
  // concurrency won't move, scope each run to a budget and rotate through
  // the full roster over several weeks -- congressional activity/fundraising
  // data doesn't change so fast that every candidate needs checking every
  // single week. The slice index is derived from the current date (whole
  // weeks since the Unix epoch), not any persisted state -- pipeline/build/
  // reseeds from data-snapshot (the published baseline) every run, so
  // anything stored only on the unpublished data-weekly-review branch would
  // be invisible to the next run anyway.
  const WEEKLY_BUDGET = 80;
  const totalSlices = Math.max(1, Math.ceil(RACES.length / WEEKLY_BUDGET));
  const weekIndex = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000)) % totalSlices;
  const races = TEST_ONLY
    ? RACES.filter((r) => TEST_ONLY.includes(r.outFile))
    : RACES.slice(weekIndex * WEEKLY_BUDGET, (weekIndex + 1) * WEEKLY_BUDGET);
  if (!TEST_ONLY) console.log(`Week slice ${weekIndex + 1}/${totalSlices}: ${races.length} races this run.`);

  // Bounded-concurrency worker pool. `findings` is safely shared across
  // workers: JS's single-threaded event loop makes concurrent `Array.push`
  // calls from async functions atomic in effect, no lock needed.
  const CONCURRENCY = 10;
  let cursor = 0;
  async function worker() {
    while (cursor < races.length) {
      const opts = races[cursor++];
      const did = await refreshRace(opts, findings);
      if (did) refreshed++;
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  writeFileSync(join(BUILD_DIR, "_weekly_refresh_findings.json"), JSON.stringify(findings, null, 2));
  writeFileSync(join(BUILD_DIR, "_weekly_refresh_findings.md"), renderMarkdown(findings));
  const actionCount = findings.filter((f) => f.priority === "action").length;
  console.log(`Done. ${refreshed} races refreshed, ${findings.length} findings (${actionCount} need a decision on paid discovery).`);
}

main();
