import "dotenv/config";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getBioFacts, extractKnownQid } from "../sources/wikidata.js";
import { extractBioSummaryFromWikipedia, extractBioSummaryFromBallotpedia } from "../sources/campaignBioSummary.js";
import { findBallotpediaUrl } from "../sources/ballotpedia.js";
import { searchNameVariants, WIKIDATA_UNRELIABLE_CANDIDATES } from "../build.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// wikidata.ts's own header comment documents real, confirmed flakiness in
// Wikidata's search backend (a name coming back fully populated on one
// build and completely empty on the very next, unchanged one) -- this
// script's first real run hit exactly that at much higher severity than
// expected (296 eligible candidates, only 7 total wikidata hits logged,
// including candidates independently reconfirmed by hand moments later
// with a clean, immediate success on the exact same name). Confirmed
// again on Rep. James Clyburn: unambiguously has a Wikidata entity and a
// real Wikipedia article, still silently missed across 3 full runs of
// this script, because the SEARCH step specifically -- not the entity
// fetch -- is what's flaky (see extractKnownQid below for the real fix
// for that population). Retrying once after a short pause covers what's
// left: a candidate with no confirmed QID yet, where a fresh search is
// unavoidable and stays probabilistic either way.
async function getBioFactsWithRetry(name: string, knownQid?: string) {
  const first = await getBioFacts(name, knownQid).catch(() => null);
  if (first?.wikipediaUrl) return first;
  await sleep(400);
  return getBioFacts(name, knownQid).catch(() => null);
}

// Backlog pass, run manually (and via Process 2's routine): for every
// candidate with no bio_summary on file yet -- whether because they have
// no campaign site at all, or because a site exists but had nothing
// extractable there (a real, separate population: a pure donate/volunteer
// page with no "about me" content) -- tries Wikipedia, then Ballotpedia,
// same three-source waterfall build.ts now runs automatically on every
// race rebuild (campaign site -> Wikipedia -> Ballotpedia), applied here
// to the already-published backlog without waiting for each race's next
// natural rebuild. Deliberately does NOT re-attempt campaign-site
// DISCOVERY (that's scaleNoSiteBacklog.ts's job, a separate paid
// activity) -- campaign_site_url as currently on file is trusted as-is;
// this only ever tries the two fallback sources, matching exactly what
// build.ts's own gate would see if it ran today. (File name predates the
// Ballotpedia fallback being added -- kept as-is since Process 2's
// routine prompt already references it by this exact filename.)
const BUILD_DIR = join(import.meta.dirname, "..", "..", "build");

interface BioField {
  source_type?: string;
  source_url?: string;
}

interface Candidate {
  full_name: string;
  fec_candidate_id: string;
  campaign_site_url?: string | null;
  bio_summary?: { value: string; source_url: string; source_type: string } | null;
  _bio_summary_resolved_at?: string;
  bio?: { date_of_birth?: BioField | null; birthplace?: BioField | null; college?: BioField | null };
  [key: string]: unknown;
}

interface RaceResult {
  findings: string[];
  knownQidMisses: string[]; // candidates with an already-confirmed QID who STILL have no bio_summary after this run
}

async function processRaceFile(filePath: string, state: string, office: "H" | "S", district: string | null): Promise<RaceResult> {
  const raw = readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.candidates)) return { findings: [], knownQidMisses: [] };

  const expectedContext = `a candidate for ${office === "H" ? "U.S. House of Representatives" : "U.S. Senate"} from ${state}`;
  const raceDescription =
    office === "H"
      ? district === "AL"
        ? `${state} At-Large Congressional District election, 2026`
        : `${state} Congressional District ${Number(district)} election, 2026`
      : `${state} U.S. Senate election, 2026`;
  let changed = false;
  const findings: string[] = [];
  const knownQidMisses: string[] = [];

  for (const c of data.candidates as Candidate[]) {
    if (c.bio_summary?.value) continue;
    if (WIKIDATA_UNRELIABLE_CANDIDATES.has(c.fec_candidate_id)) continue;

    // A known QID (already confirmed via a prior wikidata_structured bio
    // field) skips the flaky name search entirely and goes straight to a
    // direct, reliable entity fetch — one attempt is enough since there's
    // no search-ranking non-determinism left to retry against. Only fall
    // back to trying every name variant when there's truly no QID on file
    // yet, where a fresh search is unavoidable.
    const knownQid = extractKnownQid(c.bio);
    let wikipediaUrl: string | null = null;
    if (knownQid) {
      const wikidata = await getBioFactsWithRetry(c.full_name, knownQid);
      wikipediaUrl = wikidata?.wikipediaUrl ?? null;
    } else {
      for (const nameVariant of searchNameVariants(c.full_name)) {
        const wikidata = await getBioFactsWithRetry(nameVariant);
        if (wikidata?.wikipediaUrl) {
          wikipediaUrl = wikidata.wikipediaUrl;
          break;
        }
      }
    }
    await sleep(120); // pace requests against Wikidata's search backend rather than firing ~300 back-to-back

    let result = wikipediaUrl ? await extractBioSummaryFromWikipedia(c.full_name, wikipediaUrl, expectedContext).catch(() => null) : null;
    if (!result && wikipediaUrl) {
      findings.push(`  no match on Wikipedia: ${c.full_name} (${wikipediaUrl})`);
      if (knownQid) knownQidMisses.push(`${c.full_name} (${wikipediaUrl}) -- Wikipedia extraction/recovery failed, not a lookup miss`);
    }

    if (!result) {
      const ballotpediaUrl = await findBallotpediaUrl(c.full_name, raceDescription).catch(() => null);
      if (ballotpediaUrl) {
        result = await extractBioSummaryFromBallotpedia(c.full_name, ballotpediaUrl, expectedContext).catch(() => null);
        if (!result) findings.push(`  no match on Ballotpedia: ${c.full_name} (${ballotpediaUrl})`);
      } else if (!wikipediaUrl && knownQid) {
        // Had a known QID with no enwiki sitelink, AND Ballotpedia found
        // nothing either -- worth naming explicitly rather than folding
        // into the generic Wikipedia-only miss message above.
        knownQidMisses.push(`${c.full_name} (QID ${knownQid} has no enwiki sitelink; no Ballotpedia match either)`);
      }
    }

    if (!result) continue;

    c.bio_summary = { value: result.summary, source_url: result.sourceUrl, source_type: result.sourceType };
    c._bio_summary_resolved_at = new Date().toISOString();
    changed = true;
    findings.push(`  FOUND (${result.sourceType}): ${c.full_name} (${result.sourceUrl})`);
  }

  if (changed) writeFileSync(filePath, JSON.stringify(data, null, 2));
  return { findings, knownQidMisses };
}

async function main() {
  const houseDir = join(BUILD_DIR, "house");
  const senateDir = join(BUILD_DIR, "senate");
  let checked = 0;
  let found = 0;
  const allFindings: string[] = [];
  const allKnownQidMisses: string[] = [];

  for (const f of readdirSync(houseDir).sort()) {
    const state = f.split("-")[0];
    const district = f.replace(".json", "").split("-")[1];
    checked++;
    const { findings, knownQidMisses } = await processRaceFile(join(houseDir, f), state, "H", district);
    if (findings.length) allFindings.push(`house/${f}:`, ...findings);
    found += findings.filter((x) => x.startsWith("  FOUND")).length;
    allKnownQidMisses.push(...knownQidMisses.map((m) => `house/${f}: ${m}`));
  }
  for (const f of readdirSync(senateDir).sort()) {
    const state = f.replace(".json", "");
    checked++;
    const { findings, knownQidMisses } = await processRaceFile(join(senateDir, f), state, "S", null);
    if (findings.length) allFindings.push(`senate/${f}:`, ...findings);
    found += findings.filter((x) => x.startsWith("  FOUND")).length;
    allKnownQidMisses.push(...knownQidMisses.map((m) => `senate/${f}: ${m}`));
  }

  allFindings.forEach((f) => console.log(f));
  console.log(`\nDone. ${checked} race files checked, ${found} candidates gained a Wikipedia-sourced Background Summary.`);

  // Completeness check, not left for a human to spot by chance (that's how
  // Rep. James Clyburn was found missing this session) -- anyone with an
  // ALREADY-CONFIRMED Wikidata QID who still has no bio_summary after this
  // run is a real, named, actionable gap, not silence.
  if (allKnownQidMisses.length) {
    console.log(`\n${allKnownQidMisses.length} candidate(s) with a KNOWN Wikidata QID still have no Background Summary:`);
    allKnownQidMisses.forEach((m) => console.log(`  - ${m}`));
  } else {
    console.log(`\nCompleteness check: 0 candidates with a known Wikidata QID were missed this run.`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
