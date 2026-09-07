import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

// Scans a given list of races for real, on-the-ballot general-election
// candidates this pipeline's FEC-driven sourcing can never find, because
// FEC only requires a filing once a candidate raises/spends over $5,000 —
// see missingCandidates.ts's own header for the full reasoning and the
// real case (Bobby Wilson, AR-3 Libertarian) that surfaced this.
//
// Reuses the same web-search-plus-forced-confidence-field pattern already
// proven in primaryResults.ts's auto-resolution and ballotpedia.ts's
// race-page lookup, rather than hand-writing an HTML table parser against
// Ballotpedia's markup — the comparison (is this name a reasonable match
// for someone already on file?) is exactly the kind of judgment call an
// LLM is well-suited for and a regex is not.
//
// This script only REPORTS findings (writes scanMissingCandidatesReport.json)
// -- it does not write to missingCandidates.ts itself. Insertion stays a
// separate, reviewed step given the stakes of adding a real person to a
// live public site.

const BUILD_ROOT = join(import.meta.dirname, "..", "..", "build");
const REPORT_PATH = join(import.meta.dirname, "scanMissingCandidatesReport.json");

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `You check whether a specific U.S. congressional race is missing a real general-election candidate, by finding and reading that race's own Ballotpedia.org page.

A Ballotpedia race page typically has SEVERAL separate candidate tables: one titled exactly "General election for U.S. House/Senate [State] District [N]" (or similar), and separate ones for "Democratic primary election", "Republican primary election", etc. THIS IS THE #1 SOURCE OF ERROR: a name appearing anywhere on the page -- including a primary table -- is NOT evidence they're on the general-election ballot. Most primary candidates LOSE and do not advance. Confirmed failure mode from a real run: candidates who lost their primary (e.g. 37% to 63%) were wrongly flagged as "missing" from the general election, when the general-election table itself only ever listed the actual two winners.

Steps:
1. Search for the race's own Ballotpedia page (titled like "[State]'s [Nth] Congressional District election, 2026" for House, or "United States Senate election in [State], 2026" for Senate) -- the page covering the whole race, not any one candidate's own page.
2. Find the section/table whose heading is LITERALLY "General election for U.S. House/Senate ..." and read ONLY the candidate names listed directly in THAT specific table.
3. Ignore every other section of the page entirely for the purpose of this comparison -- primary results, "withdrawn or disqualified" lists, convention results already folded into the general-election table, past-cycle sections. A name is only a general-election candidate if it is printed inside that one specific "General election for..." table.
4. Compare only those names against the "already on file" list given to you.

A candidate counts as missing ONLY if ALL of these hold:
- Their name is printed directly inside the "General election for..." table (step 2/3 above) -- not found anywhere else on the page and inferred from there
- Their name is not a reasonable match (allowing for nicknames, middle names, suffixes) for anyone already on file
- You are highly confident, having actually read that specific table's contents

If you cannot find the race's own Ballotpedia page at all, set found_race_page to false and missing to []. If you found the page but every name in the "General election for..." table matches someone already on file, return missing: []. Never guess a name into existence, and never include a name you only saw in a primary/withdrawn section -- if uncertain about any one candidate, simply leave them out of "missing" rather than including them.

Output ONLY valid JSON, no other text, no markdown fences:
{"found_race_page": true|false, "race_page_url": "https://ballotpedia.org/..." | null, "missing": [{"full_name": "First Last", "party": "DEMOCRATIC PARTY"|"REPUBLICAN PARTY"|"LIBERTARIAN PARTY"|"GREEN PARTY"|"INDEPENDENT"|other exact party name as Ballotpedia states it, "source_url": "https://ballotpedia.org/...", "snippet": "a verbatim quote from the page's own General Election section confirming this person is on the general-election ballot"}]}`;

interface ScanTarget {
  state: string;
  raceSlug: string;
  office: "H" | "S";
  outFile: string;
  district?: string;
}

async function scanRace(target: ScanTarget, existingNames: string[]): Promise<any> {
  const stateName = STATE_NAMES[target.state] ?? target.state;
  const raceDescription =
    target.office === "S"
      ? `United States Senate election in ${stateName}, 2026`
      : `${stateName}'s ${target.district ?? ""} Congressional District election, 2026`;

  let message;
  try {
    message = await getClient().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1536,
      system: SYSTEM_PROMPT,
      tools: [{ type: "web_search_20260318" as any, name: "web_search", max_uses: 5 } as any],
      messages: [{ role: "user", content: `Race: ${raceDescription}\nAlready on file for this race: ${existingNames.join(", ") || "(none)"}` }],
    });
  } catch (err: any) {
    return { error: err?.message ?? String(err) };
  }

  const textBlock = [...message.content].reverse().find((b: any) => b.type === "text");
  if (!textBlock || (textBlock as any).type !== "text") return { error: "no text response" };
  try {
    const jsonText = (textBlock as any).text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    return JSON.parse(jsonText);
  } catch {
    return { error: "unparseable response", raw: (textBlock as any).text.slice(0, 300) };
  }
}

async function main() {
  const targetsRaw = JSON.parse(readFileSync(process.argv[2] ?? join(import.meta.dirname, "..", "..", "..", "unchecked_races.json"), "utf-8"));

  const results: any[] = [];
  let checked = 0;
  for (const t of targetsRaw) {
    const localPath = join(BUILD_ROOT, t.file);
    const data = JSON.parse(readFileSync(localPath, "utf-8"));
    const existingNames = (data.candidates ?? []).map((c: any) => {
      const [last, rest] = String(c.full_name).split(",").map((s: string) => s.trim());
      const first = (rest ?? "").split(/\s+/)[0] ?? "";
      return `${first} ${last}`;
    });

    const district = t.raceSlug.startsWith("house-") ? t.raceSlug.replace("house-", "").replace(/^0/, "") : undefined;
    const target: ScanTarget = { state: t.state, raceSlug: t.raceSlug, office: data.office, outFile: t.file, district };

    const result = await scanRace(target, existingNames);
    checked++;
    const missingCount = Array.isArray(result.missing) ? result.missing.length : 0;
    console.log(`[${checked}/${targetsRaw.length}] ${t.file}${missingCount ? ` -> ${missingCount} POSSIBLE MISSING: ${result.missing.map((m: any) => m.full_name).join(", ")}` : result.error ? ` -> error: ${result.error}` : " -> clean"}`);
    results.push({ file: t.file, state: t.state, raceSlug: t.raceSlug, existingNames, ...result });
    writeFileSync(REPORT_PATH, JSON.stringify(results, null, 2));
  }

  const totalMissing = results.reduce((s, r) => s + (Array.isArray(r.missing) ? r.missing.length : 0), 0);
  const racesWithMissing = results.filter((r) => Array.isArray(r.missing) && r.missing.length > 0).length;
  console.log(`\nDone. ${checked} races scanned. ${racesWithMissing} races with a possible missing candidate, ${totalMissing} candidates total.`);
  console.log(`Full report: ${REPORT_PATH}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
