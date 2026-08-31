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

// Pulls a candidate's already-confirmed Wikidata QID (if any) out of their
// own bio{} object, for callers that want to pass it as getBioFacts'
// knownQid shortcut rather than re-searching. Only date_of_birth/
// birthplace/college ever carry a wikidata_structured source_url (see
// build.ts) — checked in that order, first match wins, since all three
// point at the same entity for a given candidate anyway.
export function extractKnownQid(bio: Record<string, { source_type?: string; source_url?: string } | null | undefined> | undefined): string | undefined {
  for (const field of [bio?.date_of_birth, bio?.birthplace, bio?.college]) {
    if (field?.source_type !== "wikidata_structured") continue;
    const match = field.source_url?.match(/Q\d+$/);
    if (match) return match[0];
  }
  return undefined;
}

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

export async function getEntity(qid: string): Promise<any> {
  try {
    const res = await fetch(`https://www.wikidata.org/wiki/Special:EntityData/${qid}.json`);
    // A non-ok response (429 rate-limit, 5xx) used to return null here with
    // zero logging — identical to "this entity genuinely doesn't exist,"
    // the exact silent-failure shape this codebase has scar tissue over
    // (see the Anthropic-credit-exhaustion incidents). Confirmed causing
    // real damage under concurrency: bestCollegeClaim() walks a candidate's
    // P69 claims calling this per claim, and enough parallel candidates
    // (10 at once, each with several claims) hit Wikidata's rate limit hard
    // enough that already-correct, already-published values (Harvard
    // College, University of Wisconsin–Madison, Reed College) silently
    // resolved to "no claim looks like a real college" and got wiped —
    // caught before publishing only because the results were manually
    // spot-checked, not because anything here would have surfaced it.
    if (!res.ok) {
      console.warn(`[wikidata] entity fetch for ${qid} returned HTTP ${res.status} — treating as unknown, NOT as "no data" (rate limit or transient error, not a real absence)`);
      return null;
    }
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
export async function getLabel(qid: string, disambiguateWithState = false): Promise<string | null> {
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

export function looksLikeAPolitician(claims: any): boolean {
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

  // Used to also accept ANY P39 (position held) claim on its own, on the
  // theory that a real minor candidate might be tagged with something
  // other than "politician" but still hold some office. In practice this
  // let through a confirmed wrong-person collision: Alaska AK-AL candidate
  // "John Brendan Williams" name-matched the Wikidata entity for the film
  // composer John Williams (Star Wars, Jaws) — occupation claims are
  // composer/conductor, nothing politician-shaped, but he has exactly one
  // P39 claim (an honorary musical-director-style title, not a government
  // office), which alone was enough to pass. A "position held" this loose
  // is satisfied by an enormous range of unrelated notable people
  // (musicians with honorary titles, executives on boards, academics),
  // and there is no way to tell those apart from a real minor officeholder
  // without checking what the specific position IS — not attempted here,
  // so the safer fix is requiring the explicit occupation tag instead.
  const occupations = (claims.P106 ?? []).map((c: any) => c.mainsnak?.datavalue?.value?.id);
  return occupations.includes(OCCUPATION_POLITICIAN);
}

// Matches an entity's own English description ("public university in...",
// "college in...", "Public law school in...") against known higher-ed
// institution types. Deliberately a POSITIVE allowlist, not a denylist of
// non-college types — a denylist already proved incomplete twice on real
// candidates: Rep. Mark Messmer's Purdue University claim was preceded by
// a "high school" claim (caught fine), but Sen. Harriet Hageman's real
// degrees (Casper College, University of Wyoming, its College of Law) were
// preceded by a P69 claim for "Goshen County School District Number 1" —
// a Wikidata type (school district) nobody had anticipated needing to
// exclude, so it was accepted as her "college" on the very first claim
// checked. A denylist only ever covers the K-12-adjacent types someone
// already thought to list; a positive check for actual higher-ed language
// in the description doesn't need to anticipate every non-college type in
// advance. Bare "school" is deliberately excluded from the keyword list —
// it would also match "school district" and "high school" again. Bare
// "academy" is excluded for the same reason (Rep. Nick Begich's real HIGH
// SCHOOL is "The Master's Academy") — "service academy" is included
// instead, specific enough to mean one of the five federal military
// academies (West Point's own description is literally "federal service
// academy in West Point, New York") without matching a K-12 prep school.
// "seminary" added after Rep.-candidate Lindsay James's real graduate
// theology degree (Fuller Theological Seminary) was missed the same way.
const HIGHER_ED_DESCRIPTION_KEYWORDS = /\b(university|college|law school|medical school|business school|graduate school|institute of technology|seminary|service academy)\b/i;

// A person's "educated at" (P69) claims aren't ordered by education level —
// array position is Wikidata edit-history order, not relevance. Confirmed on
// Rep. Shontel Brown: index 0 was "John Adams High School" even though her
// actual college (Wilberforce University) is also a P69 claim, just listed
// later — naively taking [0] mislabeled a high school as her "college".
// Walk the claims in order and skip any that don't look like higher ed. If
// nothing in the list does, there's no real college claim to report —
// falling back to the first (non-college) claim anyway would just repeat
// the exact bug this function exists to avoid, so return null instead.
export async function bestCollegeClaim(claims: any): Promise<string | null> {
  const qids: string[] = (claims.P69 ?? []).map((c: any) => c.mainsnak?.datavalue?.value?.id).filter(Boolean);
  for (const qid of qids) {
    const entity = await getEntity(qid);
    const description: string = entity?.descriptions?.en?.value ?? "";
    if (HIGHER_ED_DESCRIPTION_KEYWORDS.test(description)) return qid;
  }
  return null;
}

// Common names collide (a minor local candidate can share a name with an
// unrelated notable person). Rather than trust the top search hit blindly —
// which would misattribute a stranger's birthdate to this candidate — this
// walks the top few results and only accepts one whose own Wikidata claims
// mark them as a politician/officeholder. No confident match, no data.
//
// knownQid: an optional shortcut for a candidate who has ALREADY had a
// Wikidata match confirmed at some point (their own bio{} data already
// carries a wikidata_structured source_url) — skips searchCandidateEntities
// entirely and goes straight to fetching that QID. This matters because the
// SEARCH step specifically is the flaky part of this pipeline, not the
// entity fetch: confirmed on Rep. James Clyburn, whose Wikidata entity
// (Q1289889) fetches cleanly and instantly every time, but whose NAME
// SEARCH intermittently returns nothing across several otherwise-identical
// runs (the same class of flakiness this file's own header comment already
// documents for Rep. Tim Walberg). For a candidate with a known QID, a
// fresh search buys nothing and only reintroduces the failure mode a
// direct fetch avoids — still re-validates looksLikeAPolitician() below
// rather than trusting the QID blindly, in case an entity's claims
// genuinely changed since it was first confirmed.
export async function getBioFacts(fullName: string, knownQid?: string): Promise<WikidataBioFacts | null> {
  const candidateQids = knownQid ? [knownQid] : await searchCandidateEntities(fullName);

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
