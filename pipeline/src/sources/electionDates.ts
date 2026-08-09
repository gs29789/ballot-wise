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

export function getElectionDates(stateCode: string, cycle: number): ElectionDates | null {
  if (stateCode === "DE" && cycle === 2026) return DELAWARE_2026;
  if (stateCode === "WY" && cycle === 2026) return WYOMING_2026;
  if (stateCode === "MT" && cycle === 2026) return MONTANA_2026;
  return null;
}
