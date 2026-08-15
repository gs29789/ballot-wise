// Races and sub-races this project knows about but hasn't built yet,
// each waiting on a real-world date or event before the usual research
// pass (read results, match FEC IDs, write a primaryResults.ts entry)
// can happen. This list is the input to checkPendingRaces.ts, which a
// scheduled task checks daily and pushes a notification for anything
// whose watch date has passed. Maintained by hand, same as RACES[]
// itself: remove an entry once its race is actually built (that's the
// "resolved" signal — no separate status field needed).
//
// watchDate is optional: most entries have a real calendar date, but a
// few (Washington's uncertified districts, Louisiana's House runoff
// question) don't have one yet — those get checked every run regardless,
// same as an already-overdue entry, since there's no date to wait for.

export interface PendingRace {
  id: string; // stable identifier, used for notification dedup — don't reuse or reassign
  description: string;
  watchDate?: string; // ISO YYYY-MM-DD; omit for "no fixed date, recheck every run"
  watchReason: string;
  source_url: string;
  snippet: string;
}

export const PENDING_RACES: PendingRace[] = [
  {
    id: "wy-primary-2026",
    description: "Wyoming — primary results not yet applied (House-AL, Senate)",
    watchDate: "2026-08-18",
    watchReason: "primary",
    source_url: "https://sos.wyo.gov/elections/electionresults.aspx",
    snippet: "Wyoming Secretary of State election results — check after the 2026-08-18 primary.",
  },
  {
    id: "fl-remaining-primary-2026",
    description: "Florida — 23 remaining House districts + Senate special election not yet built (5 districts already live)",
    watchDate: "2026-08-18",
    watchReason: "primary",
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Florida,_2026",
    snippet: "Florida's 2026 U.S. House elections — 23 of 28 districts pending the 2026-08-18 primary as of this tracking entry's creation.",
  },
  {
    id: "ak-top4-primary-2026",
    description: "Alaska — top-4 primary results not yet applied (House-AL, Senate)",
    watchDate: "2026-08-18",
    watchReason: "primary",
    source_url: "https://www.elections.alaska.gov/",
    snippet: "Alaska Division of Elections — top-4 primary results, needed before the ranked-choice general field can be confirmed.",
  },
  {
    id: "ok-senate-runoff-2026",
    description: "Oklahoma — Senate Democratic runoff not yet applied (House races already live)",
    watchDate: "2026-08-25",
    watchReason: "runoff",
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Oklahoma,_2026",
    snippet: "Oklahoma Senate election — Democratic runoff between Jim Priest and N'Kiyla Thomas scheduled for 2026-08-25.",
  },
  {
    id: "sc-senate-runoff-2026",
    description: "South Carolina — Senate Republican runoff not yet applied (House races already live)",
    watchDate: "2026-08-25",
    watchReason: "runoff",
    source_url: "https://ballotpedia.org/United_States_Senate_special_election_in_South_Carolina,_2026",
    snippet: "South Carolina Senate special election — Republican runoff between Darline Graham-Nordone and Ralph Norman scheduled for 2026-08-25, following Lindsey Graham's death in office.",
  },
  {
    id: "ma-primary-2026",
    description: "Massachusetts — not yet wired into pipeline code at all (9 districts + Senate, scoped clean, primary rosters already researched)",
    watchDate: "2026-09-01",
    watchReason: "primary",
    source_url: "https://ballotpedia.org/Massachusetts_elections,_2026",
    snippet: "Massachusetts 2026 primary election scheduled for 2026-09-01.",
  },
  {
    id: "nh-primary-2026",
    description: "New Hampshire — not yet wired into pipeline code at all (2 districts + Senate, scoped clean)",
    watchDate: "2026-09-08",
    watchReason: "primary",
    source_url: "https://ballotpedia.org/New_Hampshire_elections,_2026",
    snippet: "New Hampshire 2026 primary election scheduled for 2026-09-08.",
  },
  {
    id: "ri-primary-2026",
    description: "Rhode Island — not yet wired into pipeline code at all (2 districts + Senate, scoped clean)",
    watchDate: "2026-09-09",
    watchReason: "primary",
    source_url: "https://ballotpedia.org/Rhode_Island_elections,_2026",
    snippet: "Rhode Island 2026 primary election moved to Wednesday 2026-09-09 (from the default Tuesday, to avoid a Labor Day conflict).",
  },
  {
    id: "de-primary-2026",
    description: "Delaware — primary results not yet applied (House-AL, Senate)",
    watchDate: "2026-09-15",
    watchReason: "primary",
    source_url: "https://elections.delaware.gov/results/",
    snippet: "Delaware Department of Elections results — check after the 2026-09-15 primary.",
  },
  {
    id: "wa-05-08-certification",
    description: "Washington — WA-05 and WA-08 general-election fields still uncertified (8 of 10 districts already live)",
    watchReason: "certification",
    source_url: "https://ballotpedia.org/Washington%27s_5th_Congressional_District_election,_2026",
    snippet: "As of the last check, Ballotpedia had not yet certified the second-place finisher in WA-05 or WA-08 — recheck this page and WA-08's equivalent periodically.",
  },
  {
    id: "la-house-nov3",
    description: "Louisiana House — all districts pending Nov 3 results (Senate already live); a Dec runoff is only needed per-district if nobody clears a majority",
    watchDate: "2026-11-03",
    watchReason: "general/possible-runoff-decider",
    source_url: "https://www.sos.la.gov/elections-voting/election-dates",
    snippet: "Louisiana's House races revert to an all-party primary held on the same day as the Nov 3, 2026 general — a December runoff applies only to districts where no candidate clears a majority.",
  },
];
