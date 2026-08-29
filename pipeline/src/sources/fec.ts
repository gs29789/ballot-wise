const FEC_BASE = "https://api.open.fec.gov/v1";

export interface FecCandidate {
  candidateId: string;
  name: string;
  party: string;
  office: "H" | "S";
  incumbentChallenge: string;
  candidateStatus: string;
  electionYears: number[];
}

export interface FecTotals {
  cycle: number;
  totalRaised: number | null;
  totalSpent: number | null;
  cashOnHand: number | null;
  fundingSources: {
    smallDollar: number | null; // unitemized individual contributions — donors giving <$200
    largeDollar: number | null; // itemized individual contributions — donors giving >$200
    pac: number | null; // other_political_committee_contributions (PACs, not party committees)
    party: number | null; // political_party_committee_contributions
    selfFunded: number | null; // candidate_contribution + loans_made_by_candidate
  };
}

function apiKey(): string {
  const key = process.env.FEC_API_KEY;
  if (!key) throw new Error("FEC_API_KEY not set");
  return key;
}

// 'C' (statutory candidate) and 'P' (present-tense filer) are established
// filers. 'N' rows have filed a Statement of Candidacy but haven't crossed
// FEC's $5,000 raised/spent threshold yet — still a real, legally declared
// federal candidate, just an underfunded one. Included so this doesn't quietly
// exclude anyone actually on the ballot for being unfunded; the frontend
// labels 'N' candidates distinctly rather than presenting them as equally
// established. Rows whose election_years doesn't include the cycle are
// leftover registrations from a past run and stay excluded regardless of status.
//
// district: required for House races in a state with more than one seat —
// without it, a multi-district state's search returns every House candidate
// statewide lumped together with no way to tell which district each is
// running in (confirmed: FEC's own district filter cleanly separates
// Montana's MT-01 from MT-02 candidates). Omit for at-large House races and
// Senate races, where the whole state is the one district.
// Every downstream consumer (slugify(), the frontend's toTitleCase()) trusts
// FEC's own "LAST, FIRST MIDDLE" convention to flip a name into a readable
// one — reasonable, since FEC's filing form itself labels the fields that
// way. Confirmed one real exception: NY-1 incumbent Nick LaLota's FEC record
// (H2NY01190) has his name entered as "NICK, LALOTA" — reversed relative to
// every other candidate's record — which flips backwards into "Lalota Nick"
// everywhere a normal record would come out right. This is FEC's own filing
// data, not something to silently paper over with a general heuristic (there's
// no way to detect "this one's backwards" from the string alone without
// external knowledge of the person), so it's corrected by candidate ID here,
// same as any other quote-anchored, hand-verified fact in this pipeline.
const REVERSED_FEC_NAMES: Record<string, string> = {
  H2NY01190: "LALOTA, NICK",
  H6KY06234: "BOWMAN, JAY J",
  H4AK00164: "HAFNER, ERIC",
  // FL-13 incumbent Anna Paulina Luna's FEC record has her name entered as
  // "PAULINA LUNA, ANNA" -- reversed relative to congress.gov's own
  // "Luna, Anna Paulina", which silently broke the incumbent-to-bioguideId
  // name match (build.ts's normalizeNameForMatch never found a "paulina
  // luna" substring in "luna anna paulina"), zeroing out her entire
  // congressional track record despite her being a genuinely sitting member.
  H0FL13158: "LUNA, ANNA PAULINA",
  // Not reversed -- two different name-mismatch shapes, same symptom (the
  // incumbent-to-bioguideId match silently fails, zeroing out the whole
  // congressional track record) and same fix (correct the string used for
  // matching/display). MO-5's Emanuel Cleaver II: FEC's own suffix ("CLEAVER
  // II") never appears in congress.gov's "Cleaver, Emanuel", which drops
  // the suffix entirely. WA-3's Marie Gluesenkamp Perez: FEC treats
  // "Gluesenkamp Perez" as one compound surname, but congress.gov splits it
  // as "Perez, Marie Gluesenkamp" (Perez as the matched surname) -- neither
  // is "wrong", they just don't line up as substrings of each other.
  H4MO05234: "CLEAVER, EMANUEL",
  H2WA03217: "PEREZ, MARIE GLUESENKAMP",
};

// A real candidate can hold two live, non-cycle-stale FEC registrations for
// the very same race — confirmed on Gavin Solomon (DE Senate, 2026):
// S6DE00248 and S6DE00255 share the exact same name and address (401 E 34th
// Street, S11P, New York, NY 10016), both status 'N' with zero receipts.
// Unlike the reversed-name case above, this can't be caught with a general
// heuristic (nothing about either row looks individually wrong), and unlike
// a primary-loser duplicate, `primaryResults.ts`'s narrowing can't fix this
// either — that mechanism only applies once a primary has actually happened,
// and this pair are both still pre-primary as of when this was found.
// Excludes the later of the two filings (first_file_date 2026-07-13 vs.
// 2026-07-10 for the kept ID) — arbitrary as between two otherwise-identical
// registrations, but a real exclusion needs to pick one.
const DUPLICATE_CANDIDATE_IDS = new Set(["S6DE00255"]);

export async function searchCandidates(state: string, office: "H" | "S", cycle: number, district?: string): Promise<FecCandidate[]> {
  const districtParam = district ? `&district=${district}` : "";
  const url = `${FEC_BASE}/candidates/search/?state=${state}&cycle=${cycle}&office=${office}${districtParam}&per_page=100&api_key=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FEC candidates search failed: ${res.status}`);
  const data = await res.json();
  return (data.results as any[])
    .filter(
      (c) =>
        ["C", "P", "N"].includes(c.candidate_status) &&
        (c.election_years ?? []).includes(cycle) &&
        !DUPLICATE_CANDIDATE_IDS.has(c.candidate_id)
    )
    .map((c) => ({
      candidateId: c.candidate_id,
      name: REVERSED_FEC_NAMES[c.candidate_id] ?? c.name,
      party: c.party_full,
      office: c.office,
      incumbentChallenge: c.incumbent_challenge_full,
      candidateStatus: c.candidate_status,
      electionYears: c.election_years,
    }));
}

// Campaign website is optional on FEC Form 1 — only populated when the
// committee's treasurer filled it in, so this returns null for a lot of
// underfunded/minor candidates (confirmed empty for Whalen and Arminio in
// DE). Filtered to the principal campaign committee specifically, since
// incumbents also have unrelated joint fundraising committees on this
// endpoint whose "website" field is not the candidate's own site.
export async function getCommitteeWebsite(candidateId: string): Promise<string | null> {
  const url = `${FEC_BASE}/candidate/${candidateId}/committees/?api_key=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const principal = (data.results as any[])?.find((c) => c.designation_full === "Principal campaign committee");
  const site = principal?.website;
  if (!site) return null;
  // FEC returns some of these in all-caps (a data-entry artifact, not a
  // meaningful case) — lowercased for a readable citation link. Also strips
  // ALL whitespace, not just leading/trailing: a real URL never legitimately
  // contains a space, so any internal one (confirmed on real committee
  // filings: "fierroforcongress. com/", "deploy malloy.com") is a data-entry
  // typo, not something to preserve. Fixing this alone makes a dead-looking
  // site fetchable for some candidates (deploymalloy.com resolves fine) —
  // though not all (fierroforcongress.com's DNS genuinely doesn't resolve
  // even once the typo is fixed, so that one stays a real dead-site gap).
  const normalized = site.replace(/\s+/g, "").toLowerCase();
  return /^https?:\/\//.test(normalized) ? normalized : `https://${normalized}`;
}

function totalsFromRow(cycle: number, row: any): FecTotals {
  const selfFunded = (row.candidate_contribution ?? 0) + (row.loans_made_by_candidate ?? 0);
  return {
    cycle,
    totalRaised: row.receipts ?? null,
    totalSpent: row.disbursements ?? null,
    cashOnHand: row.cash_on_hand_end_period ?? null,
    fundingSources: {
      smallDollar: row.individual_unitemized_contributions ?? null,
      largeDollar: row.individual_itemized_contributions ?? null,
      pac: row.other_political_committee_contributions ?? null,
      party: row.political_party_committee_contributions ?? null,
      selfFunded: selfFunded || null,
    },
  };
}

// The FEC's /candidate/{id}/totals/ endpoint (which aggregates from whatever
// committee it has linked) is sometimes empty for a cycle even when the
// candidate's committee has real, substantial filings for it — confirmed
// directly against Harriet Hageman's 2026 House totals: the candidate-totals
// endpoint returned zero results while her committee (found by candidate_id)
// had $2M+ in receipts. Falls back to resolving the principal campaign
// committee directly and pulling totals from there when the first path
// comes up empty, rather than reporting a real incumbent as having raised
// nothing.
async function getTotalsViaCommittee(candidateId: string, cycle: number): Promise<FecTotals | null> {
  const url = `${FEC_BASE}/committees/?candidate_id=${candidateId}&api_key=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const committees = (data.results as any[]) ?? [];
  const principal = committees.find((c) => c.designation === "P") ?? committees[0];
  if (!principal) return null;

  const totalsUrl = `${FEC_BASE}/committee/${principal.committee_id}/totals/?cycle=${cycle}&api_key=${apiKey()}`;
  const totalsRes = await fetch(totalsUrl);
  if (!totalsRes.ok) return null;
  const totalsData = await totalsRes.json();
  const row = (totalsData.results as any[])?.[0];
  return row ? totalsFromRow(cycle, row) : null;
}

export async function getTotals(candidateId: string, cycle: number): Promise<FecTotals | null> {
  const url = `${FEC_BASE}/candidate/${candidateId}/totals/?cycle=${cycle}&api_key=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const row = (data.results as any[])?.[0];
  if (row) return totalsFromRow(cycle, row);
  return getTotalsViaCommittee(candidateId, cycle).catch(() => null);
}
