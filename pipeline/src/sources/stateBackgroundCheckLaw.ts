// Whether state law mandates a criminal background check for candidates for
// this office — a fixed statutory fact, not something to look up per
// candidate. Deliberately shown even though every current race is federal
// (and therefore always "No" in Delaware) — the point is exactly that: there
// is no state-level vetting mechanism for federal candidates, unlike state
// and county candidates, who Delaware does require to get one.

export interface StateBackgroundCheckFact {
  required: boolean;
  value: string;
  source_url: string;
  snippet: string;
}

const DELAWARE_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value: "No — Delaware exempts candidates for federal office",
  source_url: "https://elections.delaware.gov/candidates/pdfs/CandidateBackgroundCheckInfoSheet.pdf",
  snippet: "NOTICE: Delaware law does not require Background Checks for Candidates for Federal Office and City of Wilmington Office",
};

// office: "H" | "S" — both federal. State/county races aren't in scope yet;
// extend this map if that changes.
export function getStateBackgroundCheckFact(stateCode: string, office: "H" | "S"): StateBackgroundCheckFact | null {
  if (stateCode === "DE" && (office === "H" || office === "S")) return DELAWARE_FEDERAL;
  return null;
}
