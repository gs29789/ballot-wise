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

// Wyoming has no affirmative background-check process for any office.
// Its one candidate eligibility bar tied to a criminal record (W.S. 9-1-104,
// barring certain sex offenders) lists specific state and local offices —
// U.S. House and Senate are not among them, so it doesn't reach federal
// candidates. Framed around what the statute actually lists (an exhaustive
// enumeration a reader can check against "value") rather than an explicit
// federal-exemption clause like Delaware's, since Wyoming's guide doesn't
// state one outright.
const WYOMING_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Wyoming's only candidate eligibility bar tied to a criminal record (barring certain sex offenders from office) lists specific state and local offices only; U.S. House and Senate are not among them",
  source_url: "https://sos.wyo.gov/Elections/Docs/2026/2026_Campaign_Guide.pdf",
  snippet:
    "W.S. 9-1-104: Qualifications for office; ineligibility of candidates convicted of certain sex offenses. …No sex offender shall be eligible to be a candidate for, or be appointed to, any of the following offices: (i) Trustee of a school district; (ii) Community college district board member; (iii) County attorney or district attorney; (iv) County commissioner; (v) Member of the governing body of a city or town; (vi) Mayor of a city or town; (vii) County sheriff; (viii) Any office of an elected statewide official; (ix) Member of the legislature; (x) Member of the board of trustees of the University of Wyoming; (xi) Clerk of district court; (xii) Member of the state board of education; (xiii) County clerk; (xiv) County treasurer; (xv) County coroner; (xvi) City attorney.",
};

// Montana is a different shape than Delaware/Wyoming: its felon-ineligibility
// bar (Mont. Const. art. IV, § 4) is broad and doesn't self-limit to state
// offices the way Wyoming's enumerated statute does, and unlike Delaware, no
// Montana document was found explicitly exempting federal candidates. "value"
// makes two separate claims, so each half is quote-anchored to its own
// source within one combined snippet (same multi-source-snippet pattern as
// primaryResults.ts's independent-candidate entries): the Montana felon bar
// itself, from the state constitution, and — since that bar's text alone
// doesn't say whether it reaches federal office — the reason it doesn't,
// from a Congressional Research Service report on Congressional
// qualifications stating the U.S. Term Limits, Inc. v. Thornton (1995)
// holding that states cannot add qualifications for federal candidates
// beyond the Constitution's own. Caught in review: an earlier draft stated
// this second claim in "value" without any snippet backing it at all — this
// project's own citation rule ("no source, no field") doesn't carve out an
// exception for well-established law.
const CRS_QUALIFICATIONS_REPORT_URL = "https://www.everycrsreport.com/reports/R41946.html";

const MONTANA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Montana's constitution bars convicted felons from holding office generally, but the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates",
  source_url: "https://mca.legmt.gov/bills/mca/title_0000/article_0040/part_0010/section_0040/0000-0040-0010-0040.html",
  snippet:
    "Any qualified elector is eligible to any public office except as otherwise provided in this constitution. The legislature may provide additional qualifications but no person convicted of a felony shall be eligible to hold office until his final discharge from state supervision. Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// office: "H" | "S" — both federal. State/county races aren't in scope yet;
// extend this map if that changes.
export function getStateBackgroundCheckFact(stateCode: string, office: "H" | "S"): StateBackgroundCheckFact | null {
  if (stateCode === "DE" && (office === "H" || office === "S")) return DELAWARE_FEDERAL;
  if (stateCode === "WY" && (office === "H" || office === "S")) return WYOMING_FEDERAL;
  if (stateCode === "MT" && (office === "H" || office === "S")) return MONTANA_FEDERAL;
  return null;
}
