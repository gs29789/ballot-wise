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

// Arkansas is scoped to state office by its own text ("General Assembly...
// any office of trust or profit in this state"), same shape as Michigan/
// Illinois.
const ARKANSAS_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Arkansas's constitutional felony bar applies only to the General Assembly and \"any office of trust or profit in this state\" by its own text, not federal office; separately, the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates either way",
  source_url: "https://codes.findlaw.com/ar/arkansas-constitution-of-1874/ar-const-art-5-sect-9.html",
  snippet:
    "Ark. Const. art. 5, § 9: \"No person convicted of embezzlement of public money, bribery, forgery, or other infamous crime is eligible to the General Assembly or capable of holding any office of trust or profit in this state.\" Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// Connecticut is a genuinely different shape from every prior state: its
// statute bars a person from being "a candidate for or hold[ing] public
// office" without any explicit state/local carve-out in the text itself —
// broader on its face than Michigan/Illinois/Arkansas/New Jersey's clean
// self-limiting language. The "No" conclusion here rests entirely on
// federal preemption (states cannot add qualifications for Congress), not
// on the statute's own scope, so the value below preserves that genuine
// legal uncertainty rather than overstating confidence the research didn't
// find.
const CONNECTICUT_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "Unclear on its face, but No in practice — Connecticut bars a person who has forfeited (and not regained) their electoral privileges due to a felony conviction from being \"a candidate for or hold[ing] public office,\" with no explicit carve-out limiting this to state or local office; but the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this provision would not be enforceable to keep a candidate off a Connecticut congressional ballot even though its text alone doesn't rule out reaching federal office",
  source_url: "https://www.cga.ct.gov/current/pub/chap_143.htm",
  snippet:
    "Conn. Gen. Stat. § 9-46(c): \"No person who has forfeited and not regained such person's privileges as an elector as provided in section 9-46a, or who has regained such privileges and again forfeited such privileges as provided in subsection (b) of this section, may be a candidate for or hold public office.\" Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// Indiana is the cleanest case yet — an EXPLICIT statutory carve-out
// naming federal candidates directly, no inference needed at all (matches
// Iowa's shape below).
const INDIANA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Indiana's felony-disqualification statute explicitly states it \"does not apply to a candidate for federal office,\" applying only to candidates for state and local elected office who have been convicted of (or pleaded guilty/no contest to) a felony",
  source_url: "https://codes.findlaw.com/in/title-3-elections/in-code-sect-3-8-1-5/",
  snippet:
    "Ind. Code § 3-8-1-5(a): \"This section does not apply to a candidate for federal office.\" (d) A person is disqualified from assuming or being a candidate for an elected office if, in a jury trial, a jury publicly announces a verdict against the person for a felony; in a bench trial, the court publicly announces a verdict against the person for a felony; or at a guilty plea hearing, the person pleads guilty or nolo contendere to a felony.",
};

// Iowa: also an explicit statutory carve-out naming Congress directly.
const IOWA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Iowa's constitution strips convicted felons of the \"privilege of an elector,\" and state law requires elected officials to be eligible electors, but Iowa Code § 39.27 explicitly states this qualifications-for-office rule \"shall not apply to United States senators or representatives in Congress\"",
  source_url: "https://law.justia.com/constitution/iowa/article-ii/section-5/",
  snippet:
    "Iowa Const. art. II, § 5: \"A person adjudged mentally incompetent to vote or a person convicted of any infamous crime shall not be entitled to the privilege of an elector.\" Iowa Code § 39.27: \"Any person elected to an office under the laws of this state shall be an eligible elector. ... This section shall not apply to United States senators or representatives in Congress or to members of the general assembly.\"",
};

// Minnesota ties office-eligibility to voting-eligibility without an
// explicit federal carve-out in the text — relies on federal preemption,
// same shape as Montana/Georgia/Kentucky/Colorado.
const MINNESOTA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Minnesota bars a person \"convicted of treason or felony, unless restored to civil rights\" from voting, and separately requires voting-eligibility to hold any office \"elective by the people in the district,\" but the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates",
  source_url: "https://www.revisor.mn.gov/constitution/",
  snippet:
    "Minn. Const. art. VII, § 1: \"...a person who has been convicted of treason or felony, unless restored to civil rights...\" [shall not be entitled or permitted to vote]. Minn. Const. art. VII, § 6: \"Every person who by the provisions of this article is entitled to vote at any election and is 21 years of age is eligible for any office elective by the people in the district wherein he has resided 30 days previous to the election, except as otherwise provided in this constitution, or the constitution and law of the United States.\" Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// New Jersey is narrower than every other state on TWO axes at once: it
// only disqualifies for a felony that involved or touched the specific
// office already held (not any felony), and it's scoped to state/local
// office by its own text ("under this State or any of its administrative or
// political subdivisions") — no blanket felon-disqualification rule exists
// in NJ law at all.
const NEW_JERSEY_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — New Jersey has no blanket felony-disqualification rule for elective office; its only relevant statute permanently bars someone from future office only if they were convicted of an offense that involved or touched the specific state or local office they already held, and by its own text that bar reaches only offices \"under this State or any of its administrative or political subdivisions,\" not federal office",
  source_url: "https://law.justia.com/codes/new-jersey/title-2c/section-2c-51-2/",
  snippet:
    "N.J.S.A. 2C:51-2(d): \"In addition to the punishment prescribed for the offense, and the forfeiture set forth in subsection a. of N.J.S.2C:51-2, any person convicted of an offense involving or touching on his public office, position or employment shall be forever disqualified from holding any office or position of honor, trust or profit under this State or any of its administrative or political subdivisions.\"",
};

// Hawaii's felon bar (HRS § 831-2) reads broadly at first ("may not...
// become a candidate for or hold public office") but the statute defines
// "public office" itself, narrowly, as gubernatorial/chief-justice/OHA/
// judicial-selection-commission appointees and senate-confirmed positions —
// verified directly against the statute text, not just the research
// summary, since that specific definitional claim wasn't otherwise
// quote-anchored. Congress fits none of those categories.
const HAWAII_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Hawaii's felon-disqualification statute (HRS § 831-2) bars becoming a candidate for or holding \"public office\" until final discharge, but the statute's own definition of \"public office\" is limited to gubernatorial/chief-justice/OHA/judicial-selection-commission appointees and senate-confirmed positions — not Congress; separately, the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates either way",
  source_url: "https://law.justia.com/codes/hawaii/title-38/chapter-831/section-831-2/",
  snippet:
    "§831-2 Rights lost. (a) A person sentenced for a felony, from the time of the person's sentence until the person's final discharge, may not: ... (2) Become a candidate for or hold public office. ... \"Public office\" means an office held by an elected official, department heads, officers, and members of any board, commission, or other state agency whose appointments are made by the governor, chief justice, office of Hawaiian affairs, or the judicial selection commission, or are required by law to be confirmed by the senate. Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// Idaho's felon bar (Art. VI, § 3) is broad and unqualified — "any civil
// office" — with no explicit state/local-only carve-out (unlike Michigan/
// Illinois/Arkansas) and no explicit federal-reaching language either
// (unlike Indiana/Iowa). Rests on federal preemption alone, same shape as
// Montana/Georgia/Kentucky/Colorado/Minnesota.
const IDAHO_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Idaho's constitution bars a convicted felon who hasn't been restored to the rights of citizenship from voting, serving on a jury, or holding \"any civil office,\" with no explicit carve-out limiting this to state or local office; but the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates",
  source_url: "https://web.archive.org/web/20251219164936/https://legislature.idaho.gov/statutesrules/idconst/ArtVI/Sect3/",
  snippet:
    "No person is permitted to vote, serve as a juror, or hold any civil office who has, at any place, been convicted of a felony, and who has not been restored to the rights of citizenship, or who, at the time of such election, is confined in prison on conviction of a criminal offense. Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// Kansas is scoped to state office by its own text ("public office under
// the laws of the state of Kansas") — same shape as Michigan/Illinois/
// Arkansas/New Jersey.
const KANSAS_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Kansas's felon-disqualification statute applies only to \"any public office under the laws of the state of Kansas\" by its own text, not federal office; separately, the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates either way",
  source_url: "https://ksrevisor.gov/statutes/chapters/ch21/021_066_0013.html",
  snippet:
    "A person who has been convicted in any state or federal court of a felony shall, by reason of such conviction, be ineligible to hold any public office under the laws of the state of Kansas, or to register as a voter or to vote in any election held under the laws of the state of Kansas or to serve as a juror in any civil or criminal case.",
};

// Nebraska's bar is scoped to state office by its own text ("any office of
// trust or profit under the constitution or laws of THIS STATE") — same
// shape as Michigan/Illinois/Arkansas/New Jersey/Kansas.
const NEBRASKA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Nebraska's constitution bars a convicted felon who hasn't been restored to civil rights from \"any office of trust or profit under the constitution or laws of this state\" by its own text, not federal office; separately, the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates either way",
  source_url: "https://law.justia.com/constitution/nebraska/c0115002000.html",
  snippet:
    "No person who is in default as collector and custodian of public money or property shall be eligible to any office of trust or profit under the constitution or laws of this state. No person convicted of a felony shall be eligible to any such office unless he shall have been restored to civil rights.",
};

// Nevada ties office-eligibility to "qualified elector" status, and
// separately strips elector status for a felony conviction (until restored)
// — neither clause names Congress, so this rests on federal preemption
// alone, same shape as Montana/Georgia/Kentucky/Colorado/Minnesota/Idaho.
const NEVADA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Nevada's constitution makes office eligibility contingent on being a \"qualified elector,\" and separately strips a person convicted of treason or felony of elector status until civil rights are restored, but neither clause names Congress; and the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates",
  source_url: "https://law.justia.com/constitution/nevada/",
  snippet:
    "Nev. Const. art. 15, § 3(1): \"No person shall be eligible to any office who is not a qualified elector under this Constitution.\" Nev. Const. art. 2, § 1: \"...provided, that no person who has been or may be convicted of treason or felony in any state or territory of the United States, unless restored to civil rights, and no person who has been adjudicated mentally incompetent, unless restored to legal capacity, shall be entitled to the privilege of an elector.\" Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// Oklahoma is scoped to state/local office by its own text ("any state,
// county, municipal, judicial or school office or any other elective office
// of any political subdivision of this state") — same shape as Michigan/
// Illinois/Arkansas/New Jersey/Kansas/Nebraska.
const OKLAHOMA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Oklahoma's felon-disqualification statute (26 O.S. § 5-105a) bars a person convicted of a felony (or embezzlement-related misdemeanor) from being a candidate for \"any state, county, municipal, judicial or school office or any other elective office of any political subdivision of this state\" for 15 years after completing their sentence, absent a pardon — by its own text this reaches only state and local offices, not Congress",
  source_url: "https://law.justia.com/codes/oklahoma/title-26/section-26-5-105a/",
  snippet:
    "A person who has been convicted of a misdemeanor involving embezzlement or a felony under the laws of this state or of the United States or who has entered a plea of guilty or nolo contendere to such misdemeanor involving embezzlement or felony ... shall not be eligible to be a candidate for or to be elected to any state, county, municipal, judicial or school office or any other elective office of any political subdivision of this state for a period of fifteen (15) years following completion of his sentence or during the pendency of an appeal of such conviction or plea.",
};

// office: "H" | "S" — both federal. State/county races aren't in scope yet;
// extend this map if that changes.
const MARYLAND_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "Maryland's only felony-related officeholder provision, Md. Const. Art. XV, Section 2, does NOT disqualify felons from running for Congress. By its own text it applies only to 'elected official[s] of the State, or of a county or of a municipal corporation' -- it never mentions federal office. Even for the state/county/municipal officials it does cover, it isn't a candidacy bar at all: it only triggers suspension (and, on final conviction, removal) of someone ALREADY HOLDING elective office who is convicted of a felony (or a moral-turpitude misdemeanor tied to their duties) DURING their term. It says nothing about screening candidates before an election. No separate Election Law Article provision disqualifying felon candidates was located. Even if Maryland had such a candidacy bar for Congress specifically, U.S. Term Limits v. Thornton (1995) holds that states cannot add qualifications for Congress beyond the U.S. Constitution's own (age/citizenship/residency), so it would be unenforceable against a congressional candidate. Net: Maryland does not disqualify felons from congressional candidacy, both on the statute's own limited scope and via federal preemption.",
  source_url: "https://msa.maryland.gov/msa/mdmanual/43const/html/15art15.html",
  snippet:
    "Any elected official of the State, or of a county or of a municipal corporation who during the elected official's term of office is found guilty of any crime which is a felony... shall be suspended by operation of law without pay or benefits from the elective office... If the finding of guilt becomes a final conviction, after judicial review or otherwise, such elected official shall be removed from the elective office by operation of Law and the office shall be deemed vacant.",
};

const MISSISSIPPI_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "Mississippi's felon-disqualification provision (Miss. Const. Art. 4, § 44) bars a person convicted of bribery, perjury, or 'other infamous crime' from being 'eligible to a seat in either House of the Legislature, or to any office of profit or trust' unless pardoned; a separate clause in the same subsection bars anyone convicted of bribery-related election offenses from holding 'any office of profit or trust under the laws of this state,' and §44(2) separately bars a person convicted of a qualifying felony in another state or in federal court from holding 'any office of profit or trust in this state.' The core disqualifying clause in §44(1) ('any office of profit or trust') is NOT itself worded as limited to state office the way the bribery clause and §44(2) explicitly are ('under the laws of this state' / 'in this state') — so the statute's own text leaves genuine ambiguity about whether it purports to reach a congressional seat at all. Mississippi Code §99-19-35 uses similarly unqualified language ('any office of profit, trust, or honor'), reinforcing the ambiguity rather than resolving it. Regardless of how §44 is read, however, no state felony-disqualification statute can actually keep someone off a congressional ballot or out of a congressional seat, because states cannot add qualifications for Congress beyond the U.S. Constitution's own age/citizenship/residency requirements — U.S. Term Limits, Inc. v. Thornton, 514 U.S. 779 (1995). So the practical outcome (no state bar reaches Congress) is settled by federal preemption even though the state text's own scope is ambiguous.",
  source_url: "https://www.sos.ms.gov/content/documents/ed_pubs/pubs/Mississippi_Constitution.pdf",
  snippet:
    "SECTION 44. Ineligibility for office of person convicted of certain crimes. (1) No person shall be eligible to a seat in either House of the Legislature, or to any office of profit or trust, who shall have been convicted of bribery, perjury, or other infamous crime; and any person who shall have been convicted of giving or offering, directly, or indirectly, any bribe to procure his election or appointment, and any person who shall give or offer any bribe to procure the election or appointment of any person to office, shall, on conviction thereof, be disqualified from holding any office of profit or trust under the laws of this state. (2) No person who is convicted after ratification of this amendment in another state of any offense which is a felony under the laws of this state, and no person who is convicted after ratification of this amendment of any felony in a federal court, shall be eligible to hold any office of profit or trust in this state.",
};

const NEW_MEXICO_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "Ambiguous — New Mexico has two felony-disqualification provisions with inconsistent scope. NMSA 1978 §10-1-2 broadly bars anyone convicted of a 'felonious or infamous crime' (absent a pardon or restoration of political rights) from being 'elected or appointed to any public office in this state,' language broad enough on its face to arguably reach federal offices held by NM residents. But the companion restoration statute, NMSA 1978 §31-13-1 ('Felony conviction; restoration of right to hold office of public trust'), frames the same bar narrowly as applying only to 'an office of public trust for the state, a county, a municipality or a district' — omitting federal office. Even under the broadest reading of §10-1-2, any state-imposed qualification for Congress beyond the U.S. Constitution's own textual qualifications would likely be preempted under U.S. Term Limits v. Thornton (1995). No New Mexico court decision was found squarely resolving whether §10-1-2 reaches congressional candidacy specifically, so genuine ambiguity remains.",
  source_url: "https://codes.findlaw.com/nm/chapter-10-public-officers-and-employees/nm-st-sect-10-1-2/",
  snippet:
    "no person convicted of a felonious or infamous crime, unless such person has been pardoned or restored to political rights, shall be qualified to be elected or appointed to any public office in this state",
};

const OREGON_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "Oregon does not disqualify convicted felons from running for U.S. House or Senate. Oregon Constitution Art. IV, Section 8 bars a felon whose sentence is not complete from serving as a state legislative Senator or Representative, but that provision is textually confined to the Oregon Legislative Assembly (state Senator/Representative) — it does not mention Congress and does not appear in the article of the constitution governing elections generally. No separate Oregon statute or the state's official Candidate Manual imposes a felony bar on federal (U.S. House/Senate) candidates. Any state attempt to add such a qualification for Congress would in any event be preempted under U.S. Term Limits, Inc. v. Thornton (1995), which holds states cannot add qualifications for Congress beyond the U.S. Constitution's own age/citizenship/residency requirements.",
  source_url: "https://codes.findlaw.com/or/oregon-constitution/or-const-art-iv-sect-8/",
  snippet:
    "Or. Const. Art. IV, § 8(4): \"A person is not eligible to be elected as a Senator or Representative if that person has been convicted of a felony and has not completed the sentence received for the conviction prior to the date that person would take office if elected.\" [Located within Article IV, the Legislative Department article governing the Oregon Legislative Assembly — not Congress.]",
};

const SOUTH_CAROLINA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "South Carolina's own constitutional felony-disqualification clause (Article VI, Section 1) is textually limited to \"any office in this State or its political subdivisions\" — it does not by its own terms purport to reach federal offices like U.S. House or Senate. Candidate qualifications for Congress are set exclusively by the U.S. Constitution (age, citizenship, residency), and under U.S. Term Limits v. Thornton (1995) states cannot add additional qualifications for federal office. So while South Carolina bars felons (absent a pardon or a 15-year post-sentence waiting period) from state and local office, that bar does not reach a U.S. House or Senate candidacy — this is a state-law-text limitation, not an assertion that felons are barred from Congress by any authority.",
  source_url: "https://www.scstatehouse.gov/scconstitution/SCConstitution.pdf",
  snippet:
    "No person may be popularly elected to and serve in any office in this State or its political subdivisions unless he possesses the qualifications of an elector, is not disqualified by age as prescribed in this Constitution, and has not been convicted of a felony under state or federal law or convicted of tampering with a voting machine, fraudulent registration or voting, bribery at elections... (Art. VI, Sec. 1)",
};

const VIRGINIA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "Virginia's own candidacy-qualification statute (Va. Code §24.2-500) ties eligibility to run for office to eligibility to vote, and a felony conviction strips voter/candidacy qualification until civil rights are restored by the Governor — but the statute's own text limits that rule to 'any office of the Commonwealth, or of its governmental units,' i.e., Virginia state and local offices. It does not by its own text reach candidacy for the U.S. House or Senate, which are federal offices created by the U.S. Constitution, not Commonwealth offices. Under U.S. Term Limits v. Thornton, states cannot add qualifications for Congress beyond the Constitution's own age/citizenship/residency requirements anyway, so even if Virginia intended the statute to reach Congress, it could not enforce that as a matter of federal constitutional law. Net effect: a convicted felon's eligibility to run for Virginia's congressional seats is governed by the U.S. Constitution alone, not by this state statute — genuine legal certainty here, not ambiguity, but worth stating precisely because the statute's plain text could be misread as broader than it is.",
  source_url: "https://law.lis.virginia.gov/vacode/title24.2/chapter5/section24.2-500/",
  snippet:
    "In order to qualify as a candidate for any office of the Commonwealth, or of its governmental units, a person must be qualified to vote for and hold that office.",
};

const WEST_VIRGINIA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "West Virginia's felon-disqualification-from-office provision (W. Va. Const. art. IV, §4-4, read together with the felony-voting disqualification in §4-1) is explicitly limited on its own text to 'any state, county or municipal office' — it does not by its own terms reach federal congressional candidacy. Because the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) are exclusive and states cannot add qualifications for Congress beyond them (U.S. Term Limits, Inc. v. Thornton, 1995), a felony conviction alone does not appear to bar a WV candidate from running for U.S. House or Senate. This reading is corroborated by a state official's public statement: WV Secretary of State's deputy general counsel told a reporter that a felony January 6-related conviction did not disqualify a 2026 WV congressional candidate (Derrick Evans) from running, because it was not a treason/insurrection conviction and WV's felon disqualification is a voting/state-office matter, not a bar on federal candidacy. Some genuine ambiguity remains because no WV court appears to have tested this specific provision against a congressional candidacy.",
  source_url: "https://law.justia.com/constitution/west-virginia/",
  snippet:
    "W. Va. Const. Art. IV, § 4-4: \"No person, except citizens entitled to vote, shall be elected or appointed to any state, county or municipal office...\" § 4-1: \"...no person who is a minor, or who has been declared mentally incompetent by a court of competent jurisdiction, or who is under conviction of treason, felony or bribery in an election... shall be permitted to vote...\"",
};

const WISCONSIN_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "Genuinely ambiguous for congressional candidates. Wisconsin's constitution (Art. XIII, §3) has two relevant clauses. The office-eligibility clause is broad and unqualified: no person convicted of a felony 'in any court within the United States' (or of certain misdemeanors involving public trust) 'shall be eligible to any office of trust, profit or honor in this state unless pardoned' — that phrase doesn't on its face exclude federal offices like the U.S. House. But the clause's own enforcement mechanism — the ballot-access provision in the same section, which bars placing a convicted person's name on a ballot — explicitly limits itself to 'any ballot for a state or local elective office,' omitting federal races. Combined with U.S. Term Limits v. Thornton, 514 U.S. 779 (1995), which holds states cannot add qualifications for Congress beyond the U.S. Constitution's own (age/citizenship/residency), the ballot-access text and federal preemption both point toward Wisconsin's felon bar NOT reaching U.S. House/Senate candidacy — but no Wisconsin court decision confirming that specific reading was found, so this should be treated as unresolved rather than settled either way.",
  source_url: "https://law.justia.com/constitution/wisconsin/article-xiii/section-3/",
  snippet:
    "Wis. Const. Art. XIII, § 3: \"No person convicted of a felony, in any court within the United States... shall be eligible to any office of trust, profit or honor in this state unless pardoned of the conviction. No person may seek to have placed on any ballot for a state or local elective office in this state the name of a person convicted of a felony... unless the person named for the ballot has been pardoned of the conviction.\"",
};

const NORTH_CAROLINA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value: "Yes, North Carolina has a state felony-disclosure statute (N.C. Gen. Stat. § 163-106(e)) that applies to candidates for federal office, but it is a DISCLOSURE requirement, not a disqualification — a felony conviction does not bar someone from the federal ballot, and the form must affirmatively state that. This is deliberate: the U.S. Constitution's own qualifications for Congress (age/citizenship/residency in Art. I) are exclusive, so a state cannot add substantive disqualifications for federal candidates (U.S. Term Limits v. Thornton). The 4th Circuit upheld this specific NC statute as constitutional precisely because it stops at disclosure and does not keep anyone off the ballot. It applies to every 2026 NC congressional candidate at the point they file their notice of candidacy.",
  source_url: "https://law.justia.com/codes/north-carolina/2023/chapter-163/article-10/section-163-106/",
  snippet: "the candidate shall file with the same office a statement answering the following question: \"Have you ever been convicted of a felony?\" ... The form shall be available as a public record in the office of the board of elections where the candidate files notice of candidacy and shall contain an explanation that a prior felony conviction does not preclude holding elective office if the candidate's rights of citizenship have been restored.",
};

const MISSOURI_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value: "Missouri does have an active state felony-disqualification law for candidates, RSMo §115.306.1: no person who has been found guilty of or pled guilty to a felony (federal, Missouri, or an out-of-state offense that would be a felony in Missouri) may qualify as a candidate for 'elective public office' in Missouri. RSMo §115.013 defines 'public office' broadly enough to textually reach federal officeholders ('any employment under the United States, the state of Missouri, or any political subdivision or special district thereof'), and Missouri courts do actively enforce §115.306 — e.g., Fletcher v. Young, 689 S.W.3d 161 (Mo. banc 2024), held a felony guilty plea disqualifies a candidate even after a gubernatorial pardon. However, as applied to a candidate for the U.S. House or Senate specifically, this state law almost certainly cannot be constitutionally enforced. Under U.S. Term Limits, Inc. v. Thornton, 514 U.S. 779 (1995), the Constitution's Qualifications Clauses (Art. I, §2, cl. 2 for the House; Art. I, §3, cl. 3 for the Senate — age, citizenship, inhabitancy) are the exclusive qualifications for congressional service, and a state cannot add to them, directly or indirectly (including through ballot-access denial). No Missouri-specific court decision was found applying §115.306 to a federal congressional candidate (Fletcher v. Young concerns a non-federal office), so this conclusion rests on the general federal constitutional doctrine of Thornton rather than a Missouri-specific ruling — flagged for legal review if certainty is required.",
  source_url: "https://law.justia.com/codes/missouri/title-ix/chapter-115/section-115-306/",
  snippet: "115.306. Disqualification as candidate for elective public office, when — filing of affidavit, contents — tax delinquency, effect of. — 1. No person shall qualify as a candidate for elective public office in the state of Missouri who has been found guilty of or pled guilty to a felony under the federal laws of the United States of America or to a felony under the laws of this state or an offense committed in another state that would be considered a felony in this state.",
};

const OHIO_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value: "Ohio Revised Code 2961.01(A)(1) strips anyone convicted of a felony of the 'privilege of holding office' in the state: it makes a felon 'incompetent ... to hold an office of honor, trust, or profit.' This Ohio law does NOT reach candidates for the U.S. House or Senate, however. The Constitution's own Qualifications Clauses (Art. I, §2, cl. 2 for the House; §3, cl. 3 for the Senate) are the exclusive qualifications for Congress, and the U.S. Supreme Court held in U.S. Term Limits, Inc. v. Thornton, 514 U.S. 779 (1995), that 'States cannot impose qualification requirements on membership in Congress' (Cornell LII, Constitution Annotated, ArtI.S3.C3.4, https://www.law.cornell.edu/constitution-conan/article-1/section-3/clause-3/states-ability-to-change-qualifications-requirements-for-senate) — changing congressional qualifications requires a constitutional amendment. The ACLU of Ohio states this plainly for the state: 'a person convicted of a felony may run for either the U.S. House or Senate so long as he or she satisfies the other requirements' because 'Congress cannot impose further restrictions on candidates without amending the U.S. Constitution' (https://www.acluohio.org/news/felon-candidacy/). Net effect: a felony conviction bars someone from Ohio state office but does NOT bar them from running for or serving in Ohio's U.S. House or Senate seats.",
  source_url: "https://law.justia.com/codes/ohio/title-29/chapter-2961/section-2961-01/",
  snippet: "(A)(1) A person who pleads guilty to a felony under the laws of this or any other state or the United States and whose plea is accepted by the court or a person against whom a verdict or finding of guilt for committing a felony under any law of that type is returned, unless the plea, verdict, or finding is reversed or annulled, is incompetent to be an elector or juror or to hold an office of honor, trust, or profit.",
};

const FLORIDA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value: "Florida has a facially broad state constitutional disqualification, but it cannot reach a candidate for the U.S. House or Senate. Fla. Const. Art. VI, §4(a) bars anyone 'convicted of a felony' from being 'qualified to vote or hold office until restoration of civil rights or removal of disability' — text not expressly limited to state office. However, under the Qualifications Clauses (U.S. Const. Art. I, §2, cl.2 for the House; §3, cl.3 for the Senate) as construed in U.S. Term Limits, Inc. v. Thornton, 514 U.S. 779 (1995), states may not add qualifications for Congress beyond the Constitution's own age/citizenship/residency requirements, and each chamber alone judges its members' qualifications (Art. I, §5). Confirming this in practice: Florida's own 2024 Federal Qualifying Handbook (FL Division of Elections) lists only the three federal constitutional qualifications for U.S. House and Senate candidates (citizenship years, age, state inhabitancy) — no felony or background-check requirement appears anywhere in the federal candidate-qualifying chapters — and Fla. Stat. §99.012 ('Restrictions on individuals qualifying for public office') likewise contains no criminal-history provision and expressly exempts 'persons holding any federal office' from its concurrent-term resign-to-run rule. No FL statute or rule requires a background check as part of federal candidate qualifying.",
  source_url: "https://fl.elaws.us/constitution/articlevi_section4",
  snippet: "No person convicted of a felony, or adjudicated in this or any other state to be mentally incompetent, shall be qualified to vote or hold office until restoration of civil rights or removal of disability.",
};

// Alabama is shaped like Illinois: the felony bar applies only to "office
// under the authority of this state" by its own text, not federal office.
const ALABAMA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Alabama's felony-disqualification statute (Ala. Code § 36-2-1(a)(3)) applies only to \"office under the authority of this state\" by its own text, not federal office; no separate background-check-disclosure requirement was found in Alabama's candidate qualifying process either; and the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state regardless",
  source_url: "https://web.archive.org/web/2025/https://law.justia.com/codes/alabama/title-36/chapter-2/section-36-2-1/",
  snippet:
    "Section 36-2-1 - Persons Not Eligible to Hold State Office... (a) The following persons shall be ineligible to and disqualified from holding office under the authority of this state: ... (3) Those who shall have been convicted of treason, embezzlement of public funds, malfeasance in office, larceny, bribery or any other crime punishable by imprisonment in the state or federal penitentiary and those who are idiots or insane. Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// Tennessee is shaped like Illinois/Alabama: the eligibility bar applies
// only to "office under the authority of this state" by its own text.
const TENNESSEE_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Tennessee's eligibility statute (Tenn. Code Ann. § 8-18-101) applies only to persons \"qualified to hold office under the authority of this state\" by its own text, not federal office; separately, the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates either way",
  source_url: "https://codes.findlaw.com/tn/title-8-public-officers-and-employees/tn-code-sect-8-18-101/",
  snippet:
    "Tenn. Code Ann. § 8-18-101: \"All persons eighteen (18) years of age or older who are citizens of the United States and of this state... are qualified to hold office under the authority of this state except: (1) Those who have been convicted of offering or giving a bribe, or any other offense declared infamous under § 40-20-112...\" Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// Texas is shaped the same way: its felony-disqualification requirement
// applies only to "a public elective office in this state" by its own text.
const TEXAS_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Texas's felony-disqualification requirement (Tex. Elec. Code § 141.001(a)(4)) applies only to \"a public elective office in this state\" by its own text, not federal office; separately, the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state, so this doesn't reach U.S. House or Senate candidates either way",
  source_url: "https://codes.findlaw.com/tx/election-code/elec-sect-141-001/",
  snippet:
    "Tex. Elec. Code § 141.001: \"(a) To be eligible to be a candidate for, or elected or appointed to, a public elective office in this state, a person must: ... (4) have not been finally convicted of a felony from which the person has not been pardoned or otherwise released from the resulting disabilities...\" Congressional qualifications are set exclusively by the U.S. Constitution, confirmed per " +
    CRS_QUALIFICATIONS_REPORT_URL +
    ': "the Framers intended the Constitution to be the exclusive source of qualifications for Members of Congress, and that the Framers thereby \'divested\' States of any power to add qualifications."',
};

// Louisiana is the cleanest case yet: rather than inferring self-limiting
// scope from a statute's own text, the state's own official candidate
// qualifying form spells out the federal-office exemption explicitly, in
// the sworn certification every candidate signs.
const LOUISIANA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Louisiana's official candidate qualifying form explicitly exempts \"United States senator or representative in congress\" from its felony-disqualification certification requirement; separately, the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state regardless",
  source_url: "https://www.sos.la.gov/media/wkijy1fx/qualifying-form.pdf",
  snippet:
    "Notice of Candidacy (Form QF-42, Rev. 6/22), item 7: \"If I am a candidate for any office other than United States senator or representative in congress, that I am not currently under an order of imprisonment for conviction of a felony and I am not prohibited from qualifying as a candidate for the conviction of a felony pursuant to Article I, Section 10.1 of the Constitution of Louisiana.\"",
};

// Maine repealed its only office-disqualification statute (17-A M.R.S.
// §1152(4)) outright in 2019 — there's no current state-law bar to analyze
// for scope at all, for any office.
const MAINE_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Maine repealed its only statutory provision allowing a felony conviction to disqualify someone from office (17-A M.R.S. § 1152(4)) in 2019; no replacement exists for any office, state or federal, and separately the U.S. Constitution's own qualifications for Congress (age, citizenship, residency) can't be added to by any state regardless",
  source_url: "https://www.mainelegislature.org/legis/statutes/17-a/title17-Asec1152.html",
  snippet:
    "17-A M.R.S. § 1152. Authorized sentences (REPEALED). SECTION HISTORY: ...PL 2019, c. 113, Pt. A, §1 (RP).",
};

// Alaska has no dedicated candidate background-check statute. Its
// declaration-of-candidacy filing (which federal candidates use too, per
// AS 15.25.010) carries no felony clause; its one felony-related election
// statute (AS 15.05.030) is a temporary VOTING-rights provision by its own
// text, not a candidacy bar. Confirmed in practice: a convicted, then-
// incarcerated felon ran for and remained on Alaska's 2024 U.S. House
// general-election ballot, upheld 4-1 by the Alaska Supreme Court, with
// neither the state nor either party ever raising a felony-conviction
// theory against him.
const ALASKA_FEDERAL: StateBackgroundCheckFact = {
  required: false,
  value:
    "No — Alaska has no dedicated candidate background-check statute; its declaration-of-candidacy filing (used for federal candidates too) carries no felony clause, and its one felony-related election statute (AS 15.05.030) only suspends voting rights temporarily, not candidacy or office-holding; separately, the U.S. Constitution's own qualifications for Congress can't be added to by any state regardless",
  source_url: "https://codes.findlaw.com/ak/title-15-elections/ak-st-sect-15-05-030/",
  snippet:
    "AS 15.05.030: \"A person convicted of a crime that constitutes a felony involving moral turpitude under state or federal law may not vote in a state, federal, or municipal election from the date of the conviction through the date of the unconditional discharge of the person. Upon the unconditional discharge, the person may register.\"",
};

export function getStateBackgroundCheckFact(stateCode: string, office: "H" | "S"): StateBackgroundCheckFact | null {
  if (stateCode === "AL" && (office === "H" || office === "S")) return ALABAMA_FEDERAL;
  if (stateCode === "LA" && (office === "H" || office === "S")) return LOUISIANA_FEDERAL;
  if (stateCode === "ME" && (office === "H" || office === "S")) return MAINE_FEDERAL;
  if (stateCode === "AK" && (office === "H" || office === "S")) return ALASKA_FEDERAL;
  if (stateCode === "TN" && (office === "H" || office === "S")) return TENNESSEE_FEDERAL;
  if (stateCode === "TX" && (office === "H" || office === "S")) return TEXAS_FEDERAL;
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
  if (stateCode === "AR" && (office === "H" || office === "S")) return ARKANSAS_FEDERAL;
  if (stateCode === "CT" && (office === "H" || office === "S")) return CONNECTICUT_FEDERAL;
  if (stateCode === "IN" && (office === "H" || office === "S")) return INDIANA_FEDERAL;
  if (stateCode === "IA" && (office === "H" || office === "S")) return IOWA_FEDERAL;
  if (stateCode === "MN" && (office === "H" || office === "S")) return MINNESOTA_FEDERAL;
  if (stateCode === "NJ" && (office === "H" || office === "S")) return NEW_JERSEY_FEDERAL;
  if (stateCode === "HI" && (office === "H" || office === "S")) return HAWAII_FEDERAL;
  if (stateCode === "ID" && (office === "H" || office === "S")) return IDAHO_FEDERAL;
  if (stateCode === "KS" && (office === "H" || office === "S")) return KANSAS_FEDERAL;
  if (stateCode === "NE" && (office === "H" || office === "S")) return NEBRASKA_FEDERAL;
  if (stateCode === "NV" && (office === "H" || office === "S")) return NEVADA_FEDERAL;
  if (stateCode === "OK" && (office === "H" || office === "S")) return OKLAHOMA_FEDERAL;
if (stateCode === "MD" && (office === "H" || office === "S")) return MARYLAND_FEDERAL;
  if (stateCode === "MS" && (office === "H" || office === "S")) return MISSISSIPPI_FEDERAL;
  if (stateCode === "NM" && (office === "H" || office === "S")) return NEW_MEXICO_FEDERAL;
  if (stateCode === "OR" && (office === "H" || office === "S")) return OREGON_FEDERAL;
  if (stateCode === "SC" && (office === "H" || office === "S")) return SOUTH_CAROLINA_FEDERAL;
  if (stateCode === "VA" && (office === "H" || office === "S")) return VIRGINIA_FEDERAL;
  if (stateCode === "WV" && (office === "H" || office === "S")) return WEST_VIRGINIA_FEDERAL;
  if (stateCode === "WI" && (office === "H" || office === "S")) return WISCONSIN_FEDERAL;
  if (stateCode === "NC" && (office === "H" || office === "S")) return NORTH_CAROLINA_FEDERAL;
  if (stateCode === "MO" && (office === "H" || office === "S")) return MISSOURI_FEDERAL;
  if (stateCode === "OH" && (office === "H" || office === "S")) return OHIO_FEDERAL;
  if (stateCode === "FL" && (office === "H" || office === "S")) return FLORIDA_FEDERAL;
  return null;
}
