import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { searchCandidates, getTotals, getCommitteeWebsite } from "./sources/fec.js";
import { getMembersByState, getLegislativeActivity, getEnactedLaws } from "./sources/congressGov.js";
import { getBioFacts } from "./sources/wikidata.js";
import { extractBioFacts, extractBioFactsFromSite, EXTRACTABLE_FIELDS, type ExtractedBio } from "./sources/llmExtract.js";
import { getCommitteeAssignments } from "./sources/congressLegislators.js";
import { buildHouseHistorianUrl } from "./sources/houseHistorian.js";
import { findBallotReadyBio } from "./sources/ballotReady.js";
import { findCampaignWebsite } from "./sources/webSearchDiscovery.js";
import { extractPlatformFromSite } from "./sources/campaignPlatform.js";
import { getFinancialDisclosure, type FinancialDisclosureSummary } from "./sources/houseFinancialDisclosure.js";
import { getIdeologyScore } from "./sources/voteview.js";
import { getBridgeScore } from "./sources/bridgeGrades.js";
import {
  getRecentMemberVotes as getRecentHouseVotes,
  getAttendanceStats as getHouseAttendance,
} from "./sources/houseRollCall.js";
import {
  getRecentMemberVotes as getRecentSenateVotes,
  getAttendanceStats as getSenateAttendance,
} from "./sources/senateRollCall.js";
import { loadCuratedRace } from "./curated.js";
import { getUnemploymentRate, getViolentCrimeRate, getNonfarmEmployment, getFederalSpendingByDistrict, getStatePopulation, getMedianHouseholdIncome } from "./sources/hardMetrics.js";
import { getStateBackgroundCheckFact } from "./sources/stateBackgroundCheckLaw.js";
import { getElectionDates } from "./sources/electionDates.js";
import { getPrimaryFilter } from "./sources/primaryResults.js";

const BUILD_ROOT = join(import.meta.dirname, "..", "build");

// A weekly rebuild will occasionally have one upstream source fail for
// reasons that have nothing to do with the data itself (confirmed today:
// FBI's crime API returning 503, Census/BLS keys not yet configured, a
// WAF rejecting a fraction of requests) — that shouldn't blank out a field
// that was correctly populated last week. Instead of overwriting with
// null/empty on a failed fetch, this falls back to whatever this exact
// build already published to R2 last time. No separate "stale" flag is
// needed: every one of these values already carries its own year/date, so
// reused data is self-evidently dated to whoever reads it.
async function fetchPreviousRace(outFile: string): Promise<any | null> {
  const base = process.env.R2_PUBLIC_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/${outFile}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function isEmpty(v: unknown): boolean {
  return v == null || (Array.isArray(v) && v.length === 0);
}

function withFallback<T>(fresh: T, previous: T | undefined): T {
  return isEmpty(fresh) && !isEmpty(previous) ? (previous as T) : fresh;
}

// How often to re-check a "held" fact that can genuinely go stale — a newer
// financial disclosure gets filed, a campaign updates its stated platform.
// Bio facts (birthdate, college, etc.) deliberately don't use this: they're
// either correct or wrong, not stale, so the bio waterfall's existing
// "keep trying until found" behavior already covers the only real gap there.
//
// The jitter matters as much as the base interval. A whole cohort resolved
// on the same day — e.g. a state's first-ever build — would otherwise all
// come due for refresh on the identical day REFRESH_BASE_DAYS later,
// recreating the exact request-volume spike this mechanism exists to avoid
// (confirmed tonight: Wyoming's financial-disclosure lookups alone were
// enough to trip the Clerk's WAF once two states were being built back to
// back). Each candidate gets a stable extra offset derived from their own
// FEC ID, so a batch resolved together spreads its refreshes across
// REFRESH_JITTER_DAYS instead of landing on one day.
const REFRESH_BASE_DAYS = 90;
const REFRESH_JITTER_DAYS = 30;

function isDueForRefresh(resolvedAt: string | undefined, seed: string): boolean {
  if (!resolvedAt) return true;
  const days = (Date.now() - new Date(resolvedAt).getTime()) / 86_400_000;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return days >= REFRESH_BASE_DAYS + (hash % REFRESH_JITTER_DAYS);
}

// Shared "hold what we have, chase what's due" pattern for financial
// disclosures and campaign platforms. Skips the fetch if we already have a
// value that isn't due for refresh yet. Otherwise attempts a fresh fetch,
// but falls back to the existing value rather than letting a failed or
// empty attempt wipe out something that was already correctly resolved —
// same resilience principle as withFallback above, just proactive about
// which candidates it even bothers asking.
async function resolveWithRefresh<T>(
  existing: T | null | undefined,
  resolvedAt: string | undefined,
  seed: string,
  fetchFresh: () => Promise<T | null>
): Promise<{ value: T | null; resolvedAt: string | undefined }> {
  if (existing && !isDueForRefresh(resolvedAt, seed)) {
    return { value: existing, resolvedAt };
  }
  const fresh = await fetchFresh();
  if (fresh) return { value: fresh, resolvedAt: new Date().toISOString() };
  return { value: existing ?? null, resolvedAt };
}

function slugify(fecName: string): string {
  // FEC names come as "LAST, FIRST MIDDLE SUFFIX" — normalize to "first-last"
  // so it matches the curated YAML filename for the same person.
  const [last, rest] = fecName.split(",").map((s) => s.trim());
  const first = (rest ?? "").split(/\s+/)[0] ?? "";
  return `${first}-${last}`
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

function normalizeNameForMatch(name: string): string {
  return name.toLowerCase().replace(/[^a-z\s]/g, "").trim();
}

// Fills bio[field] from an LLM extraction result, but only for fields not
// already set by a higher-priority source (structured Wikidata data, an
// earlier extraction pass, or curated YAML) — first source to produce a
// verbatim-quoted fact for a field wins; later sources only fill gaps.
function mergeExtracted(
  bio: Record<string, unknown>,
  extracted: ExtractedBio | null,
  sourceUrl: string,
  sourceType: string,
  curatedBio: Record<string, unknown>
) {
  if (!extracted) return;
  for (const field of EXTRACTABLE_FIELDS) {
    if (bio[field] || curatedBio[field]) continue;
    const hit = extracted[field];
    if (hit) bio[field] = { value: hit.value, source_url: sourceUrl, snippet: hit.snippet, source_type: sourceType };
  }
}

function searchName(fecName: string): string {
  // Wikidata's search API matches almost nothing against FEC's raw
  // "LAST, FIRST MIDDLE SUFFIX" format — needs a normal "First Last" query.
  const [last, rest] = fecName.split(",").map((s) => s.trim());
  const first = (rest ?? "").split(/\s+/)[0] ?? "";
  const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
  return `${cap(first)} ${cap(last)}`;
}

export interface BuildRaceOptions {
  state: string;
  office: "H" | "S";
  cycle: number;
  congress: number; // e.g. 119
  session: number; // 1 or 2, for Senate LIS vote lookups
  raceSlug: string; // curated/ subdirectory + build output filename, e.g. "house-AL" or "senate"
  outFile: string; // e.g. build/house/DE-AL.json
  district?: string; // 2-digit House district, e.g. "00" for at-large — only used for House races
}

// Exported so a single new race can be built directly (e.g. when adding one
// new state) without re-running every already-published race through
// main() below — those already have current R2 data and gain nothing from
// a rebuild, just wasted API calls and wall-clock time.
export async function buildRace(opts: BuildRaceOptions) {
  const previous = await fetchPreviousRace(opts.outFile);
  const previousCandidates: any[] = previous?.candidates ?? [];

  const allFecCandidates = await searchCandidates(opts.state, opts.office, opts.cycle, opts.office === "H" ? opts.district : undefined);
  // Once a state's primary is certified, narrow to confirmed general-election
  // contenders — see primaryResults.ts for why this can't come from FEC data
  // itself. No filter registered for this race yet (the common case) just
  // means every FEC-registered candidate still shows, exactly as before.
  const primaryFilter = getPrimaryFilter(opts.state, opts.raceSlug, opts.cycle);
  const fecCandidates = primaryFilter
    ? allFecCandidates.filter((c) => primaryFilter.advancingCandidateIds.includes(c.candidateId))
    : allFecCandidates;
  const curated = loadCuratedRace(opts.state, opts.raceSlug);
  const stateMembers = await getMembersByState(opts.state);

  const candidates = await Promise.all(
    fecCandidates.map(async (c) => {
      const slug = slugify(c.name);
      const totals = await getTotals(c.candidateId, opts.cycle);
      const curatedEntry = curated[slug] ?? null;
      const prevCand = previousCandidates.find((p) => p.slug === slug);

      // Match this FEC candidate to a sitting member for bioguideId + roll-call
      // votes. Computed early (not just before performance data, further down)
      // because the House Historian bio lookup below also needs it.
      const matchedMember = c.incumbentChallenge === "Incumbent"
        ? stateMembers.find((m) => normalizeNameForMatch(m.name).includes(normalizeNameForMatch(c.name.split(",")[0])))
        : null;

      const curatedBio = curatedEntry?.bio ?? {};

      // Seed from whatever this candidate's last published build already
      // found. A birthdate, a filed disclosure, a stated platform position —
      // none of that needs re-deriving once correctly resolved, so the
      // waterfall below only chases fields still actually missing instead of
      // re-running every source on every build. This isn't just an
      // efficiency win: re-attempting an already-resolved field means a
      // downstream rate limit or flaky source on a LATER build can silently
      // regress good data back to null — confirmed happening in practice, a
      // same-day Wyoming rebuild wiped out bio facts an earlier run had
      // already found, purely from re-hitting the same sources again within
      // a short window.
      const bio: Record<string, unknown> = { ...(prevCand?.bio ?? {}) };
      const stillMissing = () => EXTRACTABLE_FIELDS.some((f) => !bio[f] && !curatedBio[f]);
      // Platform is one of the two fact types that can genuinely go stale
      // (see resolveWithRefresh above) — "already resolved" here means
      // resolved AND not yet due for a recheck, not just present.
      const platformAlreadyResolved =
        Boolean(prevCand?.platform?.length) && !isDueForRefresh(prevCand?._platform_resolved_at, c.candidateId);

      // Automated quote-anchored extraction (Claude) fills whatever fields
      // aren't already resolved — only runs when curated YAML and the last
      // published build don't already cover a given field, since there's no
      // reason to spend an API call re-deriving a fact already on hand.
      // Every extraction call gets an expectedContext string
      // so the identity check can catch a same-named person who is clearly
      // a different individual (different office/state) — confirmed via a
      // real collision on BallotReady (see that module's comment) where a
      // same-named Oregon/Texas local candidate would otherwise have been
      // silently attributed to a Delaware congressional candidate. Source
      // layers, tried in priority order:
      //  1. House Clerk's Office of the Historian concise bio (House
      //     incumbents only) — a single official government paragraph,
      //     higher-signal than a scraped page, tried first when available.
      //  2. The candidate's own campaign site (FEC committee "website" —
      //     self-reported, often has fields Wikipedia never covers like
      //     high_school, but only ~50% of campaigns fill in that FEC field).
      //  3. Web search, when FEC's field was empty — finds the same kind
      //     of self-reported site FEC's optional field often misses.
      //  4. BallotReady — a voter-guide aggregator with structured
      //     "Degrees"/"Professional Experience" data that covers minor
      //     candidates with no Wikipedia page and no FEC website at all.
      //  5. Wikipedia — broadest coverage, fills whatever's still missing.
      const expectedContext = `a candidate for ${opts.office === "H" ? "U.S. House of Representatives" : "U.S. Senate"} from ${opts.state}`;

      // Discovered once and reused below for platform extraction too.
      let campaignSiteUrl: string | null = null;

      // Everything in this block is skipped entirely once both bio and
      // platform are already resolved from the last published build —
      // see the comment above `bio` for why that matters beyond efficiency.
      if (stillMissing() || !platformAlreadyResolved) {
        // Structured Wikidata facts fill gaps only — curated (manually
        // quote-anchored) fields always take priority when both exist.
        const wikidata = stillMissing() ? await getBioFacts(searchName(c.name)).catch(() => null) : null;
        if (wikidata?.date_of_birth && !bio.date_of_birth) {
          bio.date_of_birth = { value: wikidata.date_of_birth, source_url: wikidata.entityUrl, source_type: "wikidata_structured" };
        }
        if (wikidata?.birthplace && !bio.birthplace) {
          bio.birthplace = { value: wikidata.birthplace, source_url: wikidata.entityUrl, source_type: "wikidata_structured" };
        }
        if (wikidata?.college && !bio.college) {
          bio.college = { value: wikidata.college, source_url: wikidata.entityUrl, source_type: "wikidata_structured" };
        }

        if (matchedMember && opts.office === "H" && stillMissing()) {
          const historianUrl = buildHouseHistorianUrl(matchedMember.name, matchedMember.bioguideId);
          if (historianUrl) {
            const extracted = await extractBioFacts(c.name, historianUrl, expectedContext).catch(() => null);
            if (extracted) mergeExtracted(bio, extracted.bio, extracted.sourceUrl, "llm_extracted_house_historian", curatedBio);
          }
        }

        campaignSiteUrl = await getCommitteeWebsite(c.candidateId).catch(() => null);

        if (stillMissing() && campaignSiteUrl) {
          const extracted = await extractBioFactsFromSite(c.name, campaignSiteUrl, expectedContext).catch(() => null);
          if (extracted) mergeExtracted(bio, extracted.bio, extracted.sourceUrl, "llm_extracted_campaign_site", curatedBio);
        }

        // FEC's website field is optional and often blank even when a real
        // campaign site exists — confirmed by hand: John Whalen's FEC filing
        // has no website, yet whalende.com is a real, substantial site
        // BallotReady and Wikipedia both also missed. Web search finds these
        // when the FEC field comes up empty, with the same identity/context
        // check as every other source here.
        if (!campaignSiteUrl) {
          campaignSiteUrl = await findCampaignWebsite(c.name, expectedContext).catch(() => null);
          if (stillMissing() && campaignSiteUrl) {
            const extracted = await extractBioFactsFromSite(c.name, campaignSiteUrl, expectedContext).catch(() => null);
            if (extracted) mergeExtracted(bio, extracted.bio, extracted.sourceUrl, "llm_extracted_campaign_site_websearch", curatedBio);
          }
        }

        if (stillMissing()) {
          const extracted = await findBallotReadyBio(c.name, c.name, expectedContext).catch(() => null);
          if (extracted) mergeExtracted(bio, extracted.bio, extracted.sourceUrl, "llm_extracted_ballotready", curatedBio);
        }

        if (wikidata?.wikipediaUrl && stillMissing()) {
          const extracted = await extractBioFacts(c.name, wikidata.wikipediaUrl, expectedContext).catch(() => null);
          if (extracted) mergeExtracted(bio, extracted.bio, extracted.sourceUrl, "llm_extracted_wikipedia", curatedBio);
        }
      }

      // curated overrides win
      Object.assign(bio, curatedBio);

      // Stated campaign positions/promises, quoted directly from the
      // candidate's own site — presented as-is, not evaluated or
      // characterized. Held once resolved and re-checked on the
      // REFRESH_BASE_DAYS/jitter schedule (a campaign can genuinely update
      // its stated positions); re-attempted every build when nothing's been
      // found yet, since a candidate with no site today may have one by the
      // next rebuild. Only possible when a campaign site was actually
      // found; correctly absent otherwise, same "no source, no field" rule
      // as everything else in this pipeline.
      const prevPlatform = prevCand?.platform?.length ? { positions: prevCand.platform, sourceUrl: prevCand.platform_source_url } : null;
      const { value: platform, resolvedAt: platformResolvedAt } = await resolveWithRefresh(
        prevPlatform,
        prevCand?._platform_resolved_at,
        c.candidateId,
        () => (campaignSiteUrl ? extractPlatformFromSite(c.name, campaignSiteUrl, expectedContext).catch(() => null) : Promise.resolve(null))
      );

      let recentVotes: Array<{ position: string; sourceUrl: string; [k: string]: unknown }> = [];
      let attendance: { votesInSession: number; votesCast: number; attendanceRate: number } | null = null;
      let committees: Awaited<ReturnType<typeof getCommitteeAssignments>> = [];
      let legislativeActivity: Awaited<ReturnType<typeof getLegislativeActivity>> = null;
      let enactedLaws: Awaited<ReturnType<typeof getEnactedLaws>> = [];
      let ideologyScore: Awaited<ReturnType<typeof getIdeologyScore>> = null;
      let bridgeScore: Awaited<ReturnType<typeof getBridgeScore>> = null;

      if (matchedMember && opts.office === "H") {
        [recentVotes, attendance, committees, legislativeActivity, enactedLaws, ideologyScore, bridgeScore] = await Promise.all([
          getRecentHouseVotes(matchedMember.bioguideId, opts.cycle, 5).catch(() => []),
          getHouseAttendance(matchedMember.bioguideId, opts.cycle).catch(() => null),
          getCommitteeAssignments(matchedMember.bioguideId).catch(() => []),
          getLegislativeActivity(matchedMember.bioguideId).catch(() => null),
          getEnactedLaws(matchedMember.bioguideId).catch(() => []),
          getIdeologyScore(matchedMember.bioguideId, opts.congress).catch(() => null),
          getBridgeScore(matchedMember.bioguideId, "H").catch(() => null),
        ]);
      } else if (matchedMember && opts.office === "S") {
        const lastName = matchedMember.name.split(",")[0].trim();
        [recentVotes, attendance, committees, legislativeActivity, enactedLaws, ideologyScore, bridgeScore] = await Promise.all([
          getRecentSenateVotes(lastName, opts.state, opts.congress, opts.session, 5).catch(() => []),
          getSenateAttendance(lastName, opts.state, opts.congress, opts.session).catch(() => null),
          getCommitteeAssignments(matchedMember.bioguideId).catch(() => []),
          getLegislativeActivity(matchedMember.bioguideId).catch(() => null),
          getEnactedLaws(matchedMember.bioguideId).catch(() => []),
          getIdeologyScore(matchedMember.bioguideId, opts.congress).catch(() => null),
          getBridgeScore(matchedMember.bioguideId, "S").catch(() => null),
        ]);
      }

      return {
        slug,
        full_name: c.name,
        party: c.party,
        incumbent: c.incumbentChallenge === "Incumbent",
        fec_candidate_id: c.candidateId,
        fec_status: c.candidateStatus, // 'C'/'P' = established filer, 'N' = declared but under FEC's $5,000 threshold
        bioguide_id: matchedMember?.bioguideId ?? null,
        financials: totals,
        bio,
        platform: platform?.positions ?? [],
        platform_source_url: platform?.sourceUrl ?? null,
        _platform_resolved_at: platformResolvedAt ?? null,
        financial_disclosure: null as FinancialDisclosureSummary | null, // filled in sequentially below — see comment there
        _financial_disclosure_resolved_at: null as string | null, // filled in sequentially below — see comment there
        recent_votes: recentVotes,
        performance: matchedMember
          ? {
              attendance,
              committees,
              bills_sponsored: legislativeActivity?.billsSponsored ?? null,
              bills_cosponsored: legislativeActivity?.billsCosponsored ?? null,
              bills_became_law: enactedLaws.length,
              enacted_laws: enactedLaws,
              ideology_score: ideologyScore,
              bridge_score: bridgeScore,
            }
          : null,
        _curated_match: Boolean(curatedEntry),
      };
    })
  );

  // Deliberately sequential, not Promise.all — this is by far the heaviest
  // call in the pipeline (fetches a PDF and runs vision extraction on it),
  // and running it concurrently across every candidate reliably triggered
  // rate-limit failures that silently degraded to null (confirmed: identical
  // calls succeeded consistently in isolation, failed under full-build
  // concurrency even with a retry). One at a time avoids that entirely.
  // House-only — see houseFinancialDisclosure.ts module comment for why the
  // Senate equivalent isn't included.
  //
  // Skips a candidate entirely once their disclosure is resolved and not
  // yet due for a recheck (see resolveWithRefresh above — a candidate files
  // a new disclosure roughly annually, so this isn't "never look again,"
  // just "not on every single build"). This is the single most rate-limited
  // call in the whole pipeline (Akamai WAF, confirmed to trip after ~20
  // requests in a short window). Re-attempting already-resolved candidates
  // on every rebuild is both wasted request volume against that limit and,
  // once the limit trips, a way for a later rebuild to regress good data
  // back to null. Only genuinely unresolved or due-for-refresh candidates
  // still get attempted each run.
  if (opts.office === "H" && opts.district) {
    const expectedContext = `a candidate for U.S. House of Representatives from ${opts.state}`;
    for (const cand of candidates) {
      const prevCand = previousCandidates.find((p) => p.slug === cand.slug);
      const { value, resolvedAt } = await resolveWithRefresh(
        prevCand?.financial_disclosure ?? null,
        prevCand?._financial_disclosure_resolved_at,
        cand.fec_candidate_id,
        () => getFinancialDisclosure(cand.full_name, `${opts.state}${opts.district}`, opts.cycle, expectedContext).catch(() => null)
      );
      cand.financial_disclosure = value;
      cand._financial_disclosure_resolved_at = resolvedAt ?? null;
    }
  }

  // State-level context, not attributed to any candidate causally — same
  // for every candidate in this race, so it lives once at the race level.
  const currentYear = new Date().getFullYear();
  const [unemployment, violentCrime, nonfarmEmployment, federalSpending, population, medianIncome] = await Promise.all([
    getUnemploymentRate(opts.state, currentYear - 3, currentYear).catch(() => null),
    getViolentCrimeRate(opts.state, currentYear - 5, currentYear - 1).catch(() => null),
    getNonfarmEmployment(opts.state, currentYear - 3, currentYear).catch(() => null),
    getFederalSpendingByDistrict(opts.state, currentYear - 3, currentYear - 1).catch(() => []),
    getStatePopulation(opts.state, currentYear - 4, currentYear - 1).catch(() => null),
    getMedianHouseholdIncome(opts.state, currentYear - 4, currentYear - 1).catch(() => null),
  ]);
  const previousMetrics = previous?.hard_metrics ?? {};

  const output = {
    state: opts.state,
    office: opts.office,
    cycle: opts.cycle,
    race_slug: opts.raceSlug,
    generated_at: new Date().toISOString(),
    election_dates: getElectionDates(opts.state, opts.cycle),
    state_background_check: getStateBackgroundCheckFact(opts.state, opts.office),
    primary_results: primaryFilter && { source_url: primaryFilter.source_url, snippet: primaryFilter.snippet },
    hard_metrics: {
      unemployment_rate: withFallback(unemployment, previousMetrics.unemployment_rate),
      violent_crime_rate_per_100k: withFallback(violentCrime, previousMetrics.violent_crime_rate_per_100k),
      nonfarm_employment_thousands: withFallback(nonfarmEmployment, previousMetrics.nonfarm_employment_thousands),
      federal_spending: withFallback(federalSpending, previousMetrics.federal_spending),
      population: withFallback(population, previousMetrics.population),
      median_household_income: withFallback(medianIncome, previousMetrics.median_household_income),
    },
    candidates,
  };

  const outPath = join(BUILD_ROOT, opts.outFile);
  mkdirSync(join(outPath, ".."), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outPath} — ${candidates.length} candidates (${candidates.filter((c) => c._curated_match).length} with curated bio data)`);
}

async function main() {
  await buildRace({ state: "DE", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-AL", outFile: "house/DE-AL.json", district: "00" });
  await buildRace({ state: "DE", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/DE.json" });
  await buildRace({ state: "WY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-AL", outFile: "house/WY-AL.json", district: "00" });
  await buildRace({ state: "WY", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/WY.json" });
  // Montana's first genuinely multi-district race — outFile's district number
  // must match the frontend's own format exactly (App.jsx's geocodeAddress
  // strips leading zeros via String(Number(cd)): Census's CD119 "01" becomes
  // the string "1"), or the app requests a filename that doesn't exist.
  await buildRace({ state: "MT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/MT-1.json", district: "01" });
  await buildRace({ state: "MT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/MT-2.json", district: "02" });
  await buildRace({ state: "MT", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/MT.json" });
  // No Senate call: Vermont's two seats (Welch, Sanders) aren't up until
  // 2028 and 2030 respectively — nothing to build for this cycle.
  await buildRace({ state: "VT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-AL", outFile: "house/VT-AL.json", district: "00" });
  // No Senate call: North Dakota's two seats (Hoeven, Cramer) aren't up
  // until 2028.
  await buildRace({ state: "ND", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-AL", outFile: "house/ND-AL.json", district: "00" });
  await buildRace({ state: "SD", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-AL", outFile: "house/SD-AL.json", district: "00" });
  await buildRace({ state: "SD", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/SD.json" });
  // New York: 26 House districts, no Senate call — neither seat is up in
  // 2026 (Gillibrand up 2030, Schumer up 2028). Unlike Montana, NY did NOT
  // redistrict for 2026, so the Census geocoder's current district data is
  // accurate here — confirmed directly before starting this (Texas, which
  // DID redraw its map for 2026, was skipped for exactly this reason: the
  // geocoder still serves its pre-redraw boundaries).
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/NY-1.json", district: "01" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/NY-2.json", district: "02" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/NY-3.json", district: "03" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/NY-4.json", district: "04" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/NY-5.json", district: "05" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/NY-6.json", district: "06" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/NY-7.json", district: "07" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/NY-8.json", district: "08" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/NY-9.json", district: "09" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/NY-10.json", district: "10" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/NY-11.json", district: "11" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/NY-12.json", district: "12" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-13", outFile: "house/NY-13.json", district: "13" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-14", outFile: "house/NY-14.json", district: "14" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-15", outFile: "house/NY-15.json", district: "15" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-16", outFile: "house/NY-16.json", district: "16" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-17", outFile: "house/NY-17.json", district: "17" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-18", outFile: "house/NY-18.json", district: "18" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-19", outFile: "house/NY-19.json", district: "19" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-20", outFile: "house/NY-20.json", district: "20" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-21", outFile: "house/NY-21.json", district: "21" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-22", outFile: "house/NY-22.json", district: "22" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-23", outFile: "house/NY-23.json", district: "23" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-24", outFile: "house/NY-24.json", district: "24" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-25", outFile: "house/NY-25.json", district: "25" });
  await buildRace({ state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-26", outFile: "house/NY-26.json", district: "26" });
  // Georgia — 14 House districts + Senate. Confirmed 2026 kept the
  // existing map (Gov. Kemp declined a mid-decade redraw), so unlike
  // Texas the geocoder is accurate here. GA-13 and GA-14 both had a
  // mid-term vacancy handled via a SEPARATE special election, distinct
  // from the regular buildRace() calls below — see primaryResults.ts.
  await buildRace({ state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/GA-1.json", district: "01" });
  await buildRace({ state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/GA-2.json", district: "02" });
  await buildRace({ state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/GA-3.json", district: "03" });
  await buildRace({ state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/GA-4.json", district: "04" });
  await buildRace({ state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/GA-5.json", district: "05" });
  await buildRace({ state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/GA-6.json", district: "06" });
  await buildRace({ state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/GA-7.json", district: "07" });
  await buildRace({ state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/GA-8.json", district: "08" });
  await buildRace({ state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/GA-9.json", district: "09" });
  await buildRace({ state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/GA-10.json", district: "10" });
  await buildRace({ state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/GA-11.json", district: "11" });
  await buildRace({ state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/GA-12.json", district: "12" });
  await buildRace({ state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-13", outFile: "house/GA-13.json", district: "13" });
  await buildRace({ state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-14", outFile: "house/GA-14.json", district: "14" });
  await buildRace({ state: "GA", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/GA.json" });
  // Pennsylvania — 17 House districts, no Senate race this cycle (Fetterman
  // up 2028, McCormick up 2030). No 2026 redistricting (2022 Carter map
  // stable through 2030) and the geocoder returns current 119th-CD data
  // cleanly, confirmed against a real Philadelphia address. PA-3 is a normal
  // open-seat retirement (Dwight Evans, announced 2025-06-30) — no special-
  // election complexity like Georgia's 13th/14th.
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/PA-1.json", district: "01" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/PA-2.json", district: "02" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/PA-3.json", district: "03" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/PA-4.json", district: "04" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/PA-5.json", district: "05" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/PA-6.json", district: "06" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/PA-7.json", district: "07" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/PA-8.json", district: "08" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/PA-9.json", district: "09" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/PA-10.json", district: "10" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/PA-11.json", district: "11" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/PA-12.json", district: "12" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-13", outFile: "house/PA-13.json", district: "13" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-14", outFile: "house/PA-14.json", district: "14" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-15", outFile: "house/PA-15.json", district: "15" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-16", outFile: "house/PA-16.json", district: "16" });
  await buildRace({ state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-17", outFile: "house/PA-17.json", district: "17" });
  // Michigan — 13 House districts + Senate (Peters open-seat retirement).
  // No 2026 redistricting (2022 independent-commission "Chestnut" map
  // stable), geocoder confirmed current against a real Detroit address.
  // Three open House seats (MI-10, MI-11, MI-13), all ordinary — no death/
  // resignation vacancy or parallel special election like Georgia's; see
  // primaryResults.ts for details including the Baker same-surname trap
  // and the Campbell party-mismatch exclusion in MI-13.
  await buildRace({ state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/MI-1.json", district: "01" });
  await buildRace({ state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/MI-2.json", district: "02" });
  await buildRace({ state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/MI-3.json", district: "03" });
  await buildRace({ state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/MI-4.json", district: "04" });
  await buildRace({ state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/MI-5.json", district: "05" });
  await buildRace({ state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/MI-6.json", district: "06" });
  await buildRace({ state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/MI-7.json", district: "07" });
  await buildRace({ state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/MI-8.json", district: "08" });
  await buildRace({ state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/MI-9.json", district: "09" });
  await buildRace({ state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/MI-10.json", district: "10" });
  await buildRace({ state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/MI-11.json", district: "11" });
  await buildRace({ state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/MI-12.json", district: "12" });
  await buildRace({ state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-13", outFile: "house/MI-13.json", district: "13" });
  await buildRace({ state: "MI", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/MI.json" });
}

// Guarded so importing buildRace() elsewhere (e.g. a one-off script that
// builds a single new race without re-running every already-published one)
// doesn't ALSO trigger this full run as an import side effect — confirmed
// this actually happened: a targeted single-state script that imported
// buildRace from this file silently kicked off a full concurrent main() too,
// racing its own calls and wasting real API calls against rate-limited
// sources for no reason.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
