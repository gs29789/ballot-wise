import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { PENDING_RACES, type PendingRace } from "./pendingRaces.js";
import { RACES, buildRace, type BuildRaceOptions } from "../build.js";
import { searchCandidates } from "../sources/fec.js";
import type { PrimaryResult } from "../sources/primaryResults.js";

// Run daily by the same routine that used to only run checkPendingRaces.ts
// read-only -- this is the automatic half of that: for primary/runoff
// results confident enough to publish without a human review pass, it
// researches, writes the result, and rebuilds the race, no human in the
// loop. Anything less than fully confident is left exactly as before --
// still flagged, still nagging daily, still waiting on a manual research
// pass. This script itself never touches git or R2; it only writes
// autoPrimaryResults.json and rebuilds race JSON locally. The wrapping
// routine's own prompt is responsible for reading this script's summary,
// removing any now-resolved entries from PENDING_RACES with its own Edit
// tool (a precise, verified text edit -- not a script guessing at TS
// source surgery), committing, and running `npm run publish`.
//
// Deliberately scoped to watchReason "primary" and "runoff" only. The
// other reasons already in PENDING_RACES (recount, certification, a
// general-election runoff-decider) are structurally different problems --
// there's no advancingCandidateIds narrowing to do for e.g. "which
// 2nd-place finisher does WA-05 certify" -- forcing them through this same
// PrimaryResult-shaped mechanism would risk a bad fit or false confidence
// rather than a clean skip. Those stay notify-only, same as today.
const ELIGIBLE_REASONS = new Set(["primary", "runoff"]);
const BUFFER_DAYS = 3; // matches checkPendingRaces.ts

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const AUTO_RESULTS_PATH = join(import.meta.dirname, "autoPrimaryResults.json");

interface AutoPrimaryEntry extends PrimaryResult {
  resolvedAt: string;
}
type AutoResultsFile = Record<string, Record<string, AutoPrimaryEntry>>;

function loadAutoResults(): AutoResultsFile {
  try {
    return JSON.parse(readFileSync(AUTO_RESULTS_PATH, "utf8"));
  } catch {
    return {};
  }
}

function saveAutoResults(data: AutoResultsFile) {
  writeFileSync(AUTO_RESULTS_PATH, JSON.stringify(data, null, 2));
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

interface Verdict {
  unambiguous: boolean;
  reason: string;
  advancingCandidateIds: string[] | null;
  source_url: string | null;
  snippet: string | null;
}

// Mirrors this project's other forced-verdict prompts (llmExtract.ts's
// matchesExpectedCandidate, ballotpedia.ts's race-page search): a required
// field the model must commit to BEFORE the rest of its answer is trusted,
// not an implicit inference left to prose. Default to false whenever
// uncertain -- same fail-closed discipline as every identity check in this
// pipeline, now applied to "who's on the ballot" instead of a bio field.
//
// The verdict is collected via a real tool call (submit_verdict below), not
// parsed out of the model's free-text response -- confirmed necessary by
// direct testing: given a multi-step web-search task, the model reliably
// reasons its way to the right answer but doesn't reliably confine its
// final message to bare JSON (it explains its research first, e.g. wrapping
// the JSON in a ```json fence after several sentences of prose), so a
// prose-parsing approach silently failed on 3 of 4 real test races despite
// every one of those 3 actually containing a correct, well-cited answer.
// Same root lesson as the matchesExpectedCandidate fix earlier this
// project: force the commitment through the API's own structured
// mechanism, don't trust a "please only output JSON" instruction.
const SYSTEM_PROMPT = `You determine who is CONFIRMED to advance to the general election ballot for one specific U.S. federal race, after a primary or runoff. Follow these rules exactly, in order:

1. Search official state election-results sites, Ballotpedia, and AP/NPR coverage (apps.npr.org/primary-election-results-2026 is a reliable AP-sourced results source used elsewhere in this project) for the PRIMARY or RUNOFF result of the exact race described below. Do not confuse this with general-election polling or predictions -- you are looking for a completed primary/runoff result, not a forecast of the general election in November.
2. "Advancing" means confirmed to appear on the general-election ballot, by ANY legitimate path -- won a contested primary, ran unopposed, or (for an independent) separately cleared a state's petition-signature/certification process outside the primary entirely. Include every such candidate, not just primary winners.
3. You are given the race's full list of currently FEC-registered candidates below, each with an id. Map every advancing candidate you find to exactly one id from that list by name. If you cannot confidently match every single advancing candidate to one of the provided ids, set unambiguous to false -- a race with an advancing candidate who has no matching FEC record needs a human, not a guess.
4. Set unambiguous to true ONLY when ALL of the following hold: an authoritative source explicitly calls the result (not partial/unofficial returns, not "leading"), there is no recount underway or margin inside an automatic-recount threshold, there is no active legal challenge or uncontested dispute over the outcome, and any withdrawal or ineligibility affecting who actually advances is already accounted for in your answer. If ANY of this is unclear or contested, set unambiguous to false. Default to false whenever you are not fully certain -- being slow to confirm is always fine; being wrong is not.
5. Once you're done researching, call submit_verdict exactly once with your final answer. Always fill in "reason" -- explain briefly why you're confident (citing what makes it official/final) or specifically what's blocking a confident call. When unambiguous is true, source_url and snippet are required: snippet must be a short VERBATIM quote from source_url's actual page text that supports your answer -- not a paraphrase.`;

const SUBMIT_VERDICT_TOOL = {
  name: "submit_verdict",
  description: "Submit your final determination of who is confirmed to advance to the general election for this race.",
  input_schema: {
    type: "object" as const,
    properties: {
      unambiguous: { type: "boolean" as const, description: "True only if the result is fully confirmed, final, and undisputed." },
      reason: { type: "string" as const, description: "Why you're confident, or what's blocking a confident call." },
      advancingCandidateIds: {
        type: "array" as const,
        items: { type: "string" as const },
        description: "FEC ids (from the provided list) of every candidate confirmed to advance. Omit or leave empty if unambiguous is false.",
      },
      source_url: { type: "string" as const, description: "The authoritative source URL. Required if unambiguous is true." },
      snippet: { type: "string" as const, description: "A verbatim quote from source_url supporting the answer. Required if unambiguous is true." },
    },
    required: ["unambiguous", "reason"],
  },
};

export async function researchRace(raceLabel: string, candidates: { candidateId: string; name: string; party: string }[]): Promise<Verdict | null> {
  const candidateList = candidates.map((c) => `${c.candidateId}: ${c.name} (${c.party})`).join("\n");
  const today = new Date().toISOString().slice(0, 10);
  let message;
  try {
    message = await getClient().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20260318" as any, name: "web_search", max_uses: 8 } as any, SUBMIT_VERDICT_TOOL as any],
      messages: [
        { role: "user", content: `Race: ${raceLabel}\nToday's date: ${today}\n\nCurrently FEC-registered candidates for this race:\n${candidateList}` },
      ],
    });
  } catch (err: any) {
    console.warn(`[resolvePendingPrimaries] research call failed for "${raceLabel}": ${err?.message ?? err}`);
    return null;
  }

  const verdictBlock = [...message.content].reverse().find((b) => b.type === "tool_use" && b.name === "submit_verdict");
  if (!verdictBlock || verdictBlock.type !== "tool_use") {
    console.warn(`[resolvePendingPrimaries] no submit_verdict call in response for "${raceLabel}" (stop_reason: ${message.stop_reason})`);
    return null;
  }
  const input = verdictBlock.input as Record<string, unknown>;
  if (typeof input.unambiguous !== "boolean" || typeof input.reason !== "string") return null;
  return {
    unambiguous: input.unambiguous,
    reason: input.reason,
    advancingCandidateIds: Array.isArray(input.advancingCandidateIds) ? (input.advancingCandidateIds as string[]) : null,
    source_url: typeof input.source_url === "string" ? input.source_url : null,
    snippet: typeof input.snippet === "string" ? input.snippet : null,
  };
}

export function raceLabel(opts: BuildRaceOptions): string {
  if (opts.office === "S") return `${opts.state} U.S. Senate election, 2026`;
  const districtNum = opts.district === "00" ? "At-Large" : String(Number(opts.district));
  return `${opts.state}'s ${districtNum} Congressional District election, 2026`;
}

// A PENDING_RACES entry can span multiple built races (e.g. a chamber:
// "both" entry with no districts covers a state's House-AL race AND its
// Senate race). Only entries whose EVERY constituent race resolves are
// safe to report as fully clearable -- resolving 1 of 2 doesn't mean the
// pending entry itself is done.
function matchingRaces(entry: PendingRace): BuildRaceOptions[] {
  return RACES.filter((r) => {
    if (r.state !== entry.state) return false;
    const wantsHouse = entry.chamber === "house" || entry.chamber === "both";
    const wantsSenate = entry.chamber === "senate" || entry.chamber === "both";
    if (r.office === "H") {
      if (!wantsHouse) return false;
      return entry.districts?.length ? entry.districts.includes(r.district ?? "") : true;
    }
    return r.office === "S" && wantsSenate;
  });
}

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const due = PENDING_RACES.filter(
    (r) => ELIGIBLE_REASONS.has(r.watchReason) && (!r.watchDate || addDays(r.watchDate, BUFFER_DAYS) <= today)
  );

  if (!due.length) {
    console.log("NO_ELIGIBLE_PENDING_RACES");
    return;
  }

  const autoResults = loadAutoResults();
  const published: { entryId: string; label: string; verdict: Verdict }[] = [];
  const stillPending: { entryId: string; label: string; reason: string }[] = [];
  const fullyResolvedEntryIds: string[] = [];

  for (const entry of due) {
    const races = matchingRaces(entry);
    if (!races.length) {
      // Not a research failure -- the race itself was deliberately left out
      // of build.ts's RACES list (e.g. a Senate seat with no confirmed
      // nominee yet) and needs a human to add it there first. Surfaced
      // through the same stillPending channel as every other unresolved
      // case, not a bare console.log, so it actually reaches the daily
      // digest instead of silently repeating in logs nobody reads.
      stillPending.push({
        entryId: entry.id,
        label: `${entry.state} ${entry.chamber}`,
        reason: "not yet in the pipeline's build list -- needs a RACES entry added to build.ts before this can resolve automatically",
      });
      continue;
    }

    let allRacesResolved = true;
    for (const race of races) {
      const label = raceLabel(race);
      const candidates = await searchCandidates(race.state, race.office, race.cycle, race.office === "H" ? race.district : undefined);
      const verdict = await researchRace(
        label,
        candidates.map((c) => ({ candidateId: c.candidateId, name: c.name, party: c.party }))
      );

      const validIds = new Set(candidates.map((c) => c.candidateId));
      const idsAreValid = verdict?.advancingCandidateIds?.length && verdict.advancingCandidateIds.every((id) => validIds.has(id));

      if (!verdict || !verdict.unambiguous || !idsAreValid || !verdict.source_url || !verdict.snippet) {
        allRacesResolved = false;
        const reason = !verdict
          ? "research call failed"
          : verdict.unambiguous && !idsAreValid
            ? `${verdict.reason} (discarded: model returned an id outside this race's known FEC candidates)`
            : verdict.reason;
        stillPending.push({ entryId: entry.id, label, reason });
        continue;
      }

      autoResults[race.state] ??= {};
      autoResults[race.state][race.raceSlug] = {
        advancingCandidateIds: verdict.advancingCandidateIds!,
        source_url: verdict.source_url,
        snippet: verdict.snippet,
        resolvedAt: new Date().toISOString(),
      };
      // Persisted immediately, not batched to the end -- a later race's
      // failure in this same run shouldn't cost an earlier one's already-
      // confirmed result.
      saveAutoResults(autoResults);

      const { flags } = await buildRace(race);
      flags.forEach((f) => console.warn(`[resolvePendingPrimaries] ${f}`));

      published.push({ entryId: entry.id, label, verdict });
    }

    if (allRacesResolved) fullyResolvedEntryIds.push(entry.id);
  }

  console.log(`\n${published.length} race(s) resolved and rebuilt. ${fullyResolvedEntryIds.length} pending entr${fullyResolvedEntryIds.length === 1 ? "y" : "ies"} fully cleared.`);
  for (const p of published) {
    console.log(`- PUBLISHED [${p.entryId}] ${p.label}: ${p.verdict.advancingCandidateIds!.join(", ")}`);
    console.log(`  source: ${p.verdict.source_url}`);
  }
  for (const s of stillPending) {
    console.log(`- STILL PENDING [${s.entryId}] ${s.label}: ${s.reason}`);
  }

  if (fullyResolvedEntryIds.length) {
    console.log(`\nFULLY_RESOLVED_ENTRY_IDS: ${fullyResolvedEntryIds.join(",")}`);
    console.log(`Remove these from PENDING_RACES in pendingRaces.ts, verify with tsc, commit, then run 'npm run publish'.`);
  }
}

// Guarded (unlike this pipeline's other CI scripts) because researchRace
// and raceLabel are exported above for direct reuse in dry-run testing --
// without this check, importing either for a standalone test would also
// trigger a full live run (real API calls, real writes) as a side effect
// of the import itself.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
