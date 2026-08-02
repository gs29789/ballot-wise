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
export async function searchCandidates(state: string, office: "H" | "S", cycle: number): Promise<FecCandidate[]> {
  const url = `${FEC_BASE}/candidates/search/?state=${state}&cycle=${cycle}&office=${office}&per_page=100&api_key=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`FEC candidates search failed: ${res.status}`);
  const data = await res.json();
  return (data.results as any[])
    .filter((c) => ["C", "P", "N"].includes(c.candidate_status) && (c.election_years ?? []).includes(cycle))
    .map((c) => ({
      candidateId: c.candidate_id,
      name: c.name,
      party: c.party_full,
      office: c.office,
      incumbentChallenge: c.incumbent_challenge_full,
      candidateStatus: c.candidate_status,
      electionYears: c.election_years,
    }));
}

export async function getTotals(candidateId: string, cycle: number): Promise<FecTotals | null> {
  const url = `${FEC_BASE}/candidate/${candidateId}/totals/?cycle=${cycle}&api_key=${apiKey()}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  const row = (data.results as any[])?.[0];
  if (!row) return null;
  return {
    cycle,
    totalRaised: row.receipts ?? null,
    totalSpent: row.disbursements ?? null,
    cashOnHand: row.cash_on_hand_end_period ?? null,
  };
}
