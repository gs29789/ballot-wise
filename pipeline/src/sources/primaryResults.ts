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

export function getPrimaryFilter(state: string, raceSlug: string, cycle: number): PrimaryResult | null {
  if (state === "MT" && cycle === 2026) return MONTANA_2026_PRIMARY[raceSlug] ?? null;
  return null;
}
