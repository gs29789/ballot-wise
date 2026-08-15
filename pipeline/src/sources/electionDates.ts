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
  // Optional: only populated for a race that has an actual, confirmed
  // second-round date — e.g. Louisiana's House races, where the November
  // "primary" doubles as the general and a December runoff only happens if
  // no candidate clears a majority. Left undefined for every other race
  // (including states with a routine PARTY-primary runoff, like Alabama's —
  // that runoff still resolves to one nominee per party before a normal
  // general, so it's a fact about primaryDate, not generalDate, and stays
  // prose-only inside primarySnippet same as today).
  runoffDate?: string;
  runoffSourceUrl?: string;
  runoffSnippet?: string;
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

const HAWAII_2026: ElectionDates = {
  primaryDate: "2026-08-08",
  primarySourceUrl: "https://law.justia.com/codes/hawaii/title-2/chapter-12/section-12-2/",
  primarySnippet: "The primary shall be held on the second Saturday of August in every even numbered year.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://law.justia.com/constitution/hawaii/conart2.html",
  generalSnippet: "General elections shall be held on the first Tuesday after the first Monday in November in all even-numbered years.",
};

// Idaho's own legislature.gov and its usual FindLaw/Justia mirrors were all
// unreachable to automated fetches on scoping day; a Wayback Machine mirror
// of the same official statute page was used instead — same text, different
// access path.
const IDAHO_2026: ElectionDates = {
  primaryDate: "2026-05-19",
  primarySourceUrl: "https://web.archive.org/web/20260417222247/https://legislature.idaho.gov/statutesrules/idstat/Title34/T34CH6/SECT34-601/",
  primarySnippet:
    "34-601. Dates on which elections shall be held. Elections shall be held in this state on the following dates or times: (1) A primary election shall be held on the third Tuesday in May, 2012, and every two (2) years thereafter on the above-mentioned Tuesday.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://web.archive.org/web/20260417222247/https://legislature.idaho.gov/statutesrules/idstat/Title34/T34CH6/SECT34-601/",
  generalSnippet:
    "34-601. Dates on which elections shall be held. Elections shall be held in this state on the following dates or times: ... (2) A general election shall be held on the first Tuesday after the first Monday of November, 2012, and every two (2) years thereafter on the above-mentioned Tuesday.",
};

const KANSAS_2026: ElectionDates = {
  primaryDate: "2026-08-04",
  primarySourceUrl: "https://www.ksrevisor.gov/statutes/chapters/ch25/025_002_0003.html",
  primarySnippet:
    "The primary national, state, county and township election shall be held on the first Tuesday of August in even-numbered years for the nomination of all candidates to be voted for at the next following general election.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://ksrevisor.gov/statutes/chapters/ch25/025_025_0002.html",
  generalSnippet: "\"General election\" means the elections held on the Tuesday following the first Monday in November of both even-numbered and odd-numbered years.",
};

const NEBRASKA_2026: ElectionDates = {
  primaryDate: "2026-05-12",
  primarySourceUrl: "https://law.justia.com/codes/nebraska/chapter-32/statute-32-401/",
  primarySnippet: "32-401. Statewide primary election; when held; purposes. The statewide primary election shall be held on the first Tuesday after the second Monday in May in even-numbered years.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://law.justia.com/codes/nebraska/chapter-32/statute-32-403/",
  generalSnippet: "32-403. Statewide general election; when held. The statewide general election shall be held on the first Tuesday following the first Monday in November in each even-numbered year.",
};

const NEVADA_2026: ElectionDates = {
  primaryDate: "2026-06-09",
  primarySourceUrl: "https://law.justia.com/codes/nevada/chapter-293/statute-293-175/",
  primarySnippet: "1. The primary election must be held on the second Tuesday in June of each even-numbered year. (NRS 293.175)",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://nevada.public.law/statutes/nrs_293.12755",
  generalSnippet: "A general election must be held throughout the State on the first Tuesday after the first Monday of November in each even-numbered year. (NRS 293.12755)",
};

const OKLAHOMA_2026: ElectionDates = {
  primaryDate: "2026-06-16",
  primarySourceUrl: "https://law.justia.com/codes/oklahoma/title-26/section-26-1-102/",
  primarySnippet:
    "A Primary Election shall be held on the third Tuesday in June of each even-numbered year, at which time each political party recognized by the laws of this state shall nominate its candidates for the offices to be filled at the next succeeding General Election unless otherwise provided by law.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://law.justia.com/codes/oklahoma/title-26/section-26-1-101/",
  generalSnippet:
    "On the first Tuesday succeeding the first Monday of November, 1976, and every four (4) years thereafter, a General Election shall be held... On said date, and every two (2) years thereafter, United States Senators and United States Representatives, whose terms expire before the next succeeding General Election, and state, district and county officers, whose terms expire before the next succeeding General Election, shall be elected.",
};

const MARYLAND_2026: ElectionDates = {
  primaryDate: "2026-06-23",
  primarySourceUrl: "https://msa.maryland.gov/msa/mdmanual/41electp/html/forth.html",
  primarySnippet: "Next primary election: June 23, 2026. ... In Gubernatorial Election years: held on fourth Tuesday in June (2026, 2030) (Chapter 169, Acts of 2011; Chapter 311, Acts of 2025; Code Election Law Article, sec. 8-201).",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://msa.maryland.gov/msa/mdmanual/41electp/html/forth.html",
  generalSnippet: "Next general election: November 3, 2026. In even-numbered years: held on the Tuesday after 1st Monday in November (2026, 2028) (Chapter 99, Acts of 1956, ratified Nov. 6, 1956: Const., Art. XV, sec. 7; Code Election Law Article...).",
};

const MISSISSIPPI_2026: ElectionDates = {
  primaryDate: "2026-03-10",
  primarySourceUrl: "https://www.sos.ms.gov/content/documents/elections/2026%20Elections%20Calendar.pdf",
  primarySnippet: "MARCH ... 10th PRIMARY ELECTION DAY (U.S. CONGRESS): Polling places are open from 7:00 a.m. until 7:00 p.m. (Miss. Code Ann. §§ 23-15-171 and 23-15-541)",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://www.sos.ms.gov/content/documents/elections/2026%20Elections%20Calendar.pdf",
  generalSnippet: "NOVEMBER ... 3rd General Election Day and Regular Special Election Day. Polls open from 7 a.m. - 7 p.m. (MS Const. Art. 12, § 252; Miss. Code Ann.. § 23-15-833)",
};

const NEW_MEXICO_2026: ElectionDates = {
  primaryDate: "2026-06-02",
  primarySourceUrl: "https://codes.findlaw.com/nm/chapter-1-elections/nm-st-sect-1-8-11/",
  primarySnippet: "A primary election shall be held in each county in this state on the first Tuesday after the first Monday in June of each even-numbered year. (NMSA 1978 § 1-8-11)",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://www.sos.nm.gov/wp-content/uploads/2025/01/NM_Constitution_-2025-for-SOS.pdf",
  generalSnippet: "Sec. 6. [Date of general elections.] General elections shall be held in the state on the Tuesday after the first Monday in November in each even-numbered year. (New Mexico Constitution, Article XX, Section 6 — official text from the Secretary of State's published Constitution booklet)",
};

const OREGON_2026: ElectionDates = {
  primaryDate: "2026-05-19",
  primarySourceUrl: "https://oregon.public.law/statutes/ors_254.056",
  primarySnippet: "The primary election shall be held on the third Tuesday in May of each even-numbered year.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://oregon.public.law/statutes/ors_254.056",
  generalSnippet: "The general election shall be held on the first Tuesday after the first Monday in November of each even-numbered year.",
};

const SOUTH_CAROLINA_2026: ElectionDates = {
  primaryDate: "2026-06-09",
  primarySourceUrl: "https://www.scstatehouse.gov/code/t07c013.php",
  primarySnippet: "S.C. Code Ann. § 7-13-40: 'a party primary must be held by the party and conducted by the State Election Commission and the respective county boards of voter registration and elections on the second Tuesday in June of each general election year' — June 9, 2026 is the second Tuesday in June 2026.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://www.scstatehouse.gov/code/t07c013.php",
  generalSnippet: "S.C. Code Ann. § 7-13-10: 'General elections for Federal, State and county officers in this State shall be held on the first Tuesday following the first Monday in November in each even-numbered year' — November 3, 2026 is the first Tuesday after the first Monday in November 2026.",
};

const VIRGINIA_2026: ElectionDates = {
  primaryDate: "2026-08-04",
  primarySourceUrl: "https://www.elections.virginia.gov/news-releases/primary-election-moved-to-august-4-1.html",
  primarySnippet: "Primary elections for all offices appearing on the 2026 November General Election ballot will be held on Aug. 4, 2026... The 2026 Primary Election date was changed by the General Assembly in House Bill 29, which was signed into law on February 20.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://law.lis.virginia.gov/vacode/title24.2/chapter1/section24.2-101/",
  generalSnippet: "'General election' means an election held in the Commonwealth on the Tuesday after the first Monday in November...for the purpose of filling offices regularly scheduled by law to be filled at those times.",
};

const WEST_VIRGINIA_2026: ElectionDates = {
  primaryDate: "2026-05-12",
  primarySourceUrl: "https://codes.findlaw.com/wv/chapter-3-elections/wv-code-sect-3-5-1/",
  primarySnippet: "Primary elections shall be held at the voting place in each of the voting precincts in the state, for the purposes set forth in this article, on the second Tuesday in May in the year one thousand nine hundred eighty-six and in each second year thereafter. (W. Va. Code §3-5-1)",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://codes.findlaw.com/wv/chapter-3-elections/wv-code-sect-3-1-31/",
  generalSnippet: "General elections shall be held in the several election precincts of the state on the Tuesday next after the first Monday in November of each even year. (W. Va. Code §3-1-31(a))",
};

const WISCONSIN_2026: ElectionDates = {
  primaryDate: "2026-08-11",
  primarySourceUrl: "https://codes.findlaw.com/wi/elections-ch-5-to-12/wi-st-5-02/",
  primarySnippet: "Wis. Stat. § 5.02(12s): \"Partisan primary\" means the primary held the 2nd Tuesday in August to nominate candidates to be voted for at the general election.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://codes.findlaw.com/wi/elections-ch-5-to-12/wi-st-5-02/",
  generalSnippet: "Wis. Stat. § 5.02(5): \"General election\" means the election held in even-numbered years on the Tuesday after the first Monday in November to elect United States senators, representatives in congress, presidential electors, state senators, representatives to the assembly, district attorneys, state officers other than the state superintendent and judicial officers, and county officers other than supervisors and county executives.",
};

const NORTH_CAROLINA_2026: ElectionDates = {
  primaryDate: "2026-03-03",
  primarySourceUrl: "https://law.justia.com/codes/north-carolina/2023/chapter-163/article-1/section-163-1/",
  primarySnippet: "N.C. Gen. Stat. § 163-1(b): \"On Tuesday next after the first Monday in March preceding each general election to be held in November for the officers referred to in subsection (a) of this section, there shall be held in all election precincts within the territory for which the officers are to be elected a primary election for the purpose of nominating candidates for each political party in the State for those offices.\"",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://law.justia.com/codes/north-carolina/2023/chapter-163/article-1/section-163-1/",
  generalSnippet: "Members of ... House of Representatives of the Congress of the United States [:] Jurisdiction: Congressional district ... Date of Election: Tuesday next after the first Monday in November 1968 and every two years thereafter ... Term of Office: Two years ... United States Senators [:] Jurisdiction: State ... Date of Election: At the regular election immediately preceding the termination of each regular term ... Term of Office: Six years",
};

const MISSOURI_2026: ElectionDates = {
  primaryDate: "2026-08-04",
  primarySourceUrl: "https://law.justia.com/codes/missouri/title-ix/chapter-115/section-115-121/",
  primarySnippet: "115.121. General election, when held — primary election, when held — general municipal election day, when held. — 1. The general election day shall be the first Tuesday after the first Monday in November of even-numbered years. 2. The primary election day shall be the first Tuesday after the first Monday in August of even-numbered years.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://law.justia.com/codes/missouri/title-ix/chapter-115/section-115-121/",
  generalSnippet: "115.121. General election, when held — primary election, when held — general municipal election day, when held. — 1. The general election day shall be the first Tuesday after the first Monday in November of even-numbered years. 2. The primary election day shall be the first Tuesday after the first Monday in August of even-numbered years.",
};

const OHIO_2026: ElectionDates = {
  primaryDate: "2026-05-05",
  primarySourceUrl: "https://law.justia.com/codes/ohio/title-35/chapter-3501/section-3501-01/",
  primarySnippet: "(A) \"General election\" means the election held on the first Tuesday after the first Monday in each November. ... (E)(1) \"Primary\" or \"primary election\" means an election held for the purpose of nominating persons as candidates of political parties for election to offices... Primary elections shall be held on the first Tuesday after the first Monday in May of each year except in years in which a presidential primary election is held.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://law.justia.com/codes/ohio/title-35/chapter-3501/section-3501-01/",
  generalSnippet: "(A) \"General election\" means the election held on the first Tuesday after the first Monday in each November. ... (E)(1) \"Primary\" or \"primary election\" means an election held for the purpose of nominating persons as candidates of political parties for election to offices... Primary elections shall be held on the first Tuesday after the first Monday in May of each year except in years in which a presidential primary election is held.",
};

const FLORIDA_2026: ElectionDates = {
  primaryDate: "2026-08-18",
  primarySourceUrl: "https://www.flsenate.gov/Laws/Statutes/2025/100.061",
  primarySnippet: "100.061 Primary election.—In each year in which a general election is held, a primary election for nomination of candidates of political parties shall be held on the Tuesday 11 weeks prior to the general election.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://www.flsenate.gov/Laws/Statutes/2025/100.031",
  generalSnippet: "on the first Tuesday after the first Monday in November of each even-numbered year",
};

// Alabama ran two separate primary tracks in 2026: the regular calendar
// (May 19 primary + June 16 runoff) governed Districts 3/4/5, while a
// mid-decade map change (SCOTUS-permitted, see primaryResults.ts) forced a
// standalone special primary (Aug 11) for Districts 1/2/6/7 — the only
// four districts actually redrawn. The Senate race and Districts 3/4/5
// follow the regular track since redistricting doesn't touch the Senate
// or those three districts' lines.
const ALABAMA_2026_REGULAR_PRIMARY = {
  primaryDate: "2026-05-19",
  primarySourceUrl: "https://www.sos.alabama.gov/sites/default/files/election-2026/AdminCalendar%20-2026.pdf",
  primarySnippet: "Alabama Statewide Primary Election - May 19, 2026 / Primary Runoff Election - June 16, 2026 / General Election - November 3, 2026.",
};
const ALABAMA_2026_SPECIAL_PRIMARY = {
  primaryDate: "2026-08-11",
  primarySourceUrl:
    "https://governor.alabama.gov/newsroom/2026/05/governor-ivey-celebrates-major-court-victory-in-states-redistricting-battle-calls-special-election-for-alabama-drawn-congressional-map/",
  primarySnippet: "Governor Ivey set the special primary election for Tuesday, August 11, 2026.",
};
const ALABAMA_2026_GENERAL = {
  generalDate: "2026-11-03",
  generalSourceUrl:
    "https://governor.alabama.gov/newsroom/2026/05/governor-ivey-celebrates-major-court-victory-in-states-redistricting-battle-calls-special-election-for-alabama-drawn-congressional-map/",
  generalSnippet: "The general election will occur as planned with all other races on Tuesday, November 3, 2026.",
};
const AL_SPECIAL_PRIMARY_RACE_SLUGS = new Set(["house-01", "house-02", "house-06", "house-07"]);
function getAlabamaElectionDates(raceSlug?: string): ElectionDates {
  const primary = raceSlug && AL_SPECIAL_PRIMARY_RACE_SLUGS.has(raceSlug) ? ALABAMA_2026_SPECIAL_PRIMARY : ALABAMA_2026_REGULAR_PRIMARY;
  return { ...primary, ...ALABAMA_2026_GENERAL };
}

const TENNESSEE_2026: ElectionDates = {
  primaryDate: "2026-08-06",
  primarySourceUrl: "https://sos-prod.tnsosgovfiles.com/s3fs-public/document/Key%20Dates%20-%202026_0.pdf",
  primarySnippet: "Thursday, August 6, 2026 - Primary and General Election. Primary elections will be held for Governor, U.S. Senate, U.S. House, Tennessee Senate (odd-numbered districts), Tennessee House...",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://sos-prod.tnsosgovfiles.com/s3fs-public/document/Key%20Dates%20-%202026_0.pdf",
  generalSnippet: "Tuesday, November 3, 2026 - State and Federal General Election.",
};

const TEXAS_2026: ElectionDates = {
  primaryDate: "2026-03-03",
  primarySourceUrl: "https://codes.findlaw.com/tx/election-code/elec-sect-41-007/",
  primarySnippet: "Tex. Elec. Code § 41.007(a): The general primary election date is the first Tuesday in March in each even-numbered year.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://codes.findlaw.com/tx/election-code/elec-sect-41-002/",
  generalSnippet: "Tex. Elec. Code § 41.002: The general election for state and county officers shall be held on the first Tuesday after the first Monday in November in even-numbered years.",
};

// Louisiana's Senate seat needed a real second-round vote this cycle — both
// party primaries on May 16 came up short of a majority, so a June 27
// runoff actually happened and decided both nominations. First real use of
// the runoffDate/runoffSourceUrl/runoffSnippet fields, added specifically
// so Louisiana's House races (deferred until Nov 3 results are certified —
// see votingSystem.ts) need no further interface work when that day comes.
const LOUISIANA_2026: ElectionDates = {
  primaryDate: "2026-05-16",
  primarySourceUrl: "https://www.sos.la.gov/media/dcvl5ojl/051426-fall-house-races.pdf",
  primarySnippet: "races and propositions scheduled for the Saturday, May 16 election are continuing as planned... including the race for U.S. Senator...",
  runoffDate: "2026-06-27",
  runoffSourceUrl: "https://www.sos.la.gov/media/dcvl5ojl/051426-fall-house-races.pdf",
  runoffSnippet: "All other races and propositions, including the race for U.S. Senate, currently scheduled on the May 16 and June 27 ballots, will proceed as planned.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://www.sos.la.gov/elections-voting/election-dates",
  generalSnippet: "November 3, 2026 - U.S. Senate General/Open U.S. Representative Primary/Open Primary Election",
};

const MAINE_2026: ElectionDates = {
  primaryDate: "2026-06-09",
  primarySourceUrl: "https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/2026%20Candidates%20Guide%20to%20Ballot%20Access%20Final.pdf",
  primarySnippet: "The Primary Elections on June 9, 2026 for U.S. Senate, U.S. Congress, Governor, State Senate, and State Representative to the Legislature will be decided by a system of ranked-choice voting if three or more candidates qualify for the ballot...",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://www.maine.gov/sos/sites/maine.gov.sos/files/inline-files/2026%20Candidates%20Guide%20to%20Ballot%20Access%20Final.pdf",
  generalSnippet: "The General Election on November 3, 2026 for U.S. Senate and U.S. Congress will also be decided by a system of ranked-choice voting if three or more candidates qualify for the office...",
};

const ALASKA_2026: ElectionDates = {
  primaryDate: "2026-08-18",
  primarySourceUrl: "https://codes.findlaw.com/ak/title-15-elections/ak-st-sect-15-25-020/",
  primarySnippet: "AS 15.25.020: The primary election is held on the third Tuesday in August of every even-numbered year.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://codes.findlaw.com/ak/title-15-elections/ak-st-sect-15-15-020/",
  generalSnippet: "AS 15.15.020: The general election is held on the Tuesday after the first Monday in November in every even numbered year.",
};

const CALIFORNIA_2026: ElectionDates = {
  primaryDate: "2026-06-02",
  primarySourceUrl: "https://www.sos.ca.gov/administration/news-releases-and-advisories/2026-news-releases-and-advisories/california-secretary-state-shirley-n-weber-phd-announces-california-polls-are-now-closed-june-2-2026-primary-election",
  primarySnippet: "California Secretary of State Shirley N. Weber, Ph.D., just announced that California polls are now closed for the June 2, 2026, Primary Election.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://www.sos.ca.gov/elections/upcoming-elections",
  generalSnippet: "General Election - November 3, 2026.",
};

const WASHINGTON_2026: ElectionDates = {
  primaryDate: "2026-08-04",
  primarySourceUrl: "https://www.sos.wa.gov/elections/elections-calendar/dates-and-deadlines",
  primarySnippet: "August 4 — Primary - Deposit your ballot in an official drop box by 8 p.m. on Election Day.",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://www.sos.wa.gov/elections/elections-calendar/dates-and-deadlines",
  generalSnippet: "November 3 — General Election - Deposit your ballot in an official drop box by 8 p.m. on Election Day.",
};

// No runoffDate: Utah resolves a primary by plain plurality, no majority
// threshold (§ 20A-9-403(4)(a)) — a 2025 bill that would have added a
// runoff (HB231) passed the House but died in a Senate committee, never
// enacted. The only tiebreaker Utah has is for an exact tie, resolved by
// lot under § 20A-1-304, not a second election.
const UTAH_2026: ElectionDates = {
  primaryDate: "2026-06-23",
  primarySourceUrl: "https://le.utah.gov/xcode/Title20A/Chapter1/20A-1-S201.5.html",
  primarySnippet:
    "20A-1-201.5(1): \"The regular primary election shall be held throughout the state on the fourth Tuesday of June of each even numbered year as provided in Section 20A-9-403, 20A-9-407, or 20A-9-408, as applicable, to nominate persons for national, state, school board, and county offices.\"",
  generalDate: "2026-11-03",
  generalSourceUrl: "https://le.utah.gov/xcode/Title20A/Chapter1/20A-1-S201.html",
  generalSnippet:
    "20A-1-201: \"(1) A regular general election shall be held throughout the state on the first Tuesday after the first Monday in November of each even-numbered year. (2) At the regular general election, the voters shall: (a) choose persons to serve the terms established by law for the following offices: ... (ii) United States Senators; (iii) Representatives to the United States Congress...\"",
};

export function getElectionDates(stateCode: string, cycle: number, raceSlug?: string): ElectionDates | null {
  if (stateCode === "AL" && cycle === 2026) return getAlabamaElectionDates(raceSlug);
  if (stateCode === "TN" && cycle === 2026) return TENNESSEE_2026;
  if (stateCode === "TX" && cycle === 2026) return TEXAS_2026;
  if (stateCode === "LA" && cycle === 2026) return LOUISIANA_2026;
  if (stateCode === "ME" && cycle === 2026) return MAINE_2026;
  if (stateCode === "AK" && cycle === 2026) return ALASKA_2026;
  if (stateCode === "CA" && cycle === 2026) return CALIFORNIA_2026;
  if (stateCode === "WA" && cycle === 2026) return WASHINGTON_2026;
  if (stateCode === "UT" && cycle === 2026) return UTAH_2026;
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
  if (stateCode === "HI" && cycle === 2026) return HAWAII_2026;
  if (stateCode === "ID" && cycle === 2026) return IDAHO_2026;
  if (stateCode === "KS" && cycle === 2026) return KANSAS_2026;
  if (stateCode === "NE" && cycle === 2026) return NEBRASKA_2026;
  if (stateCode === "NV" && cycle === 2026) return NEVADA_2026;
  if (stateCode === "OK" && cycle === 2026) return OKLAHOMA_2026;
if (stateCode === "MD" && cycle === 2026) return MARYLAND_2026;
  if (stateCode === "MS" && cycle === 2026) return MISSISSIPPI_2026;
  if (stateCode === "NM" && cycle === 2026) return NEW_MEXICO_2026;
  if (stateCode === "OR" && cycle === 2026) return OREGON_2026;
  if (stateCode === "SC" && cycle === 2026) return SOUTH_CAROLINA_2026;
  if (stateCode === "VA" && cycle === 2026) return VIRGINIA_2026;
  if (stateCode === "WV" && cycle === 2026) return WEST_VIRGINIA_2026;
  if (stateCode === "WI" && cycle === 2026) return WISCONSIN_2026;
  if (stateCode === "NC" && cycle === 2026) return NORTH_CAROLINA_2026;
  if (stateCode === "MO" && cycle === 2026) return MISSOURI_2026;
  if (stateCode === "OH" && cycle === 2026) return OHIO_2026;
  if (stateCode === "FL" && cycle === 2026) return FLORIDA_2026;
  return null;
}
