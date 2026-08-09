import AdmZip from "adm-zip";
import { XMLParser } from "fast-xml-parser";
import Anthropic from "@anthropic-ai/sdk";

// House candidates and members are legally required (Ethics in Government
// Act) to file a Personal Financial Disclosure Report with the Clerk of the
// House — real assets, liabilities, earned income, and outside positions,
// not campaign finance. The Clerk publishes a free bulk index per year
// (disclosures-clerk.house.gov/public_disc/financial-pdfs/{year}FD.zip: a
// structured XML of every filer's name/state-district/DocID) plus the
// individual filing as a PDF at a predictable URL from that DocID. No key
// and no search UI needed — but it IS behind an Akamai WAF that will start
// returning a flat 403 "Access Denied" if hit too many times in a short
// window (triggered during this feature's own development by ~20 requests
// in under two hours). Keep real usage to one bulk index fetch per year per
// build run — fine for weekly builds, but don't loop-test against the live
// endpoint; if you get a wall of 403s, this is almost certainly why, not a
// code bug — wait it out rather than retrying harder.
//
// Filings come in two different templates, and this extracts the same six
// yes/no facts from either: an older scanned/hand-filled paper form with a
// printed "Preliminary Information" checkbox section, and a newer typed
// digital report with named Schedule sections each stating "None disclosed"
// or listing real entries. Only these six structural facts are extracted —
// never the itemized details (asset names, creditor names, exact figures)
// on the old paper template specifically, because those are handwritten. A
// first attempt at itemized extraction was tested against a real filing and
// cross-checked by hand: it misread "Residence" as "Presidency", "Burial
// Insurance" as "Pauma Insurance", and several other materially wrong
// words — messy cursive isn't reliably readable by single-pass vision
// extraction, and unlike every other source in this pipeline there's no
// snippet to verify a handwritten read against. The newer typed template's
// schedules ARE reliably readable (it's typed text, not handwriting) but
// this stays consistent and conservative across both formats rather than
// extracting richer detail only when the filer happens to have the newer
// template — every candidate always links to the real PDF for full detail.
//
// The Senate has an equivalent (efdsearch.senate.gov) that this project
// deliberately does not touch: unlike the House's open bulk data, it
// requires clicking through a statutory "I agree" notice (Ethics in
// Government Act §105(c), which lists prohibited uses) before searching —
// a consent step meant for a human, not something to automate past.

const DISCLOSURE_BASE = "https://disclosures-clerk.house.gov/public_disc/financial-pdfs";

interface DisclosureIndexEntry {
  last: string;
  first: string;
  suffix: string;
  filingType: string;
  stateDst: string; // e.g. "DE00"
  filingDate: string; // when it was filed — NOT necessarily the same as `year`
  year: number; // which {year}FD.zip bucket (and PDF folder) this entry lives in
  docId: string;
}

const indexCache = new Map<number, Promise<DisclosureIndexEntry[]>>();

async function fetchDisclosureIndex(year: number): Promise<DisclosureIndexEntry[]> {
  let cached = indexCache.get(year);
  if (!cached) {
    cached = (async () => {
      try {
        const res = await fetch(`${DISCLOSURE_BASE}/${year}FD.zip`);
        if (!res.ok) throw new Error(`FD index fetch failed: ${res.status}`);
        const buf = Buffer.from(await res.arrayBuffer());
        const zip = new AdmZip(buf);
        const xmlEntry = zip.getEntries().find((e) => e.entryName.endsWith(".xml"));
        if (!xmlEntry) throw new Error("FD index zip has no XML entry");
        const parser = new XMLParser({ ignoreAttributes: true });
        const parsed = parser.parse(xmlEntry.getData().toString("utf-8"));
        const members = parsed?.FinancialDisclosure?.Member;
        const list = Array.isArray(members) ? members : members ? [members] : [];
        return list.map((m: any) => ({
          last: String(m.Last ?? ""),
          first: String(m.First ?? ""),
          suffix: String(m.Suffix ?? ""),
          filingType: String(m.FilingType ?? ""),
          stateDst: String(m.StateDst ?? ""),
          filingDate: String(m.FilingDate ?? ""),
          year: Number(m.Year ?? year),
          docId: String(m.DocID ?? ""),
        }));
      } catch (e) {
        // Don't let one failed fetch poison every subsequent candidate for
        // the rest of this process — evict so the next call gets a fresh
        // attempt instead of permanently inheriting this one failure.
        indexCache.delete(year);
        throw e;
      }
    })();
    indexCache.set(year, cached);
  }
  return cached;
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z]/g, "");
}

// FEC gives names as "LAST SUFFIX, FIRST MIDDLE" — matched against the
// index's separate Last/First fields. stateDst disambiguates common names
// (confirmed necessary: this system covers every House candidate
// nationwide, and name collisions are real — see ballotReady.ts for a
// concrete example of the same risk in a different source).
async function findDocId(fecName: string, stateDst: string, cycle: number): Promise<{ docId: string; filingDate: string; year: number } | null> {
  const [lastPart, restPart] = fecName.split(",").map((s) => s.trim());
  const firstToken = (restPart ?? "").split(/\s+/)[0] ?? "";
  const lastNorm = normalize(lastPart ?? "");
  const firstNorm = normalize(firstToken);

  for (const year of [cycle, cycle - 1]) {
    const index = await fetchDisclosureIndex(year).catch(() => []);
    const matches = index.filter(
      (e) => normalize(e.last).includes(lastNorm.replace(/(ii|iii|iv|jr|sr)$/, "")) && normalize(e.first).startsWith(firstNorm) && e.stateDst === stateDst
    );
    if (matches.length) {
      matches.sort((a, b) => new Date(b.filingDate).getTime() - new Date(a.filingDate).getTime());
      return { docId: matches[0].docId, filingDate: matches[0].filingDate, year: matches[0].year };
    }
  }
  return null;
}

export interface FinancialDisclosureSummary {
  pdfUrl: string;
  filingDate: string;
  hasReportableAssets: boolean | null; // Q A: reportable asset >$1,000, or >$200 unearned income
  hasEarnedIncome: boolean | null; // Q C: $200+ earned income (salary, honoraria, pension/IRA)
  hasReportableLiabilities: boolean | null; // Q D: liability >$10,000
  hasReportablePositions: boolean | null; // Q E: held a reportable outside position
  hasOutsideAgreements: boolean | null; // Q F: agreement/arrangement with an outside entity
  hasLargeCompensation: boolean | null; // Q J: >$5,000 compensation from a single source
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const EXTRACTION_PROMPT = `This is a U.S. House Financial Disclosure Report. Two different templates are in circulation — an older scanned/hand-filled paper form with a "PRELIMINARY INFORMATION" section of six printed Yes/No checkbox questions, and a newer typed digital report with named "Schedule" sections (Schedule A: Assets, Schedule C: Earned Income, Schedule D: Liabilities, Schedule E: Positions, Schedule F: Agreements) each stating either "None disclosed" or listing actual entries. Determine which template this is and answer six equivalent yes/no facts accordingly — from the checkboxes on the old template, or from whether each named Schedule has at least one real entry (not "None disclosed") on the new template.

First confirm identity: does the filer's name, together with the state/district shown, match this expected candidate: {{CONTEXT}}? If the document is clearly for a different person, set "matchesExpectedCandidate" to false and set every field below to null.

For each fact, report true or false based on what's actually shown, and null ONLY if you genuinely cannot determine it (illegible, ambiguous, or the document doesn't cover that item at all) — never guess.

Output ONLY valid JSON in this exact shape, no other text:
{
  "matchesExpectedCandidate": true | false,
  "hasReportableAssets": true | false | null,
  "hasEarnedIncome": true | false | null,
  "hasReportableLiabilities": true | false | null,
  "hasReportablePositions": true | false | null,
  "hasOutsideAgreements": true | false | null,
  "hasLargeCompensation": true | false | null
}
hasReportableAssets: owned a reportable asset worth >$1,000, or received >$200 in unearned income (old template Question A; new template: Schedule A has any entry).
hasEarnedIncome: had $200+ of earned income — salary, honoraria, pension/IRA distributions (old template Question C; new template: Schedule C has any entry).
hasReportableLiabilities: had a reportable liability >$10,000 (old template Question D; new template: Schedule D has any entry).
hasReportablePositions: held a reportable outside position (old template Question E; new template: Schedule E has any entry).
hasOutsideAgreements: had a reportable agreement/arrangement with an outside entity, e.g. future employment (old template Question F; new template: Schedule F has any entry).
hasLargeCompensation: received compensation over $5,000 from a single source in the current year and two prior years (old template Question J only — the new template has no direct equivalent visible; if you cannot find an equivalent statement, set this to null rather than guessing).`;

// One retry after a short delay, to absorb an ordinary transient network
// blip on the PDF fetch or the API call — cheap insurance that doesn't mask
// a genuine "no filing" or "wrong person" result, both of which return null
// immediately rather than retrying. (The much bigger failure mode — every
// candidate in a build coming back null together — turned out to be cache
// poisoning in fetchDisclosureIndex, not this call; see that function's
// comment.)
async function attemptExtraction(pdfUrl: string, fecName: string, expectedContext: string, filingDate: string): Promise<FinancialDisclosureSummary | null> {
  const res = await fetch(pdfUrl);
  if (!res.ok) return null;
  const pdfBuffer = Buffer.from(await res.arrayBuffer());
  if (pdfBuffer.byteLength > 30_000_000) return null; // sanity cap, well above any real filing

  const message = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBuffer.toString("base64") } },
          { type: "text", text: EXTRACTION_PROMPT.replace("{{CONTEXT}}", `${fecName} — ${expectedContext}`) },
        ],
      },
    ],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  const jsonText = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
  const parsed = JSON.parse(jsonText);
  if (!parsed.matchesExpectedCandidate) return null;
  const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
  return {
    pdfUrl,
    filingDate,
    hasReportableAssets: bool(parsed.hasReportableAssets),
    hasEarnedIncome: bool(parsed.hasEarnedIncome),
    hasReportableLiabilities: bool(parsed.hasReportableLiabilities),
    hasReportablePositions: bool(parsed.hasReportablePositions),
    hasOutsideAgreements: bool(parsed.hasOutsideAgreements),
    hasLargeCompensation: bool(parsed.hasLargeCompensation),
  };
}

export async function getFinancialDisclosure(fecName: string, stateDst: string, cycle: number, expectedContext: string): Promise<FinancialDisclosureSummary | null> {
  const found = await findDocId(fecName, stateDst, cycle);
  if (!found) return null;

  // PDFs live under the XML's <Year> bucket folder — NOT necessarily the
  // same as FilingDate's year (confirmed on a real filing: a report
  // covering 2025 filed in May 2026 lives under the 2025 folder).
  const pdfUrl = `${DISCLOSURE_BASE}/${found.year}/${found.docId}.pdf`;

  for (let attempt = 1; attempt <= 2; attempt++) {
    const result = await attemptExtraction(pdfUrl, fecName, expectedContext, found.filingDate).catch(() => null);
    if (result) return result;
    if (attempt === 1) await new Promise((r) => setTimeout(r, 2000));
  }
  return null;
}
