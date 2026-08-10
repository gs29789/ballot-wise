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
  return null;
}
