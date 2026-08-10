// Post-primary candidate filtering — narrows a race's candidate list down to
// confirmed general-election contenders once a state's primary has been
// certified. FEC's own candidate data has no concept of primary results — a
// primary loser stays registered indefinitely (confirmed: Ryan Zinke never
// filed for re-election in MT-01, per Montana's own ballot-certification
// announcement, yet still shows as an active FEC candidate with no status
// change). So this has to be sourced from the state's own certified canvass,
// hand-verified per state/race rather than pulled from any API — these are
// pages meant for a person to read, not a script to poll, same as election
// dates and the background-check fact.
//
// Independents don't run in a primary at all in Montana — they qualify by
// petition signature, verified and certified separately from the primary.
// Montana's FULL general-election ballot doesn't certify until August 20,
// 2026 (this was built 2026-08-06) — so only already-certified independents
// are included below; this should be revisited once that full certification
// lands, since more may be added.

export interface PrimaryResult {
  advancingCandidateIds: string[]; // FEC candidate IDs confirmed to advance to the general election
  source_url: string;
  snippet: string;
}

const MONTANA_2026_CANVASS_URL =
  "https://sosmt.gov/wp-content/uploads/wpfd/preview_files/2026-Primary-State-Canvass(f0627306086b974f9ac2e416bb8125c9).pdf";
const INDEPENDENT_CERTIFICATION_URL =
  "https://dailymontanan.com/briefs/montana-secretary-of-state-certifies-three-independent-candidates-meet-ballot-requirements/";

const MONTANA_2026_PRIMARY: Record<string, PrimaryResult> = {
  // Aaron Flint (R) and Samuel Forstag (D) won their contested primaries.
  // The ballot's unopposed Libertarian (Nick Sheedy) has no FEC registration
  // findable under any search — he was never in this pipeline's candidate
  // list to begin with, independent of this filter.
  "house-01": {
    advancingCandidateIds: ["H6MT01152", "H6MT01137"],
    source_url: MONTANA_2026_CANVASS_URL,
    snippet:
      "UNITED STATES REPRESENTATIVE 1ST CONGRESSIONAL Republican RAY CURTIS AARON FLINT CHRISTI JACOBSEN AL 'DOC' OLSZEWSKI ... Total 5479 41170 18877 16686 [p.4] — UNITED STATES REPRESENTATIVE 1ST CONGRESSIONAL Democratic RYAN BUSSE RUSSELL CLEVELAND SAM FORSTAG MATT RAINS ... Total 23196 15238 26276 5518 [p.4]",
  },
  // Troy Downing (R) ran unopposed; Brian Miller (D) won a contested
  // primary; Michael Eisenhauer (I) separately cleared Montana's
  // petition-signature threshold (confirmed certified by the Secretary of
  // State, per Daily Montanan's report). The ballot's unopposed Libertarian
  // (Patrick McCracken) IS in FEC's data and already correctly included —
  // he was never contested, so nothing to filter for him.
  "house-02": {
    advancingCandidateIds: ["H4MT02098", "H6MT02150", "H6MT02168"],
    source_url: MONTANA_2026_CANVASS_URL,
    snippet:
      "UNITED STATES REPRESENTATIVE 2ND CONGRESSIONAL Republican TROY DOWNING ... Total 82088 [p.7] — UNITED STATES REPRESENTATIVE 2ND CONGRESSIONAL Democratic SAM LUX BRIAN J MILLER JONATHAN WINDY BOY ... Total 11759 24033 7484 [p.6]. Independent Michael Eisenhauer doesn't run in a primary — separately certified per " +
      INDEPENDENT_CERTIFICATION_URL +
      ': "Michael Eisenhauer also met the signature threshold for a Congressional seat, and will face incumbent Rep. Troy Downing, a Republican, and attorney Brian Miller, a Democrat."',
  },
  // Kurt Alme (R), Alani Bankhead (D), and Kyle Austin (L) each won their
  // contested primaries. Steve Daines — the sitting senator — does not
  // appear anywhere in the certified Republican Senate primary results at
  // all, confirming he is not actually a 2026 candidate despite still
  // showing FEC registration with 2026 in his election_years. Seth Bodnar
  // (I) separately cleared Montana's petition-signature threshold
  // (confirmed certified, per Daily Montanan's report).
  senate: {
    advancingCandidateIds: ["S6MT00295", "S6MT00253", "S6MT00261", "S6MT00287"],
    source_url: MONTANA_2026_CANVASS_URL,
    snippet:
      "UNITED STATES SENATOR Republican KURT ALME LEE CALHOUN CHARLES WALKING CHILD ... Total 128716 23872 16474 [p.2] — UNITED STATES SENATOR Democratic ALANI BANKHEAD MICHAEL BLACK WOLF MICHAEL HUMMERT CHRISTOPHER KEHOE REILLY NEILL ... Total 48772 14678 4305 7108 36880 [p.1] — UNITED STATES SENATOR Libertarian KYLE AUSTIN TOM JANDRON ... Total 1819 1592 [p.3]. Independent Seth Bodnar doesn't run in a primary — separately certified per " +
      INDEPENDENT_CERTIFICATION_URL +
      ': "Seth Bodnar, the former president of the University of Montana who is running in a three-way race for the U.S. Senate, submitted more than twice the number of signatures required for the office."',
  },
};

// North Dakota's official results dashboard (resultsnd.sos.nd.gov) is a
// JS-rendered live page, not a static document like Montana's PDF canvass —
// confirmed certified by the State Canvassing Board 2026-06-25 (per
// sos.nd.gov's own news release), snippet below is the certified per-
// candidate totals as rendered on that page (358/358 precincts, 100%
// reporting) rather than a byte-for-byte HTML excerpt.
const NORTH_DAKOTA_RESULTS_URL = "https://resultsnd.sos.nd.gov/";

const NORTH_DAKOTA_2026_PRIMARY: Record<string, PrimaryResult> = {
  // Julie Fedorchak (R, incumbent) and Trygve Hammer (D) each won their
  // party's primary — Fedorchak contested (73%), Hammer unopposed (99.8%,
  // remainder write-ins). Helene Neville sought the Democratic-NPL
  // convention endorsement, didn't secure it (25 delegate votes), and per
  // her own campaign site is now pursuing an INDEPENDENT petition candidacy
  // instead (1,000 signatures, filing deadline 2026-08-31 per the ND SOS's
  // "Running for U.S. Congress" candidate guide) — that deadline hasn't
  // passed yet as of this build (2026-08-09), so her ballot status isn't
  // certified and she's deliberately left out of advancingCandidateIds
  // below. Revisit after 2026-08-31.
  "house-AL": {
    advancingCandidateIds: ["H4ND00061", "H6ND01049"],
    source_url: NORTH_DAKOTA_RESULTS_URL,
    snippet:
      "Representative in Congress Republican — Precincts Fully: 358 / 358 — 82,075 Total Votes — Julie Fedorchak 72.76% (59,719 Votes), Alex Balazs 27.04% (22,196 Votes), Write Ins 0.19% (160 Votes). Representative in Congress Democratic-NPL — Precincts Fully: 358 / 358 — 34,673 Total Votes — Trygve Hammer 99.8% (34,604 Votes), Write Ins 0.2% (69 Votes).",
  },
};

// South Dakota's 35%-runoff rule (applies to congressional and gubernatorial
// primaries — a runoff would've been 2026-07-28) never came into play for
// either federal race: both Republican primaries were won outright (79.2%
// House, 75.8% Senate), well clear of the threshold. It DID trigger for the
// separate governor's race (Rhoden/Doeden runoff) — out of scope for this
// pipeline, but easy to confuse with the House race since Dusty Johnson (SD's
// sitting at-large Representative) ran for governor instead of re-election,
// which is what actually opened up the House seat. Confirmed via AP/NBC
// (sdsos.gov's own live results dashboard wasn't fetchable as a static page).
const SOUTH_DAKOTA_RESULTS_HOUSE_URL = "https://www.nbcnews.com/politics/2026-primary-elections/south-dakota-house-results";
const SOUTH_DAKOTA_RESULTS_SENATE_URL = "https://www.nbcnews.com/politics/2026-primary-elections/south-dakota-senate-results";
const SOUTH_DAKOTA_BENGS_CERTIFICATION_URL = "https://www.dakotanewsnow.com/2026/04/28/brian-bengs-appear-ballot-us-senate-november-3-general-election/";

const SOUTH_DAKOTA_2026_PRIMARY: Record<string, PrimaryResult> = {
  // Marty Jackley (R) won outright; Nicole Gronli (D) was uncontested. Jack
  // Pittman (FEC ID H6SD01166) filed as an independent and Ballotpedia lists
  // him as a general-election candidate, but — unlike Bengs below, whose
  // certification is a matter of public record — no South Dakota SOS
  // confirmation that his petition actually cleared the signature threshold
  // was found. Left out of advancingCandidateIds until that's confirmed;
  // revisit before this race is considered final.
  "house-AL": {
    advancingCandidateIds: ["H6SD01109", "H6SD01141"],
    source_url: SOUTH_DAKOTA_RESULTS_HOUSE_URL,
    snippet:
      "Republican South Dakota House District Results — District 1, 99% in — M. Jackley 79.2% (103,291 Votes), J. Bialota 20.8% (27,140 Votes). Democratic South Dakota House District Results — District 1 — N. Gronli — this race is uncontested.",
  },
  // Mike Rounds (R, incumbent) won outright; Julian Beaudion (D) was
  // uncontested. Brian Bengs separately cleared South Dakota's independent
  // petition-signature threshold (3,502 required; SOS confirmed 4,311
  // accepted signatures, 2026-04-28) — same "certified separately from the
  // primary" pattern as Montana's independents.
  senate: {
    advancingCandidateIds: ["S4SD00049", "S6SD01125", "S6SD01117"],
    source_url: SOUTH_DAKOTA_RESULTS_SENATE_URL,
    snippet:
      "Republicans — MIKE ROUNDS WINS THE SOUTH DAKOTA PRIMARY — Mike Rounds (Incumbent) 75.8% (101,472 Votes), Justin McNeal 24.2% (32,412 Votes). Democrats — JULIAN BEAUDION WINS THE SOUTH DAKOTA PRIMARY — this race is uncontested. Independent Brian Bengs doesn't run in a primary — separately certified per " +
      SOUTH_DAKOTA_BENGS_CERTIFICATION_URL +
      ': "South Dakota Secretary of State Monae L. Johnson announced that Brian Bengs qualified for the Nov. 3, 2026 U.S. Senate ballot as an independent after signatures were validated."',
  },
};

export function getPrimaryFilter(state: string, raceSlug: string, cycle: number): PrimaryResult | null {
  if (state === "MT" && cycle === 2026) return MONTANA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "ND" && cycle === 2026) return NORTH_DAKOTA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "SD" && cycle === 2026) return SOUTH_DAKOTA_2026_PRIMARY[raceSlug] ?? null;
  return null;
}
