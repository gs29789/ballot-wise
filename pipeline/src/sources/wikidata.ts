// Structured public-figure data from Wikidata. Unlike prose extraction, these
// are exact machine-readable claims (not LLM-inferred), so no quote-anchoring
// is needed — the "source" is the claim itself, cited by property + entity URL.

interface WikidataBioFacts {
  qid: string;
  entityUrl: string;
  date_of_birth: string | null;
  birthplace: string | null;
  college: string | null;
}

const OCCUPATION_POLITICIAN = "Q82955";

async function searchCandidateEntities(name: string): Promise<string[]> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
    name
  )}&language=en&type=item&format=json&limit=5`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return (data.search ?? []).map((r: any) => r.id);
}

async function getEntityClaims(qid: string): Promise<any> {
  const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.entities?.[qid]?.claims ?? null;
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
  const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  if (!res.ok) return null;
  const data = await res.json();
  const entity = data.entities?.[qid];
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

function looksLikeAPolitician(claims: any): boolean {
  if (claims.P570) return false; // has a recorded date of death — can't be a 2026 candidate
  const occupations = (claims.P106 ?? []).map((c: any) => c.mainsnak?.datavalue?.value?.id);
  if (occupations.includes(OCCUPATION_POLITICIAN)) return true;
  return Boolean(claims.P39); // has held some position — officeholder/candidate-adjacent
}

// Common names collide (a minor local candidate can share a name with an
// unrelated notable person). Rather than trust the top search hit blindly —
// which would misattribute a stranger's birthdate to this candidate — this
// walks the top few results and only accepts one whose own Wikidata claims
// mark them as a politician/officeholder. No confident match, no data.
export async function getBioFacts(fullName: string): Promise<WikidataBioFacts | null> {
  const candidateQids = await searchCandidateEntities(fullName);

  for (const qid of candidateQids) {
    const claims = await getEntityClaims(qid);
    if (!claims || !looksLikeAPolitician(claims)) continue;

    const dob = bestDateOfBirthClaim(claims);
    const birthplaceQid = claims.P19?.[0]?.mainsnak?.datavalue?.value?.id;
    const collegeQid = claims.P69?.[0]?.mainsnak?.datavalue?.value?.id;

    return {
      qid,
      entityUrl: `https://www.wikidata.org/wiki/${qid}`,
      date_of_birth: dob ? formatWikidataDate(dob) : null,
      birthplace: birthplaceQid ? await getLabel(birthplaceQid, true) : null,
      college: collegeQid ? await getLabel(collegeQid, false) : null,
    };
  }
  return null;
}
