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

async function searchEntity(name: string): Promise<string | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(
    name
  )}&language=en&type=item&format=json&limit=1`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.search?.[0]?.id ?? null;
}

async function getLabel(qid: string): Promise<string | null> {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.entities?.[qid]?.labels?.en?.value ?? null;
}

function isoDate(wikidataTime: string): string {
  // Wikidata time values look like "+1990-08-09T00:00:00Z"
  return wikidataTime.replace(/^\+/, "").slice(0, 10);
}

export async function getBioFacts(fullName: string): Promise<WikidataBioFacts | null> {
  const qid = await searchEntity(fullName);
  if (!qid) return null;

  const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
  if (!res.ok) return null;
  const data = await res.json();
  const claims = data.entities?.[qid]?.claims ?? {};

  const dob = claims.P569?.[0]?.mainsnak?.datavalue?.value?.time;
  const birthplaceQid = claims.P19?.[0]?.mainsnak?.datavalue?.value?.id;
  const collegeQid = claims.P69?.[0]?.mainsnak?.datavalue?.value?.id;

  return {
    qid,
    entityUrl: `https://www.wikidata.org/wiki/${qid}`,
    date_of_birth: dob ? isoDate(dob) : null,
    birthplace: birthplaceQid ? await getLabel(birthplaceQid) : null,
    college: collegeQid ? await getLabel(collegeQid) : null,
  };
}
