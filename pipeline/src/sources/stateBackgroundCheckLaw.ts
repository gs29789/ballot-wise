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

// Vermont is the cleanest case yet: an official Vermont Legislature research
// memo ("Qualifications of Voters and Elected Officers") comprehensively
// enumerates the constitutional qualifications for every elected office it
// covers (Legislators, Governor/Lieutenant Governor, Treasurer) — every one
// of them is residency-only. No felony or criminal-record disqualification
// appears anywhere in it, unlike Montana's felon bar. Same two-part
// structure as Montana's entry: the Vermont-specific claim (no such bar
// exists) quote-anchored to this memo, plus the same CRS citation for why
// that would be moot for Congress anyway even if it did exist.
const VERMONT_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Vermont has no felony or criminal-record disqualification for any elected office; its constitution's only stated qualifications are residency-based, and the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates either",
  source_url:
    "https://legislature.vermont.gov/Documents/2022/WorkGroups/Senate%20Government%20Operations/Elections/W~Amerin%20Aborjaily~VT%20Constitutional%20Provisions%20-%20Qualifications%20of%20Voters%20and%20Elected%20Officers~2-10-2021.pdf",
  snippet:
    "Vt. Const. Ch. II, § 15: \"No person shall be elected a Representative or a Senator until the person has resided in this State two years, the last year of which shall be in the legislative district for which the person is elected.\" Vt. Const. Ch. II, § 23: \"No person shall be eligible to the office of Governor or Lieutenant-Governor until the person shall have resided in this State four years next preceding the day of election.\" Vt. Const. Ch. II, § 66: \". . . such person shall not be capable of being elected Treasurer, or Representative in Assembly, until after two years' residence . . .\" — no felony or criminal-record qualification appears anywhere in this official enumeration of Vermont's constitutional qualifications for elected office. Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// North Dakota does have a felony bar, but narrower than Montana's: it only
// applies "during the term of actual incarceration" (N.D.C.C. § 12.1-33-01),
// not through parole/probation like Montana's "until final discharge from
// state supervision." Still doesn't reach Congress, for the same federal-
// preemption reason as Montana and Vermont.
const NORTH_DAKOTA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — North Dakota bars a person from becoming a candidate for or holding public office only during the actual term of incarceration for a felony sentence, but the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates",
  source_url: "https://ndlegis.gov/cencode/t12-1c33.pdf",
  snippet:
    "12.1-33-01. Rights lost. 1. A person sentenced for a felony to a term of imprisonment, during the term of actual incarceration under such sentence, may not: a. Vote in an election; or b. Become a candidate for or hold public office. Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// South Dakota is a different shape again: unlike Montana/North Dakota, the
// felony-conviction provisions actually findable here don't bar becoming a
// CANDIDATE at all. Const. art. VII, § 2 disqualifies felons from VOTING
// (restorable by law); SDCL 3-4-1 vacates an office someone already HOLDS
// upon conviction of "any infamous crime" — that's removal from an
// incumbency, not a pre-candidacy bar. No South Dakota provision was found
// barring someone from becoming a candidate for office in the first place,
// so "value" says exactly that rather than overstating it into the same
// "bars candidates" framing used for Montana/North Dakota.
const SOUTH_DAKOTA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — South Dakota disqualifies felons from voting (restorable by law) and can remove a sitting official convicted of certain crimes from an office they already hold, but no provision found bars someone from becoming a candidate for office in the first place; and the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state regardless",
  source_url: "https://sdlegislature.gov/Statutes/Constitution/7",
  snippet:
    "Art. VII, § 2. Voter qualification. Every United States citizen eighteen years of age or older who has met all residency and registration requirements shall be entitled to vote in all elections and upon all questions submitted to the voters of the state unless disqualified by law for mental incompetence or the conviction of a felony. SDCL 3-4-1: An office becomes vacant if one of the following events applies to a member of a governing body or elected officer before the expiration of the term of the office; the person: ... (6) Is convicted of any infamous crime or of any offense involving a violation of the official oath of the office. Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// New York is the same shape as South Dakota: N.Y. Public Officers Law § 30
// vacates an office someone already HOLDS upon felony conviction — it is not
// a bar on becoming a candidate for office in the first place. No New York
// provision was found barring candidacy itself.
const NEW_YORK_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — New York removes a sitting officeholder convicted of a felony (or of a crime violating their oath of office) from an office they already hold, but no provision found bars someone from becoming a candidate for office in the first place; and the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state regardless",
  source_url: "https://www.nysenate.gov/legislation/laws/PBO/30",
  snippet:
    "§ 30. Creation of vacancies. 1. Every office shall be vacant upon the happening of one of the following events before the expiration of the term thereof: ... e. His or her conviction of a felony, conviction of a crime involving a violation of his or her oath of office, or upon entering a guilty plea in federal court to a felony, or upon entering a guilty plea in federal court to a crime involving a violation of his or her oath of office. Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// office: "H" | "S" — both federal. State/county races aren't in scope yet;
// extend this map if that changes.
export function getStateBackgroundCheckFact(stateCode: string, office: "H" | "S"): StateBackgroundCheckFact | null {
  if (stateCode === "DE" && (office === "H" || office === "S")) return DELAWARE_FEDERAL;
  if (stateCode === "WY" && (office === "H" || office === "S")) return WYOMING_FEDERAL;
  if (stateCode === "MT" && (office === "H" || office === "S")) return MONTANA_FEDERAL;
  if (stateCode === "VT" && (office === "H" || office === "S")) return VERMONT_FEDERAL;
  if (stateCode === "ND" && (office === "H" || office === "S")) return NORTH_DAKOTA_FEDERAL;
  if (stateCode === "SD" && (office === "H" || office === "S")) return SOUTH_DAKOTA_FEDERAL;
  if (stateCode === "NY" && (office === "H" || office === "S")) return NEW_YORK_FEDERAL;
  return null;
}
