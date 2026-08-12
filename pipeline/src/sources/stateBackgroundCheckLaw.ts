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

// Georgia is closer to Montana's shape than South Dakota/New York's: OCGA
// § 45-2-1 says these persons are "ineligible to hold any civil office" —
// broader than just vacating one already held — though the same sentence
// also doubles as a vacancy trigger for a sitting officeholder. Framed
// around the "ineligible to hold" language since that's the broader,
// more accurate claim.
const GEORGIA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Georgia bars a person convicted and sentenced for a felony involving moral turpitude from holding any civil office (unless pardoned and restored to full citizenship rights by the State Board of Pardons and Paroles), but the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates",
  source_url: "https://law.justia.com/codes/georgia/title-45/chapter-2/article-1/section-45-2-1/",
  snippet:
    "The following persons are ineligible to hold any civil office; and the existence of any of the following facts shall be a sufficient reason for vacating any office held by such person... (3) Any person finally convicted and sentenced for any felony involving moral turpitude under the laws of this or any other state when the offense is also a felony in this state, unless restored to all his rights of citizenship by a pardon from the State Board of Pardons and Paroles. Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// Pennsylvania is the same broad "ineligible to hold/capable of holding"
// shape as Montana/Georgia, not the narrower South Dakota/New York
// "vacates an office already held" shape. Unlike Montana/Georgia, no
// restoration-of-rights clause appears in this text, so "value" doesn't
// claim one.
const PENNSYLVANIA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Pennsylvania's constitution bars anyone convicted of embezzlement of public moneys, bribery, perjury, or other infamous crime from the General Assembly or from holding any office of trust or profit in the Commonwealth, but the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates",
  source_url: "https://codes.findlaw.com/pa/constitution-of-the-commonwealth-of-pennsylvania/pa-const-art-2-sect-7/",
  snippet:
    "Pa. Const. art. II, § 7: \"No person hereafter convicted of embezzlement of public moneys, bribery, perjury or other infamous crime, shall be eligible to the General Assembly, or capable of holding any office of trust or profit in this Commonwealth.\" Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// Michigan is a narrower shape than every other state here: its felony bar
// (Mich. Const. art. XI, § 8) explicitly limits itself to "state or local
// elective office" by its own text — U.S. House and Senate are outside its
// scope on the statute's own terms, not just via the federal-preemption
// argument used for the broader state bars (Montana/Georgia/Pennsylvania).
// It's also narrower on every other axis: only felonies involving
// dishonesty/deceit/fraud/breach of public trust (not any felony), only
// within a 20-year lookback, and only when the conviction is tied to the
// person's official capacity while already holding office/employment —
// closer in spirit to Wyoming's enumerated, self-limiting statute than to
// Montana/Georgia's broad "any felony"/"any civil office" bars.
const MICHIGAN_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Michigan's constitutional felony bar applies only to state and local elective office and public employment by its own text (not federal office), and even there only reaches a felony involving dishonesty, deceit, fraud, or breach of public trust committed in the person's official capacity within the preceding 20 years; separately, the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates either way",
  source_url: "https://codes.findlaw.com/mi/michigan-constitution-of-1963/mi-const-art-11-sect-8.html",
  snippet:
    "Mich. Const. art. XI, § 8: \"A person is ineligible for election or appointment to any state or local elective office of this state and ineligible to hold a position in public employment in this state that is policy-making or that has discretionary authority over public assets if, within the immediately preceding 20 years, the person was convicted of a felony involving dishonesty, deceit, fraud, or a breach of the public trust and the conviction was related to the person's official capacity while the person was holding any elective office or position of employment in local, state, or federal government.\" Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// Arizona's felony bar (A.R.S. § 13-904(A)) is a general civil-rights
// suspension (voting, jury service, firearms, and "the right to hold public
// office of trust or profit" all suspended together on conviction) rather
// than an office-eligibility statute aimed specifically at candidates —
// closer in shape to Montana/Georgia's broad bars than to South Dakota/New
// York's narrower "vacates an office already held" framing, but reached via
// a still-broader "suspends civil rights generally" mechanism neither of
// those uses.
const ARIZONA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Arizona suspends a convicted felon's civil rights, including 'the right to hold public office of trust or profit,' as part of a general civil-rights suspension (alongside voting, jury service, and firearm rights) triggered by any felony conviction, but the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates",
  source_url: "https://codes.findlaw.com/az/title-13-criminal-code/az-rev-st-sect-13-904/",
  snippet:
    "A.R.S. § 13-904(A): \"A conviction for a felony suspends the following civil rights of the person sentenced: 1. The right to vote. 2. The right to hold public office of trust or profit. 3. The right to serve as a juror. 4. During any period of imprisonment any other civil rights the suspension of which is reasonably necessary for the security of the institution in which the person sentenced is confined or for the reasonable protection of the public. 5. The right to possess a firearm.\" Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// Kentucky is shaped like Montana/Georgia: a broad "excluded from office"
// bar with no explicit state/local-only carve-out in its own text, relieved
// only by gubernatorial pardon. Reaches the same "doesn't apply to Congress"
// conclusion via federal preemption, same as Montana/Georgia/Pennsylvania.
const KENTUCKY_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Kentucky's constitution excludes convicted felons from office generally (relievable only by a gubernatorial pardon), but the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates",
  source_url: "https://codes.findlaw.com/ky/kentucky-constitution/ky-const-sect-150.html",
  snippet:
    "Ky. Const. § 150: \"All persons shall be excluded from office who have been, or shall hereafter be, convicted of a felony, or of such high misdemeanor as may be prescribed by law, but such disability may be removed by pardon of the Governor.\" Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// Colorado is shaped like North Dakota (temporary bar tied to actual
// confinement/probation, automatically restored after) but with an added
// wrinkle: a narrow list of specific crimes (embezzlement of public funds,
// bribery, perjury, solicitation of bribery, subornation of perjury) carries
// PERMANENT disqualification under the state constitution instead. Neither
// half reaches federal office.
const COLORADO_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Colorado disqualifies convicted felons from state office only during actual confinement or probation (automatically restored after), except a narrow list of crimes (embezzlement of public funds, bribery, perjury, solicitation of bribery, subornation of perjury) that carries permanent disqualification instead; but the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so none of this reaches U.S. House or Senate candidates",
  source_url: "https://codes.findlaw.com/co/title-18-criminal-code/co-rev-st-sect-18-1-3-401/",
  snippet:
    "C.R.S. § 18-1.3-401: \"Every person convicted of a felony... shall be disqualified from holding any office of honor, trust, or profit under the laws of this state... during the actual time of confinement or commitment to imprisonment or release from actual confinement on conditions of probation. Upon his or her discharge after completion of service of his or her sentence or after service under probation, the right to hold any office of honor, trust, or profit shall be restored, except as provided in section 4 of article XII of the state constitution.\" Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// Illinois is the cleanest case yet on its own text: the bar explicitly
// applies only to "an office created by this Constitution" — i.e. Illinois
// state/local offices — so it doesn't reach Congress even before invoking
// federal preemption, same shape as Michigan.
const ILLINOIS_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Illinois's constitutional felony bar applies only to \"an office created by this Constitution\" (Illinois state and local offices) by its own text, not federal office; separately, the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates either way",
  source_url: "https://codes.findlaw.com/il/constitution-of-the-state-of-illinois/il-const-art-13-sect-1/",
  snippet:
    "Ill. Const. art. XIII, § 1: \"A person convicted of a felony, bribery, perjury or other infamous crime shall be ineligible to hold an office created by this Constitution. Eligibility may be restored as provided by law.\" Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
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
  if (stateCode === "GA" && (office === "H" || office === "S")) return GEORGIA_FEDERAL;
  if (stateCode === "PA" && (office === "H" || office === "S")) return PENNSYLVANIA_FEDERAL;
  if (stateCode === "MI" && (office === "H" || office === "S")) return MICHIGAN_FEDERAL;
  if (stateCode === "AZ" && (office === "H" || office === "S")) return ARIZONA_FEDERAL;
  if (stateCode === "KY" && (office === "H" || office === "S")) return KENTUCKY_FEDERAL;
  if (stateCode === "CO" && (office === "H" || office === "S")) return COLORADO_FEDERAL;
  if (stateCode === "IL" && (office === "H" || office === "S")) return ILLINOIS_FEDERAL;
  return null;
}
