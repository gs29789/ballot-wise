import "dotenv/config";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { getBioFacts } from "../sources/wikidata.js";
import { extractBioSummaryFromWikipedia } from "../sources/campaignBioSummary.js";
import { searchNameVariants, WIKIDATA_UNRELIABLE_CANDIDATES } from "../build.js";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// wikidata.ts's own header comment documents real, confirmed flakiness in
// Wikidata's search backend (a name coming back fully populated on one
// build and completely empty on the very next, unchanged one) -- this
// script's first real run hit exactly that at much higher severity than
// expected (296 eligible candidates, only 7 total wikidata hits logged,
// including candidates independently reconfirmed by hand moments later
// with a clean, immediate success on the exact same name). Retrying once
// after a short pause, rather than trusting a single miss, matches how
// this exact flakiness is already known to resolve itself on this API.
async function getBioFactsWithRetry(name: string) {
  const first = await getBioFacts(name).catch(() => null);
  if (first?.wikipediaUrl) return first;
  await sleep(400);
  return getBioFacts(name).catch(() => null);
}

// One-time backlog pass, not wired into any routine: for every candidate
// with no campaign_site_url AND no bio_summary on file, tries to resolve a
// Wikipedia article via Wikidata (free) and, if found, extracts a
// Background Summary from it (one paid call each) — the same fallback
// build.ts now does automatically, just applied here to the already-
// published backlog rather than waiting for each race's next natural
// rebuild. Deliberately does NOT re-attempt campaign-site discovery first
// (that's scaleNoSiteBacklog.ts's job, a separate paid activity) --
// campaign_site_url as currently on file is trusted as-is, matching
// exactly what build.ts's own gate would see if it ran today.
const BUILD_DIR = join(import.meta.dirname, "..", "..", "build");

interface Candidate {
  full_name: string;
  fec_candidate_id: string;
  campaign_site_url?: string | null;
  bio_summary?: { value: string; source_url: string; source_type: string } | null;
  _bio_summary_resolved_at?: string;
  [key: string]: unknown;
}

async function processRaceFile(filePath: string, state: string, office: "H" | "S"): Promise<string[]> {
  const raw = readFileSync(filePath, "utf8");
  const data = JSON.parse(raw);
  if (!data || !Array.isArray(data.candidates)) return [];

  const expectedContext = `a candidate for ${office === "H" ? "U.S. House of Representatives" : "U.S. Senate"} from ${state}`;
  let changed = false;
  const findings: string[] = [];

  for (const c of data.candidates as Candidate[]) {
    if (c.campaign_site_url || c.bio_summary?.value) continue;
    if (WIKIDATA_UNRELIABLE_CANDIDATES.has(c.fec_candidate_id)) continue;

    let wikipediaUrl: string | null = null;
    for (const nameVariant of searchNameVariants(c.full_name)) {
      const wikidata = await getBioFactsWithRetry(nameVariant);
      if (wikidata?.wikipediaUrl) {
        wikipediaUrl = wikidata.wikipediaUrl;
        break;
      }
    }
    await sleep(120); // pace requests against Wikidata's search backend rather than firing ~300 back-to-back
    if (!wikipediaUrl) continue;

    const result = await extractBioSummaryFromWikipedia(c.full_name, wikipediaUrl, expectedContext).catch(() => null);
    if (!result) {
      findings.push(`  no match: ${c.full_name} (${wikipediaUrl})`);
      continue;
    }

    c.bio_summary = { value: result.summary, source_url: result.sourceUrl, source_type: result.sourceType };
    c._bio_summary_resolved_at = new Date().toISOString();
    changed = true;
    findings.push(`  FOUND: ${c.full_name} (${wikipediaUrl})`);
  }

  if (changed) writeFileSync(filePath, JSON.stringify(data, null, 2));
  return findings;
}

async function main() {
  const houseDir = join(BUILD_DIR, "house");
  const senateDir = join(BUILD_DIR, "senate");
  let checked = 0;
  let found = 0;
  const allFindings: string[] = [];

  for (const f of readdirSync(houseDir).sort()) {
    const state = f.split("-")[0];
    checked++;
    const findings = await processRaceFile(join(houseDir, f), state, "H");
    if (findings.length) allFindings.push(`house/${f}:`, ...findings);
    found += findings.filter((x) => x.startsWith("  FOUND")).length;
  }
  for (const f of readdirSync(senateDir).sort()) {
    const state = f.replace(".json", "");
    checked++;
    const findings = await processRaceFile(join(senateDir, f), state, "S");
    if (findings.length) allFindings.push(`senate/${f}:`, ...findings);
    found += findings.filter((x) => x.startsWith("  FOUND")).length;
  }

  allFindings.forEach((f) => console.log(f));
  console.log(`\nDone. ${checked} race files checked, ${found} candidates gained a Wikipedia-sourced Background Summary.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
