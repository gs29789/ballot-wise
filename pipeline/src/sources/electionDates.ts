// Election calendar dates — a fixed statutory/administrative fact set by
// the state's election authority, not something that varies per candidate
// or per race within a state. Delaware publishes these directly on its
// Department of Elections homepage (confirmed 2026-08-04); no FEC field
// carries exact calendar dates (FEC only exposes election_years).

// Primary and general dates each get their own citation rather than one
// shared source — Delaware and Wyoming happen to publish both on the same
// page, but Montana codifies them as two separate statutes (13-1-107 for
// the primary, 13-1-104 for the general), so a single shared snippet
// couldn't fully support both dates the way citation integrity requires
// here. Delaware/Wyoming just duplicate their one source into both pairs.
export interface ElectionDates {
  primaryDate: string; // ISO YYYY-MM-DD
  primarySourceUrl: string;
  primarySnippet: string;
  generalDate: string;
  generalSourceUrl: string;
  generalSnippet: string;
}

const DELAWARE_2026: ElectionDates = {
  primaryDate: "2026-09-15",
  primarySourceUrl: "https://elections.delaware.gov/",
  primarySnippet: "Primary Election September 15, 2026 General Election November 3, 2026",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://elections.delaware.gov/",
  generalSnippet: "Primary Election September 15, 2026 General Election November 3, 2026",
};

const WYOMING_2026: ElectionDates = {
  primaryDate: "2026-08-18",
  primarySourceUrl: "https://sos.wyo.gov",
  primarySnippet: "2026 Election Dates » Primary Election: August 18, 2026 | General Election: November 3, 2026",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://sos.wyo.gov",
  generalSnippet: "2026 Election Dates » Primary Election: August 18, 2026 | General Election: November 3, 2026",
};

const MONTANA_2026: ElectionDates = {
  primaryDate: "2026-06-02",
  primarySourceUrl: "https://mca.legmt.gov/bills/mca/title_0130/chapter_0010/part_0010/section_0070/0130-0010-0010-0070.html",
  primarySnippet: "On the first Tuesday after the first Monday in June preceding a general election held in an even-numbered year, a primary election must be held throughout the state.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://mca.legmt.gov/bills/mca/title_0130/chapter_0010/part_0010/section_0040/0130-0010-0010-0040.html",
  generalSnippet: "A general election must be held throughout the state on the first Tuesday after the first Monday in November.",
};

const VERMONT_2026: ElectionDates = {
  primaryDate: "2026-08-11",
  primarySourceUrl: "https://legislature.vermont.gov/statutes/section/17/049/02351",
  primarySnippet: "§ 2351. Primary election A primary election shall be held on the second Tuesday in August in each even-numbered year for the nomination of candidates of major political parties for all offices to be voted for at the succeeding general election, except candidates for President and Vice President of the United States, their electors, and justices of the peace.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://legislature.vermont.gov/statutes/section/17/041/02103",
  generalSnippet: "“General election” means the election held on the first Tuesday after the first Monday in November, in even-numbered years.",
};

const NORTH_DAKOTA_2026: ElectionDates = {
  primaryDate: "2026-06-09",
  primarySourceUrl: "https://ndlegis.gov/cencode/t16-1c11.pdf",
  primarySnippet:
    "16.1-11-01. Primary election - When held - Nomination of candidates - Nomination for special elections. On the second Tuesday in June of every general election year, a primary election must be held for the nomination of candidates for the following offices in the years of their regular election: United States senators, member of the United States house of representatives, members of the legislative assembly, elected state officials, judges of the supreme court and district court, county officers, and county commissioners.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://ndlegis.gov/cencode/t16-1c13.pdf",
  generalSnippet: "16.1-13-01. Date of general election. The general election must be held in all the election districts of this state on the first Tuesday after the first Monday in November of each even-numbered year.",
};

const SOUTH_DAKOTA_2026: ElectionDates = {
  primaryDate: "2026-06-02",
  primarySourceUrl: "https://sdlegislature.gov/Statutes/12-2",
  primarySnippet:
    "12-2-1. Date of primary election. The primary election provided for in chapter 12-6 shall be held at the regular polling place in every voting precinct throughout the state on the first Tuesday after the first Monday in June of every even-numbered year.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://sdlegislature.gov/Statutes/12-1",
  generalSnippet:
    "(7) \"General election,\" the vote required to be taken in each voting precinct of the state on the first Tuesday after the first Monday in November of each even-numbered year;",
};

const NEW_YORK_2026: ElectionDates = {
  primaryDate: "2026-06-23",
  primarySourceUrl: "https://www.nysenate.gov/legislation/laws/ELN/8-100",
  primarySnippet:
    "§ 8-100. Elections; dates of and hours for voting. 1. (a) A primary election shall be held on the fourth Tuesday in June before every general election unless otherwise changed by an act of the legislature.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://www.nysenate.gov/legislation/laws/ELN/8-100",
  generalSnippet: "(c) The general election shall be held annually on the Tuesday next succeeding the first Monday in November.",
};

// Georgia's primary and general dates for a given cycle both derive from
// fixed formulas (24th week before November / first Tuesday after first
// Monday in November) rather than being set fresh each cycle by name — the
// date itself (2026-05-19) is confirmed correct by independent news sources,
// not just computed from the formula here.
const GEORGIA_2026: ElectionDates = {
  primaryDate: "2026-05-19",
  primarySourceUrl: "https://law.justia.com/codes/georgia/title-21/chapter-2/article-4/part-2/section-21-2-150/",
  primarySnippet:
    "Whenever any political party holds a primary to nominate candidates for public offices to be filled in the ensuing November election, such primary shall be held on the Tuesday of the twenty-fourth week prior to the November general election in each even-numbered year or, in the case of municipalities, on the third Tuesday in July in each odd-numbered year.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://law.justia.com/codes/georgia/title-21/chapter-2/article-1/section-21-2-2/",
  generalSnippet:
    "\"November election\" means the general election held on the Tuesday next following the first Monday in November in each even-numbered year.",
};

// Pennsylvania's primary date formula ("third Tuesday of May in all
// even-numbered years") lives in its own uncodified Election Code (25 P.S.),
// separate from the general election date, which is set by the state
// constitution itself rather than 25 P.S. — two different documents, same
// two-citation pattern used for every other state here.
const PENNSYLVANIA_2026: ElectionDates = {
  primaryDate: "2026-05-19",
  primarySourceUrl: "https://codes.findlaw.com/pa/title-25-ps-elections-electoral-districts/pa-st-sect-25-2753/",
  primarySnippet:
    "25 P.S. § 2753(a): There shall be a General primary preceding each general election which shall be held on the third Tuesday of May in all even-numbered years, except in the year of the nomination of a President of the United States, in which year the General primary shall be held on the fourth Tuesday of April.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://codes.findlaw.com/pa/constitution-of-the-commonwealth-of-pennsylvania/pa-const-art-7-sect-2/",
  generalSnippet:
    "Pa. Const. art. VII, § 2 (General Election Day): The general election shall be held biennially on the Tuesday next following the first Monday of November in each even-numbered year, but the General Assembly may by law fix a different day, two-thirds of all the members of each House consenting thereto: Provided, That such election shall always be held in an even-numbered year.",
};

// Michigan's primary date formula (MCL 168.52) is tied specifically to
// gubernatorial-election years — 2026 is one (Whitmer is term-limited) — and
// lives in a different statute than the general date (MCL 168.641, which
// defines all three of Michigan's regular election dates: May/August/
// November). Same two-citation pattern as every other state here.
const MICHIGAN_2026: ElectionDates = {
  primaryDate: "2026-08-04",
  primarySourceUrl: "https://codes.findlaw.com/mi/chapter-168-michigan-election-law/mi-comp-laws-168-52.html",
  primarySnippet:
    "MCL 168.52: A general primary election of all political parties shall be held in every election precinct in this state on the Tuesday succeeding the first Monday in August preceding every general November election in which a governor is to be elected, at which time the qualified and registered electors of each political party shall vote for party candidates for the office of governor.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://codes.findlaw.com/mi/chapter-168-michigan-election-law/mi-comp-laws-168-641.html",
  generalSnippet: "MCL 168.641: The November regular election date, which is the first Tuesday after the first Monday in November.",
};

// Arizona moved its own primary date TWICE in recent cycles (2024 and again
// for 2026) via legislation responding to federal military/overseas-voter
// deadline changes — House Bill 2022, signed by Gov. Hobbs Feb. 6, 2026,
// moved the primary from the first Tuesday in August to the second-to-last
// Tuesday in July (July 21, 2026 this cycle). The bill's own text is an
// amendatory redline (old text struck, new text inserted) that reads as
// garbled prose if quoted directly ("first SECOND TO LAST Tuesday in August
// JULY") — used a clean news report of the same fact instead, since a
// citation needs to be verbatim AND readable, not just technically sourced.
// The general-election date formula was untouched by that bill, so it's
// cited to the standing, unamended statute as usual.
const ARIZONA_2026: ElectionDates = {
  primaryDate: "2026-07-21",
  primarySourceUrl: "https://www.kjzz.org/politics/2026-02-06/arizona-officials-move-up-primary-election-date-to-july-21",
  primarySnippet:
    "Gov. Katie Hobbs signed a new law permanently moving Arizona's primary elections up from August to the second-to-last Tuesday in July. That means this year's new primary election date is July 21. [House Bill 2022, sponsored by Rep. Alexander Kolodin, signed February 6, 2026.]",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://codes.findlaw.com/az/title-16-elections-and-electors/az-rev-st-sect-16-204/",
  generalSnippet: "A.R.S. § 16-204: The first Tuesday after the first Monday in November. Notwithstanding any other law, an election must be held on this date...",
};

const KENTUCKY_2026: ElectionDates = {
  primaryDate: "2026-05-19",
  primarySourceUrl: "https://codes.findlaw.com/ky/title-x-elections/ky-rev-st-sect-118-025.html",
  primarySnippet:
    "KRS 118.025: A primary for the nomination of candidates to be voted for at the next regular election shall be held on the first Tuesday after the third Monday in May of each year.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://codes.findlaw.com/ky/title-x-elections/ky-rev-st-sect-118-025.html",
  generalSnippet: "KRS 118.025: The election of all officers of all governmental units shall be held on the first Tuesday after the first Monday in November.",
};

const COLORADO_2026: ElectionDates = {
  primaryDate: "2026-06-30",
  primarySourceUrl: "https://codes.findlaw.com/co/title-1-elections/co-rev-st-sect-1-4-101/",
  primarySnippet: "C.R.S. § 1-4-101: a primary election shall be held on the last Tuesday in June of even-numbered years",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://codes.findlaw.com/co/title-1-elections/co-rev-st-sect-1-1-104/",
  generalSnippet: "C.R.S. § 1-1-104: \"General election\" means the election held on the Tuesday succeeding the first Monday of November in each even-numbered year.",
};

// Illinois' election code sets both dates in the same section.
const ILLINOIS_2026: ElectionDates = {
  primaryDate: "2026-03-17",
  primarySourceUrl: "https://codes.findlaw.com/il/chapter-10-elections/il-st-sect-10-5-2a-1-1/",
  primarySnippet:
    "10 ILCS 5/2A-1.1: Except as otherwise provided in this Code, in even-numbered years, the general election shall be held on the first Tuesday after the first Monday of November; and an election to be known as the general primary election shall be held on the third Tuesday in March.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://codes.findlaw.com/il/chapter-10-elections/il-st-sect-10-5-2a-1-1/",
  generalSnippet:
    "10 ILCS 5/2A-1.1: Except as otherwise provided in this Code, in even-numbered years, the general election shall be held on the first Tuesday after the first Monday of November; and an election to be known as the general primary election shall be held on the third Tuesday in March.",
};

const ARKANSAS_2026: ElectionDates = {
  primaryDate: "2026-03-03",
  primarySourceUrl: "https://www.sos.arkansas.gov/uploads/elections/2026_Election_Calendar_Rev._6-2025_.pdf",
  primarySnippet: "MARCH 3, 2026 Preferential Primary Election — Ark. Code § 7-7-203(b), Act 405 of 2025 (Arkansas Secretary of State's official 2026 Election Calendar).",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://codes.findlaw.com/ar/title-7-elections/ar-code-sect-7-5-102.html",
  generalSnippet: "Ark. Code § 7-5-102: On the Tuesday next after the first Monday in November in every even-numbered year, there shall be held an election in each precinct and ward in this state...",
};

const CONNECTICUT_2026: ElectionDates = {
  primaryDate: "2026-08-11",
  primarySourceUrl: "https://www.cga.ct.gov/current/pub/chap_153.htm",
  primarySnippet:
    "Conn. Gen. Stat. § 9-423(a): The primaries of all parties for nomination to an office to be voted upon at a state election shall be held on the second Tuesday in August in the year in which such state election is held.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://www.cga.ct.gov/current/pub/chap_146.htm",
  generalSnippet:
    "Conn. Gen. Stat. § 9-225(a): The town clerk or assistant town clerk of each town shall warn the electors therein to meet on the Tuesday following the first Monday in November in the even-numbered years, at six o'clock a.m. ...",
};

const INDIANA_2026: ElectionDates = {
  primaryDate: "2026-05-05",
  primarySourceUrl: "https://codes.findlaw.com/in/title-3-elections/in-code-sect-3-10-1-3/",
  primarySnippet: "Ind. Code § 3-10-1-3: A primary election shall be held on the first Tuesday after the first Monday in May of each year in which a general election is held.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://codes.findlaw.com/in/title-3-elections/in-code-sect-3-10-2-1/",
  generalSnippet:
    "Ind. Code § 3-10-2-1: A general election shall be held on the first Tuesday after the first Monday in November in each even-numbered year. All offices whose terms will expire before the next general election shall be filled at the election, unless otherwise provided by law.",
};

const IOWA_2026: ElectionDates = {
  primaryDate: "2026-06-02",
  primarySourceUrl: "https://www.legis.iowa.gov/docs/code/2026/43.7.pdf",
  primarySnippet:
    "Iowa Code § 43.7: Time of holding. The primary election by all political parties shall be held at the usual voting places of the several precincts on the first Tuesday after the first Monday in June in each even-numbered year.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://www.legis.iowa.gov/docs/code/2026/39.1.pdf",
  generalSnippet: "Iowa Code § 39.1: General election. The general election shall be held throughout the state on the first Tuesday after the first Monday in November of each even-numbered year.",
};

const MINNESOTA_2026: ElectionDates = {
  primaryDate: "2026-08-11",
  primarySourceUrl: "https://www.revisor.mn.gov/statutes/cite/204D.03",
  primarySnippet:
    "Minn. Stat. § 204D.03: The state primary shall be held on the second Tuesday in August in each even-numbered year to select the nominees of the major political parties for partisan offices and the nominees for nonpartisan offices to be filled at the state general election, other than presidential electors.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://www.revisor.mn.gov/statutes/cite/204D.03",
  generalSnippet: "Minn. Stat. § 204D.03: The state general election shall be held on the first Tuesday after the first Monday in November in each even-numbered year.",
};

const NEW_JERSEY_2026: ElectionDates = {
  primaryDate: "2026-06-02",
  primarySourceUrl: "https://law.justia.com/codes/new-jersey/title-19/section-19-2-1/",
  primarySnippet:
    "N.J.S.A. 19:2-1: Primary elections for delegates and alternates to national conventions of political parties and for the general election shall be held in each year on the Tuesday next after the first Monday in June between the hours of 6:00 A.M. and 8:00 P.M., Standard Time.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://law.justia.com/codes/new-jersey/title-19/section-19-2-3/",
  generalSnippet: "N.J.S.A. 19:2-3: General and special elections. The general election shall be held on the Tuesday next after the first Monday in November in each year.",
};

export function getElectionDates(stateCode: string, cycle: number): ElectionDates | null {
  if (stateCode === "DE" && cycle === 2026) return DELAWARE_2026;
  if (stateCode === "WY" && cycle === 2026) return WYOMING_2026;
  if (stateCode === "MT" && cycle === 2026) return MONTANA_2026;
  if (stateCode === "VT" && cycle === 2026) return VERMONT_2026;
  if (stateCode === "ND" && cycle === 2026) return NORTH_DAKOTA_2026;
  if (stateCode === "SD" && cycle === 2026) return SOUTH_DAKOTA_2026;
  if (stateCode === "NY" && cycle === 2026) return NEW_YORK_2026;
  if (stateCode === "GA" && cycle === 2026) return GEORGIA_2026;
  if (stateCode === "PA" && cycle === 2026) return PENNSYLVANIA_2026;
  if (stateCode === "MI" && cycle === 2026) return MICHIGAN_2026;
  if (stateCode === "AZ" && cycle === 2026) return ARIZONA_2026;
  if (stateCode === "KY" && cycle === 2026) return KENTUCKY_2026;
  if (stateCode === "CO" && cycle === 2026) return COLORADO_2026;
  if (stateCode === "IL" && cycle === 2026) return ILLINOIS_2026;
  if (stateCode === "AR" && cycle === 2026) return ARKANSAS_2026;
  if (stateCode === "CT" && cycle === 2026) return CONNECTICUT_2026;
  if (stateCode === "IN" && cycle === 2026) return INDIANA_2026;
  if (stateCode === "IA" && cycle === 2026) return IOWA_2026;
  if (stateCode === "MN" && cycle === 2026) return MINNESOTA_2026;
  if (stateCode === "NJ" && cycle === 2026) return NEW_JERSEY_2026;
  return null;
}
