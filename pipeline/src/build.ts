import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { searchCandidates, getTotals } from "./sources/fec.js";
import { getMembersByState, getLegislativeActivity } from "./sources/congressGov.js";
import { getBioFacts } from "./sources/wikidata.js";
import { extractBioFacts } from "./sources/llmExtract.js";
import { getCommitteeAssignments } from "./sources/congressLegislators.js";
import {
  getRecentMemberVotes as getRecentHouseVotes,
  getAttendanceStats as getHouseAttendance,
} from "./sources/houseRollCall.js";
import {
  getRecentMemberVotes as getRecentSenateVotes,
  getAttendanceStats as getSenateAttendance,
} from "./sources/senateRollCall.js";
import { loadCuratedRace } from "./curated.js";

const BUILD_ROOT = join(import.meta.dirname, "..", "build");

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

function searchName(fecName: string): string {
  // Wikidata's search API matches almost nothing against FEC's raw
  // "LAST, FIRST MIDDLE SUFFIX" format — needs a normal "First Last" query.
  const [last, rest] = fecName.split(",").map((s) => s.trim());
  const first = (rest ?? "").split(/\s+/)[0] ?? "";
  const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
  return `${cap(first)} ${cap(last)}`;
}

interface BuildRaceOptions {
  state: string;
  office: "H" | "S";
  cycle: number;
  congress: number; // e.g. 119
  session: number; // 1 or 2, for Senate LIS vote lookups
  raceSlug: string; // curated/ subdirectory + build output filename, e.g. "house-AL" or "senate"
  outFile: string; // e.g. build/house/DE-AL.json
}

async function buildRace(opts: BuildRaceOptions) {
  const fecCandidates = await searchCandidates(opts.state, opts.office, opts.cycle);
  const curated = loadCuratedRace(opts.state, opts.raceSlug);
  const stateMembers = await getMembersByState(opts.state);

  const candidates = await Promise.all(
    fecCandidates.map(async (c) => {
      const slug = slugify(c.name);
      const totals = await getTotals(c.candidateId, opts.cycle);
      const curatedEntry = curated[slug] ?? null;

      // Structured Wikidata facts fill gaps only — curated (manually
      // quote-anchored) fields always take priority when both exist.
      const wikidata = await getBioFacts(searchName(c.name)).catch(() => null);
      const bio: Record<string, unknown> = {};
      if (wikidata?.date_of_birth) {
        bio.date_of_birth = { value: wikidata.date_of_birth, source_url: wikidata.entityUrl, source_type: "wikidata_structured" };
      }
      if (wikidata?.birthplace) {
        bio.birthplace = { value: wikidata.birthplace, source_url: wikidata.entityUrl, source_type: "wikidata_structured" };
      }
      if (wikidata?.college) {
        bio.college = { value: wikidata.college, source_url: wikidata.entityUrl, source_type: "wikidata_structured" };
      }

      // Automated quote-anchored extraction (Claude) fills the prose fields
      // Wikidata doesn't have structured data for — only runs when curated
      // YAML doesn't already cover them, since a human-reviewed fact always
      // wins and there's no reason to spend an API call re-deriving it.
      const PROSE_FIELDS = ["marital_status", "employment_record", "civic_affiliations"] as const;
      const curatedBio = curatedEntry?.bio ?? {};
      const missingProseField = PROSE_FIELDS.some((f) => !curatedBio[f]);
      if (wikidata?.wikipediaUrl && missingProseField) {
        const extracted = await extractBioFacts(c.name, wikidata.wikipediaUrl).catch(() => null);
        for (const field of PROSE_FIELDS) {
          const hit = extracted?.[field];
          if (hit) bio[field] = { value: hit.value, source_url: wikidata.wikipediaUrl, snippet: hit.snippet, source_type: "llm_extracted" };
        }
      }

      // curated overrides win
      Object.assign(bio, curatedBio);

      // Match this FEC candidate to a sitting member for bioguideId + roll-call votes.
      const matchedMember = c.incumbentChallenge === "Incumbent"
        ? stateMembers.find((m) => normalizeNameForMatch(m.name).includes(normalizeNameForMatch(c.name.split(",")[0])))
        : null;

      let recentVotes: Array<{ position: string; sourceUrl: string; [k: string]: unknown }> = [];
      let attendance: { votesInSession: number; votesCast: number; attendanceRate: number } | null = null;
      let committees: Awaited<ReturnType<typeof getCommitteeAssignments>> = [];
      let legislativeActivity: Awaited<ReturnType<typeof getLegislativeActivity>> = null;

      if (matchedMember && opts.office === "H") {
        [recentVotes, attendance, committees, legislativeActivity] = await Promise.all([
          getRecentHouseVotes(matchedMember.bioguideId, opts.cycle, 5).catch(() => []),
          getHouseAttendance(matchedMember.bioguideId, opts.cycle).catch(() => null),
          getCommitteeAssignments(matchedMember.bioguideId).catch(() => []),
          getLegislativeActivity(matchedMember.bioguideId).catch(() => null),
        ]);
      } else if (matchedMember && opts.office === "S") {
        const lastName = matchedMember.name.split(",")[0].trim();
        [recentVotes, attendance, committees, legislativeActivity] = await Promise.all([
          getRecentSenateVotes(lastName, opts.state, opts.congress, opts.session, 5).catch(() => []),
          getSenateAttendance(lastName, opts.state, opts.congress, opts.session).catch(() => null),
          getCommitteeAssignments(matchedMember.bioguideId).catch(() => []),
          getLegislativeActivity(matchedMember.bioguideId).catch(() => null),
        ]);
      }

      return {
        slug,
        full_name: c.name,
        party: c.party,
        incumbent: c.incumbentChallenge === "Incumbent",
        fec_candidate_id: c.candidateId,
        bioguide_id: matchedMember?.bioguideId ?? null,
        financials: totals,
        bio,
        recent_votes: recentVotes,
        performance: matchedMember
          ? {
              attendance,
              committees,
              bills_sponsored: legislativeActivity?.billsSponsored ?? null,
              bills_cosponsored: legislativeActivity?.billsCosponsored ?? null,
            }
          : null,
        _curated_match: Boolean(curatedEntry),
      };
    })
  );

  const output = {
    state: opts.state,
    office: opts.office,
    cycle: opts.cycle,
    race_slug: opts.raceSlug,
    generated_at: new Date().toISOString(),
    candidates,
  };

  const outPath = join(BUILD_ROOT, opts.outFile);
  mkdirSync(join(outPath, ".."), { recursive: true });
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outPath} — ${candidates.length} candidates (${candidates.filter((c) => c._curated_match).length} with curated bio data)`);
}

async function main() {
  await buildRace({ state: "DE", office: "H", cycle: 2026, congress: 119, session: 2, raceSlug: "house-AL", outFile: "house/DE-AL.json" });
  await buildRace({ state: "DE", office: "S", cycle: 2026, congress: 119, session: 2, raceSlug: "senate", outFile: "senate/DE.json" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
