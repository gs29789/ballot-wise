// Structured public-figure data from Wikidata. Unlike prose extraction, these
// are exact machine-readable claims (not LLM-inferred), so no quote-anchoring
// is needed — the "source" is the claim itself, cited by property + entity URL.

interface WikidataBioFacts {
  qid: string;
  entityUrl: string;
  date_of_birth: string | null;
  birthplace: string | null;
  college: string | null;
  wikipediaUrl: string | null;
}

const OCCUPATION_POLITICIAN = "Q82955";

// Every caller of getBioFacts wraps it in .catch(() => null) — correct for
// "this candidate genuinely has no Wikidata entry," but that same swallow
// also hides a transient fetch failure (network blip, rate limit) with zero
// signal, indistinguishable from real absence — same silent-failure shape
// already confirmed and fixed once for the Anthropic calls in llmExtract.ts.
// Confirmed happening here in practice: Rep. Tim Walberg's bio came back
// fully populated (6 fields) on one build and completely empty on the very
// next, unchanged, rebuild — logged here so that gap is visible next time
// instead of looking like "no public record found."
async function searchCandidateEntities(name: string): Promise<string[]> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
    name
  )}&language=en&type=item&format=json&limit=5`;
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.search ?? []).map((r: any) => r.id);
  } catch (err: any) {
    console.warn(`[wikidata] search failed for "${name}": ${err?.message ?? err}`);
    return [];
  }
}

async function getEntity(qid: string): Promise<any> {
  try {
    const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.entities?.[qid] ?? null;
  } catch (err: any) {
    console.warn(`[wikidata] entity fetch failed for ${qid}: ${err?.message ?? err}`);
    return null;
  }
}

function englishWikipediaUrl(entity: any): string | null {
  const title = entity?.sitelinks?.enwiki?.title;
  return title ? `https://en.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, "_"))}` : null;
}

const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut",
  "Delaware", "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa",
  "Kansas", "Kentucky", "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan",
  "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire",
  "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio",
  "Oklahoma", "Oregon", "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota",
  "Tennessee", "Texas", "Utah", "Vermont", "Virginia", "Washington", "West Virginia",
  "Wisconsin", "Wyoming", "District of Columbia",
];

// A bare place-name label ("Greenwich") is ambiguous — Wikidata's description
// ("town in Fairfield County, Connecticut...") usually names the state, so
// disambiguate by appending it when found rather than showing the name alone.
async function getLabel(qid: string, disambiguateWithState = false): Promise<string | null> {
  let entity: any;
  try {
    const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
    if (!res.ok) return null;
    const data = await res.json();
    entity = data.entities?.[qid];
  } catch (err: any) {
    console.warn(`[wikidata] label fetch failed for ${qid}: ${err?.message ?? err}`);
    return null;
  }
  const label = entity?.labels?.en?.value ?? null;
  if (!label) return null;
  if (!disambiguateWithState) return label;

  const description: string = entity?.descriptions?.en?.value ?? "";
  const state = US_STATES.find((s) => description.includes(s));
  return state && !label.includes(state) ? `${label}, ${state}` : label;
}

// Wikidata dates carry a precision (9 = year only, 10 = year+month, 11 = full
// day) — some public figures only have a year on record. Formatting blindly
// as YYYY-MM-DD renders missing parts as a fake "00", e.g. "1962-00-00".
function formatWikidataDate(value: { time: string; precision: number }): string {
  const raw = value.time.replace(/^\+/, ""); // "1962-00-00T00:00:00Z"
  const [year, month, day] = raw.slice(0, 10).split("-");
  if (value.precision >= 11) return `${year}-${month}-${day}`;
  if (value.precision === 10) return `${year}-${month}`;
  return year;
}

function bestDateOfBirthClaim(claims: any): { time: string; precision: number } | null {
  const statements = claims.P569 ?? [];
  if (!statements.length) return null;
  const values = statements.map((s: any) => s.mainsnak?.datavalue?.value).filter(Boolean);
  return values.sort((a: any, b: any) => b.precision - a.precision)[0] ?? null;
}

const COUNTRY_UNITED_STATES = "Q30";

function looksLikeAPolitician(claims: any): boolean {
  if (claims.P570) return false; // has a recorded date of death — can't be a 2026 candidate

  // A common American name/nickname combination can match a real politician
  // from a different country entirely — confirmed on "John David Hancock
  // Jr" (OH-1 candidate): the "Dave" variant of his middle name matched
  // "Dave Hancock," a real but unrelated Canadian politician, who then
  // passed every check below since nothing here previously looked at
  // nationality. Only reject on an EXPLICIT non-US citizenship claim — fail
  // open when P27 is simply absent, which is common for minor candidates
  // with sparse Wikidata entries and shouldn't cost them a real match.
  const citizenships = (claims.P27 ?? []).map((c: any) => c.mainsnak?.datavalue?.value?.id);
  if (citizenships.length && !citizenships.includes(COUNTRY_UNITED_STATES)) return false;

  const occupations = (claims.P106 ?? []).map((c: any) => c.mainsnak?.datavalue?.value?.id);
  if (occupations.includes(OCCUPATION_POLITICIAN)) return true;
  return Boolean(claims.P39); // has held some position — officeholder/candidate-adjacent
}

const SECONDARY_SCHOOL_TYPES = new Set([
  "Q9826", // high school
  "Q3249719", // middle school
  "Q1244442", // elementary school
]);

// A person's "educated at" (P69) claims aren't ordered by education level —
// array position is Wikidata edit-history order, not relevance. Confirmed on
// Rep. Shontel Brown: index 0 was "John Adams High School" even though her
// actual college (Wilberforce University) is also a P69 claim, just listed
// later — naively taking [0] mislabeled a high school as her "college".
// Walk the claims in order and skip any confirmed secondary school.
async function bestCollegeClaim(claims: any): Promise<string | null> {
  const qids: string[] = (claims.P69 ?? []).map((c: any) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
  for (const qid of qids) {
    const entity = await getEntity(qid);
    const instanceOf = (entity?.claims?.P31 ?? []).map((c: any) => c.mainsnak?.datavalue?.value?.id);
    if (!instanceOf.some((t: string) => SECONDARY_SCHOOL_TYPES.has(t))) return qid;
  }
  return qids[0] ?? null;
}

// Common names collide (a minor local candidate can share a name with an
// unrelated notable person). Rather than trust the top search hit blindly —
// which would misattribute a stranger's birthdate to this candidate — this
// walks the top few results and only accepts one whose own Wikidata claims
// mark them as a politician/officeholder. No confident match, no data.
export async function getBioFacts(fullName: string): Promise<WikidataBioFacts | null> {
  const candidateQids = await searchCandidateEntities(fullName);

  for (const qid of candidateQids) {
    const entity = await getEntity(qid);
    const claims = entity?.claims;
    if (!claims || !looksLikeAPolitician(claims)) continue;

    const dob = bestDateOfBirthClaim(claims);
    const birthplaceQid = claims.P19?.[0]?.mainsnak?.datavalue?.value?.id;
    const collegeQid = await bestCollegeClaim(claims);

    return {
      qid,
      entityUrl: `https://www.wikidata.org/wiki/${qid}`,
      date_of_birth: dob ? formatWikidataDate(dob) : null,
      birthplace: birthplaceQid ? await getLabel(birthplaceQid, true) : null,
      college: collegeQid ? await getLabel(collegeQid, false) : null,
      wikipediaUrl: englishWikipediaUrl(entity),
    };
  }
  return null;
}
