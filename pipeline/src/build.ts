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
import { findCampaignVideoFromSite } from "./sources/campaignVideo.js";
import { extractBioSummaryFromSite } from "./sources/campaignBioSummary.js";
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
import { getVotingSystem } from "./sources/votingSystem.js";

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

// Confirmed real: congress.gov lists CA-44's incumbent as "Barragán, Nanette
// Diaz" (with an accented á) while FEC's own record spells it "BARRAGAN"
// (plain ASCII) -- the old plain [^a-z\s] strip DELETES an unmatched
// accented letter outright rather than transliterating it, turning
// "barragán" into "barragn" (the á vanishes, closing the gap), which then
// never contains "barragan" as a substring. NFD-normalizing first splits
// each accented character into its base letter + a separate combining
// mark, so stripping the marks converts "á" to a real "a" instead of
// deleting it -- correct for any Latin-script name, not just this one case.
function normalizeNameForMatch(name: string): string {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim();
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

// FEC's legal first name often isn't the name a politician actually goes by
// (Charles → Chuck, Robert → Bob) — confirmed empirically: Rep. Chuck
// Fleischmann's Wikidata entity is labeled "Chuck Fleischmann", and searching
// "Charles Fleischmann" (his FEC legal name) returns zero relevant hits. That
// silently starves both the structured Wikidata fields AND Wikipedia
// extraction (which only runs off wikidata.wikipediaUrl, see below) for every
// candidate with this kind of mismatch — same pattern reproduced for Bob
// Latta and Don Beyer. Common English nickname variants, not exhaustive,
// tried as a fallback only when the legal-name search comes up empty.
const COMMON_NICKNAMES: Record<string, string[]> = {
  robert: ["bob", "rob", "bobby"],
  william: ["bill", "will", "billy"],
  james: ["jim", "jimmy"],
  john: ["jack", "johnny"],
  richard: ["rick", "dick", "richie"],
  charles: ["chuck", "charlie"],
  michael: ["mike", "mikey"],
  christopher: ["chris"],
  daniel: ["dan", "danny"],
  david: ["dave"],
  joseph: ["joe", "joey"],
  thomas: ["tom", "tommy"],
  donald: ["don", "donnie"],
  anthony: ["tony"],
  kenneth: ["ken", "kenny"],
  steven: ["steve"],
  stephen: ["steve"],
  edward: ["ed", "eddie", "ted"],
  timothy: ["tim", "timmy"],
  benjamin: ["ben", "benny"],
  samuel: ["sam", "sammy"],
  gregory: ["greg"],
  patrick: ["pat"],
  nicholas: ["nick"],
  jonathan: ["jon"],
  matthew: ["matt"],
  andrew: ["andy", "drew"],
  peter: ["pete"],
  douglas: ["doug"],
  ronald: ["ron", "ronnie"],
  lawrence: ["larry"],
  frederick: ["fred", "freddie"],
  theodore: ["ted", "teddy"],
  walter: ["walt"],
  raymond: ["ray"],
  eugene: ["gene"],
  jeffrey: ["jeff"],
  gerald: ["jerry"],
  harold: ["harry"],
  albert: ["al"],
  alexander: ["alex"],
  vincent: ["vince"],
  philip: ["phil"],
  phillip: ["phil"],
  nathaniel: ["nathan", "nate"],
  zachary: ["zach", "zack"],
  elizabeth: ["liz", "beth", "betty"],
  katherine: ["kathy", "kate", "katie"],
  kathleen: ["kathy", "kate"],
  margaret: ["peggy", "maggie", "meg"],
  deborah: ["debbie", "deb"],
  cynthia: ["cindy"],
  patricia: ["pat", "patty"],
  susan: ["sue", "susie"],
  jennifer: ["jen", "jenny"],
  rebecca: ["becky"],
  barbara: ["barb", "barbie"],
  cathleen: ["kathy"],
  christine: ["chris", "christy"],
  victoria: ["vicky", "tori"],
};

// Wikidata's search API matches almost nothing against FEC's raw
// "LAST, FIRST MIDDLE SUFFIX" format — needs a normal "First Last" query.
// Most records list "FIRST MIDDLE..." and token[0] is the right name, but
// some (Rep. Shontel Brown -> "M SHONTEL", Rep. Troy Balderson -> "WILLIAM
// TROY", Sen. Jon Ossoff -> "T. JONATHAN") list a middle initial or an
// unused legal first name before the name the person actually goes by —
// confirmed empirically for all three. Tries token[0] first (unchanged
// priority/behavior from before), then token[1] as a fallback when it's not
// itself a bare initial, each expanded with known nickname variants.
function searchNameVariants(fecName: string): string[] {
  const [last, rest] = fecName.split(",").map((s) => s.trim());
  const tokens = (rest ?? "").split(/\s+/).filter(Boolean);
  const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
  const isBareInitial = (t: string) => t.replace(/\./g, "").length <= 1;

  const candidateFirsts = [tokens[0], tokens[1]].filter(
    (t, i, arr): t is string => Boolean(t) && !isBareInitial(t) && arr.indexOf(t) === i
  );
  const firstNames = candidateFirsts.flatMap((f) => [f, ...(COMMON_NICKNAMES[f.toLowerCase()] ?? [])]);
  return firstNames.map((f) => `${cap(f.replace(/\.$/, ""))} ${cap(last)}`);
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
export async function buildRace(opts: BuildRaceOptions): Promise<{ flags: string[] }> {
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

  // Safety net for the "confirmed candidate quietly stopped being real"
  // case (withdrawal, disqualification, a late substitution) — learned
  // from Maine's Senate race, where the certified primary winner withdrew
  // and was replaced by a state-party convention pick weeks later. This
  // doesn't try to guess who a replacement is (that still needs the same
  // manual research pass every primary-results update has needed) — it
  // only notices that FEC's own fresh data no longer backs up what
  // primaryResults.ts currently asserts, and says so loudly rather than
  // silently rebuilding a stale roster forever. Real limitation worth
  // knowing: FEC's own records often lag a real-world withdrawal by weeks,
  // so this is a periodic safety net that catches it once FEC's data
  // catches up, not a same-day news alert.
  const flags: string[] = [];
  if (primaryFilter) {
    const activeIds = new Set(allFecCandidates.map((c) => c.candidateId));
    const missingIds = primaryFilter.advancingCandidateIds.filter((id) => !activeIds.has(id));
    if (missingIds.length) {
      const msg = `${opts.state} ${opts.raceSlug}: confirmed candidate(s) ${missingIds.join(", ")} no longer appear in FEC's active results for this race (status changed, or record no longer matches this cycle) — possible withdrawal, disqualification, or replacement. Worth a manual check against primaryResults.ts.`;
      flags.push(msg);
      console.warn(`[primaryResultsFlag] ${msg}`);
    }
  }
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
      // Same idea, for the campaign-video field — its own condition in
      // the gate below, not just riding on platform's, because
      // campaignSiteUrl (which video resolution also needs) is only
      // populated inside that gate. Once bio AND platform are both
      // already stable — the steady state this feature reaches once it's
      // been running a while — a gate keyed on those two alone would stay
      // permanently closed and video would silently never get a URL to
      // work with again, even when it specifically is due for a recheck.
      const videoAlreadyResolved =
        Boolean(prevCand?.platform_video_url) && !isDueForRefresh(prevCand?._platform_video_resolved_at, c.candidateId);
      // Same reasoning again, for the campaign-site bio-summary field.
      const bioSummaryAlreadyResolved =
        Boolean(prevCand?.bio_summary?.value) && !isDueForRefresh(prevCand?._bio_summary_resolved_at, c.candidateId);

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
      //  2. Wikipedia, keyed off the Wikidata entity already confirmed above
      //     via looksLikeAPolitician — the identity is established before
      //     this URL is even constructed, not guessed, so it's tried right
      //     after House Historian rather than last.
      //  3. The candidate's own campaign site (FEC committee "website" —
      //     self-reported, often has fields Wikipedia never covers like
      //     high_school, but only ~50% of campaigns fill in that FEC field).
      //  4. Web search, when FEC's field was empty — finds the same kind
      //     of self-reported site FEC's optional field often misses.
      //  5. BallotReady — a voter-guide aggregator with structured
      //     "Degrees"/"Professional Experience" data that covers minor
      //     candidates with no Wikipedia page and no FEC website at all.
      //     Tried last: unlike every source above, its URL is a guessed
      //     slug rather than one anchored to an already-confirmed identity,
      //     and that guessing has a confirmed same-name collision failure
      //     mode (see that module's own comment) — the extractBioFacts
      //     identity check is the only backstop, and it isn't foolproof:
      //     confirmed missing an unambiguous office+state mismatch once
      //     (Rep. Chuck Fleischmann of TN vs. a same-named PA township
      //     supervisor, both explicitly stated on the wrongly-matched
      //     page). Running it last, after safer sources have already had
      //     first crack at every field, minimizes how often it gets
      //     reached at all.
      const expectedContext = `a candidate for ${opts.office === "H" ? "U.S. House of Representatives" : "U.S. Senate"} from ${opts.state}`;

      // Discovered once and reused below for platform extraction too.
      let campaignSiteUrl: string | null = null;

      // Everything in this block is skipped entirely once both bio and
      // platform are already resolved from the last published build —
      // see the comment above `bio` for why that matters beyond efficiency.
      if (stillMissing() || !platformAlreadyResolved || !videoAlreadyResolved || !bioSummaryAlreadyResolved) {
        // Structured Wikidata facts fill gaps only — curated (manually
        // quote-anchored) fields always take priority when both exist.
        let wikidata: Awaited<ReturnType<typeof getBioFacts>> = null;
        if (stillMissing()) {
          for (const nameVariant of searchNameVariants(c.name)) {
            wikidata = await getBioFacts(nameVariant).catch(() => null);
            if (wikidata) break;
          }
        }
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

        if (wikidata?.wikipediaUrl && stillMissing()) {
          const extracted = await extractBioFacts(c.name, wikidata.wikipediaUrl, expectedContext).catch(() => null);
          if (extracted) mergeExtracted(bio, extracted.bio, extracted.sourceUrl, "llm_extracted_wikipedia", curatedBio);
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

      // Tier 1 only: a video found exclusively via a link already on the
      // candidate's own site — see campaignVideo.ts. Checks the platform
      // page too (once resolved above), since a "watch my plan" link is
      // at least as likely to live there as on the bare homepage.
      // tier carried through explicitly — without it, a HELD Tier 2 result
      // (scaleVideoTier2.ts, no site to anchor identity to) would get
      // silently relabeled as Tier 1 on this routine's next refresh cycle,
      // since a fresh Tier-1-only findCampaignVideoFromSite() attempt
      // finding nothing new just falls back to the existing seed here —
      // correctly keeps the URL, but the seed needs its own tier to keep
      // that fallback honest too.
      const prevVideo = prevCand?.platform_video_url
        ? {
            videoId: "",
            videoUrl: prevCand.platform_video_url,
            videoTitle: prevCand.platform_video_title,
            sourceUrl: prevCand.platform_video_source_url,
            tier: prevCand.platform_video_tier ?? 1,
          }
        : null;
      const { value: video, resolvedAt: videoResolvedAt } = await resolveWithRefresh(
        prevVideo,
        prevCand?._platform_video_resolved_at,
        c.candidateId,
        () =>
          campaignSiteUrl
            ? findCampaignVideoFromSite(campaignSiteUrl, c.name, platform?.sourceUrl)
                .then((r) => (r ? { ...r, tier: 1 as const } : null))
                .catch(() => null)
            : Promise.resolve(null)
      );

      // A single representative, verbatim excerpt from the candidate's own
      // site introducing who they are — deliberately separate from bio[]
      // above (which is also sourced from House Historian/Wikipedia, not
      // just the campaign site) and from platform[] (their stated
      // positions, not their personal background). "In their own words"
      // framing, same posture as platform: presented as-is, not
      // characterized by Ballot-Wise.
      const prevBioSummary = prevCand?.bio_summary?.value ? { summary: prevCand.bio_summary.value, sourceUrl: prevCand.bio_summary.source_url } : null;
      const { value: bioSummary, resolvedAt: bioSummaryResolvedAt } = await resolveWithRefresh(
        prevBioSummary,
        prevCand?._bio_summary_resolved_at,
        c.candidateId,
        () => (campaignSiteUrl ? extractBioSummaryFromSite(c.name, campaignSiteUrl, expectedContext).catch(() => null) : Promise.resolve(null))
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
        // Published in its own right, not just used internally for platform
        // and video extraction — previously this was computed and then
        // discarded every run unless it happened to also produce a bio fact
        // or platform statement, so a real, found site was invisible to
        // anything reading only the published JSON (e.g. scaleVideoOnly.ts)
        // whenever extraction from it came up empty. Held forward like bio/
        // platform/financials: a later rebuild whose gate stays closed (bio,
        // platform, AND video already resolved) shouldn't silently erase an
        // already-known site.
        campaign_site_url: campaignSiteUrl ?? prevCand?.campaign_site_url ?? null,
        platform_video_url: video?.videoUrl ?? null,
        platform_video_title: video?.videoTitle ?? null,
        platform_video_source_url: video?.sourceUrl ?? null,
        platform_video_tier: video?.tier ?? null,
        _platform_video_resolved_at: videoResolvedAt ?? null,
        // Nested {value, source_url}, matching every field in bio{} above —
        // not flat top-level fields — so the frontend's existing SourcedField
        // component (built for exactly that shape) can render this without
        // a one-off renderer.
        bio_summary: bioSummary ? { value: bioSummary.summary, source_url: bioSummary.sourceUrl } : null,
        _bio_summary_resolved_at: bioSummaryResolvedAt ?? null,
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
    election_dates: getElectionDates(opts.state, opts.cycle, opts.raceSlug),
    state_background_check: getStateBackgroundCheckFact(opts.state, opts.office),
    voting_system: getVotingSystem(opts.state, opts.cycle, opts.raceSlug),
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
  return { flags };
}

// Every currently-published race. main() just iterates this; CI's
// matrix build (planMatrix.ts) chunks it the same way so the plan and
// each cell's actual work can never drift apart.
export const RACES: BuildRaceOptions[] = [
  // Senate deliberately not added yet: the top-4 primary's 4th slot
  // (Leslie vs. Heikes) is a live, already-observed-flipping toss-up —
  // see the ALASKA_2026_PRIMARY comment in primaryResults.ts. House only.
  { state: "AK", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-AL", outFile: "house/AK-AL.json", district: "00" },
  { state: "DE", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-AL", outFile: "house/DE-AL.json", district: "00" },
  { state: "DE", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/DE.json" },
  { state: "WY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-AL", outFile: "house/WY-AL.json", district: "00" },
  { state: "WY", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/WY.json" },
  // Montana's first genuinely multi-district race — outFile's district number
  // must match the frontend's own format exactly (App.jsx's geocodeAddress
  // strips leading zeros via String(Number(cd)): Census's CD119 "01" becomes
  // the string "1"), or the app requests a filename that doesn't exist.
  { state: "MT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/MT-1.json", district: "01" },
  { state: "MT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/MT-2.json", district: "02" },
  { state: "MT", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/MT.json" },
  // No Senate call: Vermont's two seats (Welch, Sanders) aren't up until
  // 2028 and 2030 respectively — nothing to build for this cycle.
  { state: "VT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-AL", outFile: "house/VT-AL.json", district: "00" },
  // No Senate call: North Dakota's two seats (Hoeven, Cramer) aren't up
  // until 2028.
  { state: "ND", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-AL", outFile: "house/ND-AL.json", district: "00" },
  { state: "SD", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-AL", outFile: "house/SD-AL.json", district: "00" },
  { state: "SD", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/SD.json" },
  // New York: 26 House districts, no Senate call — neither seat is up in
  // 2026 (Gillibrand up 2030, Schumer up 2028). Unlike Montana, NY did NOT
  // redistrict for 2026, so the Census geocoder's current district data is
  // accurate here — confirmed directly before starting this (Texas, which
  // DID redraw its map for 2026, was skipped for exactly this reason: the
  // geocoder still serves its pre-redraw boundaries).
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/NY-1.json", district: "01" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/NY-2.json", district: "02" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/NY-3.json", district: "03" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/NY-4.json", district: "04" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/NY-5.json", district: "05" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/NY-6.json", district: "06" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/NY-7.json", district: "07" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/NY-8.json", district: "08" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/NY-9.json", district: "09" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/NY-10.json", district: "10" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/NY-11.json", district: "11" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/NY-12.json", district: "12" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-13", outFile: "house/NY-13.json", district: "13" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-14", outFile: "house/NY-14.json", district: "14" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-15", outFile: "house/NY-15.json", district: "15" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-16", outFile: "house/NY-16.json", district: "16" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-17", outFile: "house/NY-17.json", district: "17" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-18", outFile: "house/NY-18.json", district: "18" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-19", outFile: "house/NY-19.json", district: "19" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-20", outFile: "house/NY-20.json", district: "20" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-21", outFile: "house/NY-21.json", district: "21" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-22", outFile: "house/NY-22.json", district: "22" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-23", outFile: "house/NY-23.json", district: "23" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-24", outFile: "house/NY-24.json", district: "24" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-25", outFile: "house/NY-25.json", district: "25" },
  { state: "NY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-26", outFile: "house/NY-26.json", district: "26" },
  // Georgia — 14 House districts + Senate. Confirmed 2026 kept the
  // existing map (Gov. Kemp declined a mid-decade redraw), so unlike
  // Texas the geocoder is accurate here. GA-13 and GA-14 both had a
  // mid-term vacancy handled via a SEPARATE special election, distinct
  // from the regular buildRace() calls below — see primaryResults.ts.
  { state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/GA-1.json", district: "01" },
  { state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/GA-2.json", district: "02" },
  { state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/GA-3.json", district: "03" },
  { state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/GA-4.json", district: "04" },
  { state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/GA-5.json", district: "05" },
  { state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/GA-6.json", district: "06" },
  { state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/GA-7.json", district: "07" },
  { state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/GA-8.json", district: "08" },
  { state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/GA-9.json", district: "09" },
  { state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/GA-10.json", district: "10" },
  { state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/GA-11.json", district: "11" },
  { state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/GA-12.json", district: "12" },
  { state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-13", outFile: "house/GA-13.json", district: "13" },
  { state: "GA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-14", outFile: "house/GA-14.json", district: "14" },
  { state: "GA", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/GA.json" },
  // Pennsylvania — 17 House districts, no Senate race this cycle (Fetterman
  // up 2028, McCormick up 2030). No 2026 redistricting (2022 Carter map
  // stable through 2030) and the geocoder returns current 119th-CD data
  // cleanly, confirmed against a real Philadelphia address. PA-3 is a normal
  // open-seat retirement (Dwight Evans, announced 2025-06-30) — no special-
  // election complexity like Georgia's 13th/14th.
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/PA-1.json", district: "01" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/PA-2.json", district: "02" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/PA-3.json", district: "03" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/PA-4.json", district: "04" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/PA-5.json", district: "05" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/PA-6.json", district: "06" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/PA-7.json", district: "07" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/PA-8.json", district: "08" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/PA-9.json", district: "09" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/PA-10.json", district: "10" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/PA-11.json", district: "11" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/PA-12.json", district: "12" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-13", outFile: "house/PA-13.json", district: "13" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-14", outFile: "house/PA-14.json", district: "14" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-15", outFile: "house/PA-15.json", district: "15" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-16", outFile: "house/PA-16.json", district: "16" },
  { state: "PA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-17", outFile: "house/PA-17.json", district: "17" },
  // Michigan — 13 House districts + Senate (Peters open-seat retirement).
  // No 2026 redistricting (2022 independent-commission "Chestnut" map
  // stable), geocoder confirmed current against a real Detroit address.
  // Three open House seats (MI-10, MI-11, MI-13), all ordinary — no death/
  // resignation vacancy or parallel special election like Georgia's; see
  // primaryResults.ts for details including the Baker same-surname trap
  // and the Campbell party-mismatch exclusion in MI-13.
  { state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/MI-1.json", district: "01" },
  { state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/MI-2.json", district: "02" },
  { state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/MI-3.json", district: "03" },
  { state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/MI-4.json", district: "04" },
  { state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/MI-5.json", district: "05" },
  { state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/MI-6.json", district: "06" },
  { state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/MI-7.json", district: "07" },
  { state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/MI-8.json", district: "08" },
  { state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/MI-9.json", district: "09" },
  { state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/MI-10.json", district: "10" },
  { state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/MI-11.json", district: "11" },
  { state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/MI-12.json", district: "12" },
  { state: "MI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-13", outFile: "house/MI-13.json", district: "13" },
  { state: "MI", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/MI.json" },
  // Arizona — 9 House districts, no Senate race this cycle. Primary already
  // certified July 21, 2026 (moved up by HB 2022). No 2026 redistricting.
  // AZ-07's Adelita Grijalva is the regular incumbent, not a special-
  // election trap — her late father's seat's special election already
  // resolved Sept 2025, well before this state was added; see
  // primaryResults.ts for the full explanation and the AZ-03 party-mismatch
  // exclusion (Alan Aversa).
  { state: "AZ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/AZ-1.json", district: "01" },
  { state: "AZ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/AZ-2.json", district: "02" },
  { state: "AZ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/AZ-3.json", district: "03" },
  { state: "AZ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/AZ-4.json", district: "04" },
  { state: "AZ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/AZ-5.json", district: "05" },
  { state: "AZ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/AZ-6.json", district: "06" },
  { state: "AZ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/AZ-7.json", district: "07" },
  { state: "AZ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/AZ-8.json", district: "08" },
  { state: "AZ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/AZ-9.json", district: "09" },
  // Kentucky — 6 House districts + open Senate seat (McConnell retiring).
  // No 2026 redistricting. Two ordinary open seats, no vacancy: KY-4
  // (Massie lost his own primary) and KY-6 (Barr ran for Senate instead).
  // First state added via the batched multi-agent workflow (batch 1/4 of
  // the post-pilot scale-up) — see primaryResults.ts for the KY-6 reversed-
  // FEC-name case (Jay Bowman).
  { state: "KY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/KY-1.json", district: "01" },
  { state: "KY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/KY-2.json", district: "02" },
  { state: "KY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/KY-3.json", district: "03" },
  { state: "KY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/KY-4.json", district: "04" },
  { state: "KY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/KY-5.json", district: "05" },
  { state: "KY", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/KY-6.json", district: "06" },
  { state: "KY", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/KY.json" },
  // Colorado — 8 House districts + Senate (Hickenlooper seeking re-election).
  // No 2026 redistricting. One open seat: CO-1's Diana DeGette lost her
  // primary to Melat Kiros. CO-4's Lauren Boebert genuinely switched
  // districts (not just a renumbering) — see primaryResults.ts.
  { state: "CO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/CO-1.json", district: "01" },
  { state: "CO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/CO-2.json", district: "02" },
  { state: "CO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/CO-3.json", district: "03" },
  { state: "CO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/CO-4.json", district: "04" },
  { state: "CO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/CO-5.json", district: "05" },
  { state: "CO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/CO-6.json", district: "06" },
  { state: "CO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/CO-7.json", district: "07" },
  { state: "CO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/CO-8.json", district: "08" },
  { state: "CO", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/CO.json" },
  // Illinois — 17 House districts + open Senate seat (Durbin retiring).
  // No 2026 redistricting. Five open seats (IL-02, IL-04, IL-07, IL-08,
  // IL-09), all ordinary retirements or Senate runs — see primaryResults.ts
  // for IL-04's live, unresolved ballot-access lawsuit (Sigcho-Lopez).
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/IL-1.json", district: "01" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/IL-2.json", district: "02" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/IL-3.json", district: "03" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/IL-4.json", district: "04" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/IL-5.json", district: "05" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/IL-6.json", district: "06" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/IL-7.json", district: "07" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/IL-8.json", district: "08" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/IL-9.json", district: "09" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/IL-10.json", district: "10" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/IL-11.json", district: "11" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/IL-12.json", district: "12" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-13", outFile: "house/IL-13.json", district: "13" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-14", outFile: "house/IL-14.json", district: "14" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-15", outFile: "house/IL-15.json", district: "15" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-16", outFile: "house/IL-16.json", district: "16" },
  { state: "IL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-17", outFile: "house/IL-17.json", district: "17" },
  { state: "IL", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/IL.json" },
  // Batch 2 of the post-pilot scale-up: Arkansas, Connecticut, Indiana,
  // Iowa, Minnesota, New Jersey. No 2026 redistricting in any of these.
  // Tennessee (also in this batch) was excluded for active unresolved
  // redistricting litigation — not built. See primaryResults.ts for
  // per-state notes (Connecticut's fresh Larson primary defeat, Indiana's
  // corrupted-FEC-data exclusion, New Jersey's Menendez Sr./Jr. collision
  // and resolved NJ-11 vacancy).
  { state: "AR", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/AR-1.json", district: "01" },
  { state: "AR", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/AR-2.json", district: "02" },
  { state: "AR", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/AR-3.json", district: "03" },
  { state: "AR", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/AR-4.json", district: "04" },
  { state: "AR", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/AR.json" },
  { state: "CT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/CT-1.json", district: "01" },
  { state: "CT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/CT-2.json", district: "02" },
  { state: "CT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/CT-3.json", district: "03" },
  { state: "CT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/CT-4.json", district: "04" },
  { state: "CT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/CT-5.json", district: "05" },
  { state: "IN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/IN-1.json", district: "01" },
  { state: "IN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/IN-2.json", district: "02" },
  { state: "IN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/IN-3.json", district: "03" },
  { state: "IN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/IN-4.json", district: "04" },
  { state: "IN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/IN-5.json", district: "05" },
  { state: "IN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/IN-6.json", district: "06" },
  { state: "IN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/IN-7.json", district: "07" },
  { state: "IN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/IN-8.json", district: "08" },
  { state: "IN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/IN-9.json", district: "09" },
  { state: "IA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/IA-1.json", district: "01" },
  { state: "IA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/IA-2.json", district: "02" },
  { state: "IA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/IA-3.json", district: "03" },
  { state: "IA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/IA-4.json", district: "04" },
  { state: "IA", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/IA.json" },
  { state: "MN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/MN-1.json", district: "01" },
  { state: "MN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/MN-2.json", district: "02" },
  { state: "MN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/MN-3.json", district: "03" },
  { state: "MN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/MN-4.json", district: "04" },
  { state: "MN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/MN-5.json", district: "05" },
  { state: "MN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/MN-6.json", district: "06" },
  { state: "MN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/MN-7.json", district: "07" },
  { state: "MN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/MN-8.json", district: "08" },
  { state: "MN", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/MN.json" },
  { state: "NJ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/NJ-1.json", district: "01" },
  { state: "NJ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/NJ-2.json", district: "02" },
  { state: "NJ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/NJ-3.json", district: "03" },
  { state: "NJ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/NJ-4.json", district: "04" },
  { state: "NJ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/NJ-5.json", district: "05" },
  { state: "NJ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/NJ-6.json", district: "06" },
  { state: "NJ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/NJ-7.json", district: "07" },
  { state: "NJ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/NJ-8.json", district: "08" },
  { state: "NJ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/NJ-9.json", district: "09" },
  { state: "NJ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/NJ-10.json", district: "10" },
  { state: "NJ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/NJ-11.json", district: "11" },
  { state: "NJ", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/NJ-12.json", district: "12" },
  { state: "NJ", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/NJ.json" },
  { state: "HI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/HI-1.json", district: "01" },
  { state: "HI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/HI-2.json", district: "02" },
  { state: "ID", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/ID-1.json", district: "01" },
  { state: "ID", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/ID-2.json", district: "02" },
  { state: "ID", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/ID.json" },
  { state: "KS", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/KS-1.json", district: "01" },
  { state: "KS", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/KS-2.json", district: "02" },
  { state: "KS", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/KS-3.json", district: "03" },
  { state: "KS", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/KS-4.json", district: "04" },
  { state: "KS", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/KS.json" },
  { state: "NE", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/NE-1.json", district: "01" },
  { state: "NE", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/NE-2.json", district: "02" },
  { state: "NE", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/NE-3.json", district: "03" },
  { state: "NE", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/NE.json" },
  { state: "NV", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/NV-1.json", district: "01" },
  { state: "NV", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/NV-2.json", district: "02" },
  { state: "NV", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/NV-3.json", district: "03" },
  { state: "NV", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/NV-4.json", district: "04" },
  { state: "OK", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/OK-1.json", district: "01" },
  { state: "OK", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/OK-2.json", district: "02" },
  { state: "OK", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/OK-3.json", district: "03" },
  { state: "OK", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/OK-4.json", district: "04" },
  { state: "OK", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/OK-5.json", district: "05" },
  // OK Senate deliberately NOT built yet: Democratic nominee (Priest vs.
  // Thomas) is unresolved until the Aug 25, 2026 runoff. NV has no Senate
  // race in 2026.
  { state: "MD", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/MD-1.json", district: "01" },
  { state: "MD", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/MD-2.json", district: "02" },
  { state: "MD", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/MD-3.json", district: "03" },
  { state: "MD", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/MD-4.json", district: "04" },
  { state: "MD", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/MD-5.json", district: "05" },
  { state: "MD", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/MD-6.json", district: "06" },
  { state: "MD", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/MD-7.json", district: "07" },
  { state: "MD", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/MD-8.json", district: "08" },
  { state: "MS", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/MS-1.json", district: "01" },
  { state: "MS", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/MS-2.json", district: "02" },
  { state: "MS", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/MS-3.json", district: "03" },
  { state: "MS", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/MS-4.json", district: "04" },
  { state: "MS", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/MS.json" },
  { state: "NM", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/NM-1.json", district: "01" },
  { state: "NM", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/NM-2.json", district: "02" },
  { state: "NM", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/NM-3.json", district: "03" },
  { state: "NM", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/NM.json" },
  { state: "OR", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/OR-1.json", district: "01" },
  { state: "OR", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/OR-2.json", district: "02" },
  { state: "OR", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/OR-3.json", district: "03" },
  { state: "OR", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/OR-4.json", district: "04" },
  { state: "OR", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/OR-5.json", district: "05" },
  { state: "OR", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/OR-6.json", district: "06" },
  { state: "OR", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/OR.json" },
  { state: "SC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/SC-1.json", district: "01" },
  { state: "SC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/SC-2.json", district: "02" },
  { state: "SC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/SC-3.json", district: "03" },
  { state: "SC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/SC-4.json", district: "04" },
  { state: "SC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/SC-5.json", district: "05" },
  { state: "SC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/SC-6.json", district: "06" },
  { state: "SC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/SC-7.json", district: "07" },
  // SC Senate deliberately NOT built: Republican runoff (Graham-Nordone vs. Norman) pending 2026-08-25.
  { state: "VA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/VA-1.json", district: "01" },
  { state: "VA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/VA-2.json", district: "02" },
  { state: "VA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/VA-3.json", district: "03" },
  { state: "VA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/VA-4.json", district: "04" },
  { state: "VA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/VA-5.json", district: "05" },
  { state: "VA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/VA-6.json", district: "06" },
  { state: "VA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/VA-7.json", district: "07" },
  { state: "VA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/VA-8.json", district: "08" },
  { state: "VA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/VA-9.json", district: "09" },
  { state: "VA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/VA-10.json", district: "10" },
  { state: "VA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/VA-11.json", district: "11" },
  { state: "VA", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/VA.json" },
  { state: "WV", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/WV-1.json", district: "01" },
  { state: "WV", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/WV-2.json", district: "02" },
  { state: "WV", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/WV.json" },
  { state: "WI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/WI-1.json", district: "01" },
  { state: "WI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/WI-2.json", district: "02" },
  { state: "WI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/WI-3.json", district: "03" },
  { state: "WI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/WI-4.json", district: "04" },
  { state: "WI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/WI-5.json", district: "05" },
  { state: "WI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/WI-6.json", district: "06" },
  { state: "WI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/WI-7.json", district: "07" },
  { state: "WI", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/WI-8.json", district: "08" },
  { state: "NC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/NC-1.json", district: "01" },
  { state: "NC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/NC-2.json", district: "02" },
  { state: "NC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/NC-3.json", district: "03" },
  { state: "NC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/NC-4.json", district: "04" },
  { state: "NC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/NC-5.json", district: "05" },
  { state: "NC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/NC-6.json", district: "06" },
  { state: "NC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/NC-7.json", district: "07" },
  { state: "NC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/NC-8.json", district: "08" },
  { state: "NC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/NC-9.json", district: "09" },
  { state: "NC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/NC-10.json", district: "10" },
  // NC-11: incumbent Chuck Edwards withdrew 2026-08-07/08 after a House
  // Ethics Committee censure recommendation; the NC GOP selected Jennifer
  // Balkcom as his replacement nominee 2026-08-10. She had no FEC candidate
  // ID as of 2026-08-13; filed one (H6NC11321) the same day, confirmed
  // 2026-08-14.
  { state: "NC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/NC-11.json", district: "11" },
  { state: "NC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/NC-12.json", district: "12" },
  { state: "NC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-13", outFile: "house/NC-13.json", district: "13" },
  { state: "NC", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-14", outFile: "house/NC-14.json", district: "14" },
  { state: "NC", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/NC.json" },
  { state: "MO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/MO-1.json", district: "01" },
  { state: "MO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/MO-2.json", district: "02" },
  { state: "MO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/MO-3.json", district: "03" },
  { state: "MO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/MO-4.json", district: "04" },
  { state: "MO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/MO-5.json", district: "05" },
  { state: "MO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/MO-6.json", district: "06" },
  { state: "MO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/MO-7.json", district: "07" },
  { state: "MO", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/MO-8.json", district: "08" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/OH-1.json", district: "01" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/OH-2.json", district: "02" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/OH-3.json", district: "03" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/OH-4.json", district: "04" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/OH-5.json", district: "05" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/OH-6.json", district: "06" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/OH-7.json", district: "07" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/OH-8.json", district: "08" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/OH-9.json", district: "09" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/OH-10.json", district: "10" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/OH-11.json", district: "11" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/OH-12.json", district: "12" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-13", outFile: "house/OH-13.json", district: "13" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-14", outFile: "house/OH-14.json", district: "14" },
  { state: "OH", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-15", outFile: "house/OH-15.json", district: "15" },
  { state: "OH", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/OH.json" },
  // Florida: only these 5 House districts had a FULLY resolved primary
  // (every party uncontested/canceled) as of this research, 2026-08-13.
  // 2026-08-19: the primary (2026-08-18) is done and 21 of Florida's 23
  // remaining House districts + the Senate special election are added
  // below — see FLORIDA_2026_PRIMARY in primaryResults.ts for the
  // per-district narrowing and sourcing. FL-11 and FL-21 are deliberately
  // NOT added yet: FL-11's Republican primary is inside Florida's
  // automatic-recount threshold (Strada 33.5%/Baker 33.0%, ~403 votes),
  // and FL-21's Democratic primary is a 359-vote margin the loser is
  // actively disputing and Ballotpedia/AP have not called — see
  // pendingRaces.ts for both.
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/FL-1.json", district: "01" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/FL-2.json", district: "02" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/FL-3.json", district: "03" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/FL-4.json", district: "04" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/FL-5.json", district: "05" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/FL-6.json", district: "06" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/FL-7.json", district: "07" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/FL-8.json", district: "08" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/FL-9.json", district: "09" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/FL-10.json", district: "10" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/FL-12.json", district: "12" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-13", outFile: "house/FL-13.json", district: "13" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-14", outFile: "house/FL-14.json", district: "14" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-15", outFile: "house/FL-15.json", district: "15" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-16", outFile: "house/FL-16.json", district: "16" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-17", outFile: "house/FL-17.json", district: "17" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-18", outFile: "house/FL-18.json", district: "18" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-19", outFile: "house/FL-19.json", district: "19" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-20", outFile: "house/FL-20.json", district: "20" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-22", outFile: "house/FL-22.json", district: "22" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-23", outFile: "house/FL-23.json", district: "23" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-24", outFile: "house/FL-24.json", district: "24" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-25", outFile: "house/FL-25.json", district: "25" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-26", outFile: "house/FL-26.json", district: "26" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-27", outFile: "house/FL-27.json", district: "27" },
  { state: "FL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-28", outFile: "house/FL-28.json", district: "28" },
  { state: "FL", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/FL.json" },
  // SC Senate deliberately not built (Republican runoff pending 2026-08-25,
  // see the comment inline above). RI is still deliberately NOT wired in at
  // all yet: its primary isn't until Sept 9, 2026 (same held-back treatment
  // as NH/MA).
  // Alabama: the map governing 2026 (Act 2023-563) is being used for the
  // first time this cycle — SCOTUS twice acted (May 11 vacate-and-remand,
  // June 2 stay) to keep it in effect for 2026 specifically, though the
  // underlying district-court finding of intentional discrimination against
  // Black voters remains stayed, not reversed, on remand. Built on the
  // standard that the Nov 3 ballot is fixed either way since both 2026
  // primary rounds (May 19 for D3/4/5, Aug 11 special primary for D1/2/6/7)
  // are already complete under this map — see primaryResults.ts.
  { state: "AL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/AL-1.json", district: "01" },
  { state: "AL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/AL-2.json", district: "02" },
  { state: "AL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/AL-3.json", district: "03" },
  { state: "AL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/AL-4.json", district: "04" },
  { state: "AL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/AL-5.json", district: "05" },
  { state: "AL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/AL-6.json", district: "06" },
  { state: "AL", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/AL-7.json", district: "07" },
  { state: "AL", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/AL.json" },
  // Tennessee: map enacted May 2026 (SA7001/HA7002), governing both the Aug 6
  // primary and Nov 3 general per a federal panel's July 2026 denial of a
  // preliminary injunction (Sherman v. Hargett) — same standard applied to
  // Alabama above: the ballot is fixed either way since the primary already
  // happened under this map. See primaryResults.ts.
  { state: "TN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/TN-1.json", district: "01" },
  { state: "TN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/TN-2.json", district: "02" },
  { state: "TN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/TN-3.json", district: "03" },
  { state: "TN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/TN-4.json", district: "04" },
  { state: "TN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/TN-5.json", district: "05" },
  { state: "TN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/TN-6.json", district: "06" },
  { state: "TN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/TN-7.json", district: "07" },
  { state: "TN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/TN-8.json", district: "08" },
  { state: "TN", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/TN-9.json", district: "09" },
  { state: "TN", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/TN.json" },
  // Texas: 2026 map (Plan C2333 / HB4) already used for the actual March 3
  // primary and May 26 runoff; SCOTUS summarily reversed a lower-court
  // injunction 6-3 in Abbott v. LULAC (April 2026), letting it stand. See
  // primaryResults.ts.
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/TX-1.json", district: "01" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/TX-2.json", district: "02" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/TX-3.json", district: "03" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/TX-4.json", district: "04" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/TX-5.json", district: "05" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/TX-6.json", district: "06" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/TX-7.json", district: "07" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/TX-8.json", district: "08" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/TX-9.json", district: "09" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/TX-10.json", district: "10" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/TX-11.json", district: "11" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/TX-12.json", district: "12" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-13", outFile: "house/TX-13.json", district: "13" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-14", outFile: "house/TX-14.json", district: "14" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-15", outFile: "house/TX-15.json", district: "15" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-16", outFile: "house/TX-16.json", district: "16" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-17", outFile: "house/TX-17.json", district: "17" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-18", outFile: "house/TX-18.json", district: "18" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-19", outFile: "house/TX-19.json", district: "19" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-20", outFile: "house/TX-20.json", district: "20" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-21", outFile: "house/TX-21.json", district: "21" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-22", outFile: "house/TX-22.json", district: "22" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-23", outFile: "house/TX-23.json", district: "23" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-24", outFile: "house/TX-24.json", district: "24" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-25", outFile: "house/TX-25.json", district: "25" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-26", outFile: "house/TX-26.json", district: "26" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-27", outFile: "house/TX-27.json", district: "27" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-28", outFile: "house/TX-28.json", district: "28" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-29", outFile: "house/TX-29.json", district: "29" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-30", outFile: "house/TX-30.json", district: "30" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-31", outFile: "house/TX-31.json", district: "31" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-32", outFile: "house/TX-32.json", district: "32" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-33", outFile: "house/TX-33.json", district: "33" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-34", outFile: "house/TX-34.json", district: "34" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-35", outFile: "house/TX-35.json", district: "35" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-36", outFile: "house/TX-36.json", district: "36" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-37", outFile: "house/TX-37.json", district: "37" },
  { state: "TX", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-38", outFile: "house/TX-38.json", district: "38" },
  { state: "TX", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/TX.json" },
  // Louisiana Senate: standard closed-party primary (May 16) + runoff (June
  // 27, both parties needed one), normal Nov 3 general. Louisiana's House
  // races are deliberately NOT here — they reverted to an all-party primary
  // held ON Nov 3 itself, with a possible December runoff depending on
  // results not knowable until after that date. See votingSystem.ts and the
  // non-standard-electoral-systems plan for why House stays deferred.
  { state: "LA", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/LA.json" },
  // Maine: standard party primaries (June 9, already resolved) feed a
  // ranked-choice general — see votingSystem.ts. Its congressional map is
  // UNCHANGED since 2021 (confirmed both by research and by testing the
  // live Census geocoder against Augusta, the one town that moved districts
  // in the 2021 redraw — it already resolves correctly), so no geocode.js
  // override is needed at all.
  { state: "ME", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/ME-1.json", district: "01" },
  { state: "ME", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/ME-2.json", district: "02" },
  { state: "ME", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/ME.json" },

  // California: top-two blanket primary (June 2, already resolved) feeds
  // a plurality general — see votingSystem.ts. No 2026 Senate race
  // (Padilla's term runs through 2029, Schiff's through 2031, both
  // confirmed directly). 5 districts have same-party generals (29, 34,
  // 37, 40, plus 4/7/11/12/14 -- 9 total statewide), which is a normal,
  // expected outcome under this system, not an error.
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/CA-1.json", district: "01" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/CA-2.json", district: "02" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/CA-3.json", district: "03" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/CA-4.json", district: "04" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-05", outFile: "house/CA-5.json", district: "05" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/CA-6.json", district: "06" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/CA-7.json", district: "07" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-08", outFile: "house/CA-8.json", district: "08" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/CA-9.json", district: "09" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/CA-10.json", district: "10" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-11", outFile: "house/CA-11.json", district: "11" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-12", outFile: "house/CA-12.json", district: "12" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-13", outFile: "house/CA-13.json", district: "13" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-14", outFile: "house/CA-14.json", district: "14" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-15", outFile: "house/CA-15.json", district: "15" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-16", outFile: "house/CA-16.json", district: "16" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-17", outFile: "house/CA-17.json", district: "17" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-18", outFile: "house/CA-18.json", district: "18" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-19", outFile: "house/CA-19.json", district: "19" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-20", outFile: "house/CA-20.json", district: "20" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-21", outFile: "house/CA-21.json", district: "21" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-22", outFile: "house/CA-22.json", district: "22" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-23", outFile: "house/CA-23.json", district: "23" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-24", outFile: "house/CA-24.json", district: "24" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-25", outFile: "house/CA-25.json", district: "25" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-26", outFile: "house/CA-26.json", district: "26" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-27", outFile: "house/CA-27.json", district: "27" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-28", outFile: "house/CA-28.json", district: "28" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-29", outFile: "house/CA-29.json", district: "29" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-30", outFile: "house/CA-30.json", district: "30" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-31", outFile: "house/CA-31.json", district: "31" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-32", outFile: "house/CA-32.json", district: "32" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-33", outFile: "house/CA-33.json", district: "33" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-34", outFile: "house/CA-34.json", district: "34" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-35", outFile: "house/CA-35.json", district: "35" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-36", outFile: "house/CA-36.json", district: "36" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-37", outFile: "house/CA-37.json", district: "37" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-38", outFile: "house/CA-38.json", district: "38" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-39", outFile: "house/CA-39.json", district: "39" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-40", outFile: "house/CA-40.json", district: "40" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-41", outFile: "house/CA-41.json", district: "41" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-42", outFile: "house/CA-42.json", district: "42" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-43", outFile: "house/CA-43.json", district: "43" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-44", outFile: "house/CA-44.json", district: "44" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-45", outFile: "house/CA-45.json", district: "45" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-46", outFile: "house/CA-46.json", district: "46" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-47", outFile: "house/CA-47.json", district: "47" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-48", outFile: "house/CA-48.json", district: "48" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-49", outFile: "house/CA-49.json", district: "49" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-50", outFile: "house/CA-50.json", district: "50" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-51", outFile: "house/CA-51.json", district: "51" },
  { state: "CA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-52", outFile: "house/CA-52.json", district: "52" },
  // Washington: top-two blanket primary (Aug 4, already resolved for 8 of
  // 10 districts) — see votingSystem.ts. No 2026 Senate race (Murray's term
  // runs to 2029, Cantwell's to 2031, both confirmed directly). Map is
  // UNCHANGED since the 2021 cycle (confirmed both by research and by
  // testing the live Census geocoder against 4 real addresses, including a
  // cross-check against Rep. Emily Randall's own official district-office
  // address), so no geocode.js override is needed at all — same outcome as
  // NY/PA/MI/GA/ME. WA-05 and WA-08 deliberately NOT here yet: both
  // districts' second-place general slot was still uncertified as of this
  // research, WA-08 genuinely still tightening between two Republicans.
  { state: "WA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/WA-1.json", district: "01" },
  { state: "WA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/WA-2.json", district: "02" },
  { state: "WA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/WA-3.json", district: "03" },
  { state: "WA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/WA-4.json", district: "04" },
  { state: "WA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-06", outFile: "house/WA-6.json", district: "06" },
  { state: "WA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-07", outFile: "house/WA-7.json", district: "07" },
  { state: "WA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-09", outFile: "house/WA-9.json", district: "09" },
  { state: "WA", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-10", outFile: "house/WA-10.json", district: "10" },

  // Utah: 4 House districts, no Senate race in 2026 (both seats' terms run
  // past 2026 — Lee to 2029, Curtis to 2031). Map redrawn by a Utah state
  // trial court for 2026 (see geocode.js's UT entry), which reshuffled
  // three incumbents into different-numbered districts and left the
  // fourth (Owens, old district 4) retiring rather than running anywhere
  // this cycle — new district 1 is a fully open seat as a result.
  { state: "UT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-01", outFile: "house/UT-1.json", district: "01" },
  { state: "UT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-02", outFile: "house/UT-2.json", district: "02" },
  { state: "UT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-03", outFile: "house/UT-3.json", district: "03" },
  { state: "UT", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-04", outFile: "house/UT-4.json", district: "04" },
];

async function main() {
  const allFlags: string[] = [];
  for (const opts of RACES) {
    const { flags } = await buildRace(opts);
    allFlags.push(...flags);
  }
  if (allFlags.length) {
    console.log(`\n${allFlags.length} primary-results flag(s) raised this run:`);
    allFlags.forEach((f) => console.log(`  - ${f}`));
  }
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
