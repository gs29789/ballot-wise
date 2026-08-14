// A handful of states run their congressional elections under a
// fundamentally different process than the standard "partisan primary
// narrows the field, normal November general decides it" shape every other
// state in this project uses — top-N nonpartisan blanket primaries,
// ranked-choice generals, same-party generals. Nothing else in this
// pipeline needs to know WHICH mechanism a race uses (candidate fetching,
// financial data, bio/platform extraction are all identical regardless) —
// this module exists purely to give a voter a plain-language explanation of
// a race's process, shown once at the top of the page. Deliberately
// prose-only, no machine-readable "mechanism" type: nothing downstream
// branches on system type programmatically, only displays the explanation.

// primaryExplanation and generalExplanation get their own citation each,
// same reasoning as ElectionDates's primary/general split: a state's
// primary-narrowing mechanic and its general-decision mechanic are often
// codified in different statute sections (confirmed directly for Alaska —
// AS 15.25.010 governs the top-four primary, AS 15.15.350 governs the
// ranked-choice general) and a single shared snippet couldn't fully
// support both claims the way citation integrity requires here.
export interface VotingSystemFact {
  label: string; // short badge text, e.g. "Top-four ranked-choice"
  primaryExplanation: string; // how the field narrows (or doesn't) before the general
  primarySourceUrl: string;
  primarySnippet: string;
  generalExplanation: string; // how the general actually decides a winner
  generalSourceUrl: string;
  generalSnippet: string;
}

const ALASKA_2026: VotingSystemFact = {
  label: "Top-four nonpartisan primary + ranked-choice general",
  primaryExplanation:
    "Every candidate for this office, regardless of party, appears on one primary ballot. The four candidates with the most votes advance to the general election — there's no party nomination step and no vote-share threshold to clear.",
  primarySourceUrl: "https://codes.findlaw.com/ak/title-15-elections/ak-st-sect-15-25-010/",
  primarySnippet:
    "AS 15.25.010: \"The primary election does not serve to determine the nominee of a political party or political group but serves only to narrow the number of candidates whose names will appear on the ballot at the general election. Except as provided in AS 15.25.100(d), only the four candidates who receive the greatest number of votes for any office shall advance to the general election.\"",
  generalExplanation:
    "Voters rank the candidates in order of preference. If one candidate is the top choice on more than half of ballots, they win outright. Otherwise, the last-place candidate is eliminated and their voters' ballots move to their next-ranked choice, repeating until someone has a majority.",
  generalSourceUrl: "https://codes.findlaw.com/ak/title-15-elections/ak-st-sect-15-15-350/",
  generalSnippet:
    "AS 15.15.350(c)-(d): \"All general elections shall be conducted by ranked-choice voting... If a candidate is highest-ranked on more than one-half of the active ballots, that candidate is elected and the tabulation is complete. Otherwise, tabulation proceeds in sequential rounds... if the candidate with the fewest votes is defeated, votes cast for the defeated candidate shall cease counting for the defeated candidate and shall be added to the totals of each ballot's next-highest-ranked continuing candidate.\"",
};

const MAINE_2026: VotingSystemFact = {
  label: "Ranked-choice voting",
  primaryExplanation:
    "Each party's primary uses ranked-choice voting whenever 3 or more candidates (or 2 candidates plus a declared write-in) qualify for that party's ballot — voters rank their choices rather than picking just one.",
  primarySourceUrl: "https://legislature.maine.gov/statutes/21-a/title21-Asec1.html",
  primarySnippet:
    "21-A M.R.S. §1(27-C): \"'Elections determined by ranked-choice voting' means any of the following elections in which 3 or more candidates have qualified to be listed on the ballot for a particular office or at least 2 such candidates plus one or more declared write-in candidates have qualified... (A) Primary elections for the offices of United States Senator, United States Representative to Congress...\"",
  generalExplanation:
    "Voters rank candidates in order of preference. If no one has more than half of first-choice votes, the last-place candidate is eliminated and their voters' ballots move to their next choice, repeating until someone has a majority — Maine was the first state to use this for federal elections, in 2018.",
  generalSourceUrl: "https://legislature.maine.gov/statutes/21-a/title21-Asec723-A.html",
  generalSnippet:
    "21-A M.R.S. §723-A(2): \"If a candidate has been assigned ranking number one on more than 50% of all ballots cast for the particular office for which the candidate is running... that candidate is declared the winner... If no candidate has been assigned ranking number one on more than 50%... the ranked-choice voting count must proceed in rounds... the last-place candidate is removed from consideration and a new round begins.\"",
};

export function getVotingSystem(state: string, cycle: number, raceSlug?: string): VotingSystemFact | null {
  if (state === "AK" && cycle === 2026) return ALASKA_2026;
  if (state === "ME" && cycle === 2026) return MAINE_2026;
  return null;
}
