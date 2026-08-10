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

// New York's 26 districts, each cross-checked individually against FEC:
// district+party+cycle=2026, then name. Seven districts (05, 06, 07, 08, 13,
// 15, 26) show a Republican primary "winner" per NBC/AP in a seat with no
// real contest — safe Democratic seats where the Republican line drew only
// token or no real campaign — but that same person has no 2026 candidate
// registration findable in FEC's system under any name/spelling in that
// district. Same as Montana's unopposed Libertarian with no FEC registration
// findable: they were never going to be in this pipeline's candidate list
// to begin with, independent of this filter, so advancingCandidateIds just
// omits them rather than forcing a guess. One near-miss caught in review:
// an early matching pass grabbed a same-surname candidate from a DIFFERENT
// district (Brandon Williams, NY-22, not running in 2026) for NY-13's
// "J. Williams" — district+cycle must both match before a name match counts,
// not name alone.
const NEW_YORK_RESULTS_URL = (district: number) =>
  `https://www.nbcnews.com/politics/2026-primary-elections/new-york-us-house-district-${district}-results`;

const NEW_YORK_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H2NY01190", "H6NY01159"],
    source_url: NEW_YORK_RESULTS_URL(1),
    snippet: "R: N. LaLota (incumbent) — uncontested. D: C. Gallant 62.9% over L. Ventouras 36.9%.",
  },
  "house-02": {
    advancingCandidateIds: ["H0NY02234", "H6NY02140"],
    source_url: NEW_YORK_RESULTS_URL(2),
    snippet: "R: A. Garbarino (incumbent) — uncontested. D: P. Halpin — uncontested.",
  },
  "house-03": {
    advancingCandidateIds: ["H0NY02267", "H6NY03247"],
    source_url: NEW_YORK_RESULTS_URL(3),
    snippet: "R: M. LiPetri 81.9% over G. Hach 17.2%. D: T. Suozzi 79.6% over D. Welch 20.1%.",
  },
  "house-04": {
    advancingCandidateIds: ["H6NY04211", "H2NY04244"],
    source_url: NEW_YORK_RESULTS_URL(4),
    snippet: "R: J. Driscoll 90.8% over M. Williams 8.9%. D: L. Gillen — uncontested.",
  },
  "house-05": {
    advancingCandidateIds: ["H8NY06048"],
    source_url: NEW_YORK_RESULTS_URL(5),
    snippet: "R: G. Marsh — uncontested (no FEC 2026 registration found; see code comment). D: G. Meeks (incumbent) — uncontested.",
  },
  "house-06": {
    advancingCandidateIds: ["H2NY06116"],
    source_url: NEW_YORK_RESULTS_URL(6),
    snippet: "R: J. Chou — uncontested (no FEC 2026 registration found; see code comment). D: G. Meng (incumbent) 56.8% over C. Park 42.9%.",
  },
  "house-07": {
    advancingCandidateIds: ["H6NY07214"],
    source_url: NEW_YORK_RESULTS_URL(7),
    snippet: "R: M. Rivera — uncontested (no FEC 2026 registration found; see code comment). D: C. Valdez 56.1% over A. Reynoso 35.8%, J. Won 6.3%.",
  },
  "house-08": {
    advancingCandidateIds: ["H2NY10092"],
    source_url: NEW_YORK_RESULTS_URL(8),
    snippet: "R: L. Mizrahi — uncontested (no FEC 2026 registration found; see code comment). D: H. Jeffries (incumbent) — uncontested.",
  },
  "house-09": {
    advancingCandidateIds: ["H6NY09145", "H4NY11138"],
    source_url: NEW_YORK_RESULTS_URL(9),
    snippet: "R: J. Azumah — uncontested. D: Y. Clarke (incumbent) 68.6% over M. Goldfarb 15.4%, J. Bristol 14.7%.",
  },
  "house-10": {
    advancingCandidateIds: ["H6NY10218", "H6NY10176"],
    source_url: NEW_YORK_RESULTS_URL(10),
    snippet: "R: J. Moore — uncontested. D: B. Lander 65.8% over D. Goldman 34.0%.",
  },
  "house-11": {
    advancingCandidateIds: ["H0NY11078", "H6NY11265"],
    source_url: NEW_YORK_RESULTS_URL(11),
    snippet: "R: N. Malliotakis (incumbent) — uncontested. D: M. DeCillis 61.0% over A. Ziogas 36.9%.",
  },
  "house-12": {
    advancingCandidateIds: ["H6NY12404", "H6NY12172"],
    source_url: NEW_YORK_RESULTS_URL(12),
    snippet: "R: C. Shinkle — uncontested. D: M. Lasher 39.1% over A. Bores 35.0%, J. Schlossberg 10.8% (open seat).",
  },
  "house-13": {
    advancingCandidateIds: ["H6NY13279"],
    source_url: NEW_YORK_RESULTS_URL(13),
    snippet: "R: J. Williams — uncontested (no FEC 2026 registration found; see code comment). D: D. Avila Chevalier 49.4% over incumbent A. Espaillat 45.9%, O. Romero Jr. 3.5%.",
  },
  "house-14": {
    advancingCandidateIds: ["H6NY14251", "H8NY15148"],
    source_url: NEW_YORK_RESULTS_URL(14),
    snippet: "R: D. Hysenaj — uncontested. D: A. Ocasio-Cortez (incumbent) 86.9% over F. Garcia 6.7%, M. Dolan 5.9%.",
  },
  "house-15": {
    advancingCandidateIds: ["H0NY15160"],
    source_url: NEW_YORK_RESULTS_URL(15),
    snippet: "R: S. Sapaskis — uncontested (no FEC 2026 registration found; see code comment). D: R. Torres (incumbent) 71.9% over M. Blake 21.8%, J. Vega 5.6%.",
  },
  "house-16": {
    advancingCandidateIds: ["H4NY07052", "H4NY16087"],
    source_url: NEW_YORK_RESULTS_URL(16),
    snippet: "R: J. Cinquemani — uncontested. D: G. Latimer (incumbent) — uncontested.",
  },
  "house-17": {
    advancingCandidateIds: ["H2NY17162", "H6NY17171"],
    source_url: NEW_YORK_RESULTS_URL(17),
    snippet: "R: M. Lawler (incumbent) — uncontested. D: C. Conley 49.5% over B. Davidson 31.8%, E. Phillips-Staley 15.3%.",
  },
  "house-18": {
    advancingCandidateIds: ["H6NY18252", "H8NY19223"],
    source_url: NEW_YORK_RESULTS_URL(18),
    snippet: "R: J. Auringer — uncontested. D: P. Ryan (incumbent) — uncontested.",
  },
  "house-19": {
    advancingCandidateIds: ["H6NY19268", "H8NY22177"],
    source_url: NEW_YORK_RESULTS_URL(19),
    snippet: "R: P. Oberacker 77.4% over A. Portelli 22.1%. D: J. Riley (incumbent) — uncontested.",
  },
  "house-20": {
    advancingCandidateIds: ["H6NY20225", "H8NY21203"],
    source_url: NEW_YORK_RESULTS_URL(20),
    snippet: "R: R. Ambrosio — uncontested. D: P. Tonko (incumbent) — uncontested.",
  },
  "house-21": {
    advancingCandidateIds: ["H6NY21157", "H6NY21199"],
    source_url: NEW_YORK_RESULTS_URL(21),
    snippet: "R: A. Constantino 59.2% over R. Smullen 40.2%. D: B. Gendebien 64.6% over S. Amoriell 34.9% (open seat).",
  },
  "house-22": {
    advancingCandidateIds: ["H6NY22213", "H4NY22085"],
    source_url: NEW_YORK_RESULTS_URL(22),
    snippet: "R: K. Buller — uncontested. D: J. Mannion (incumbent) — uncontested.",
  },
  "house-23": {
    advancingCandidateIds: ["H2NY23228", "H6NY23559"],
    source_url: NEW_YORK_RESULTS_URL(23),
    snippet: "R: N. Langworthy (incumbent) — uncontested. D: A. Gies 71.5% over K. Stocker 28.3%.",
  },
  "house-24": {
    advancingCandidateIds: ["H4NY22051", "H6NY24219"],
    source_url: NEW_YORK_RESULTS_URL(24),
    snippet: "R: C. Tenney (incumbent) — uncontested. D: A. Ellman 61.7% over D. Kastenbaum 38.1%.",
  },
  "house-25": {
    advancingCandidateIds: ["H6NY25208", "H8NY25105"],
    source_url: NEW_YORK_RESULTS_URL(25),
    snippet: "R: V. McIntyre — uncontested. D: J. Morelle (incumbent) 63.3% over R. Wilt 30.3%, S. Traywick 6.0%.",
  },
  "house-26": {
    advancingCandidateIds: ["H4NY26078"],
    source_url: NEW_YORK_RESULTS_URL(26),
    snippet: "R: D. Hannon — uncontested (no FEC 2026 registration found; see code comment). D: T. Kennedy (incumbent) — uncontested.",
  },
};

// Georgia's 2026 cycle has real vote percentages available only for two
// races (13, 14) — everything else here is confirmed against Ballotpedia's
// GENERAL election candidate list (who's actually the certified nominee
// heading into November) rather than primary-day vote totals, which weren't
// individually verified for the other 12 districts + Senate. That's still a
// fully sourced, checkable claim — just a different kind of claim than "won
// with N% of the vote" — so snippets say exactly that rather than
// overclaiming "uncontested" for races where that wasn't actually checked.
//
// Districts 13 and 14 both have a real incumbent vacancy layered under the
// regular 2026 cycle, easy to conflate with each other or with the special
// election:
// - GA-13: incumbent David Scott (D) died 2026-04-22, before the May 19
//   primary — an open seat for the regular cycle. Separately, a special
//   election (not covered by this pipeline — it fills the CURRENT unexpired
//   term, not the seat up in November) went to an Aug 25, 2026 runoff not
//   yet decided as of when this was built.
// - GA-14: incumbent Marjorie Taylor Greene resigned effective 2026-01-05.
//   Unlike GA-13, GA-14's special election WAS already fully resolved before
//   this was built (Clay Fuller won an April 7, 2026 runoff) — and Fuller
//   separately also won the regular cycle's Republican nomination, so he's
//   both the current officeholder AND the regular-cycle nominee. Two
//   different elections, same winner — don't assume that's always true.
const GEORGIA_RESULTS_URL = (district: string) => `https://ballotpedia.org/Georgia's_${district}_Congressional_District_election,_2026`;

const GEORGIA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H6GA01158", "H6GA01109"],
    source_url: GEORGIA_RESULTS_URL("1st"),
    snippet: "James Kingston (R) and Amanda Hollowell (D) are running in the general election for U.S. House Georgia District 1 on November 3, 2026 — confirmed party nominees post-primary/runoff.",
  },
  "house-02": {
    advancingCandidateIds: ["H2GA02031", "H6GA01182"],
    source_url: GEORGIA_RESULTS_URL("2nd"),
    snippet: "Incumbent Sanford Bishop Jr. (D) and Matt Day (R) are running in the general election for U.S. House Georgia District 2 on November 3, 2026 — confirmed party nominees post-primary/runoff.",
  },
  "house-03": {
    advancingCandidateIds: ["H4GA03126", "H4GA03100"],
    source_url: GEORGIA_RESULTS_URL("3rd"),
    snippet: "Incumbent Brian Jack (R) and Maura Keller (D) are running in the general election for U.S. House Georgia District 3 on November 3, 2026 — confirmed party nominees post-primary/runoff.",
  },
  "house-04": {
    advancingCandidateIds: ["H6GA04129", "H6GA04194"],
    source_url: GEORGIA_RESULTS_URL("4th"),
    snippet: "Incumbent Hank Johnson (D) and James Duffie (R) are running in the general election for U.S. House Georgia District 4 on November 3, 2026 — confirmed party nominees post-primary/runoff.",
  },
  "house-05": {
    advancingCandidateIds: ["H0GA05301"],
    source_url: GEORGIA_RESULTS_URL("5th"),
    snippet: "Incumbent Nikema Williams (D) and John Salvesen (R) are running in the general election for U.S. House Georgia District 5 on November 3, 2026 — confirmed party nominees post-primary/runoff. Salvesen has no FEC 2026 registration found; see code comment.",
  },
  "house-06": {
    advancingCandidateIds: ["H8GA06393", "H6GA06181"],
    source_url: GEORGIA_RESULTS_URL("6th"),
    snippet: "Incumbent Lucy McBath (D) and Kevin Martin (R) are running in the general election for U.S. House Georgia District 6 on November 3, 2026 — confirmed party nominees post-primary/runoff.",
  },
  "house-07": {
    advancingCandidateIds: ["H0GA07273", "H6GA07221"],
    source_url: GEORGIA_RESULTS_URL("7th"),
    snippet: "Incumbent Rich McCormick (R) and Tony Kozycki (D) are running in the general election for U.S. House Georgia District 7 on November 3, 2026 — confirmed party nominees post-primary/runoff.",
  },
  "house-08": {
    advancingCandidateIds: ["H0GA08099", "H6GA08138"],
    source_url: GEORGIA_RESULTS_URL("8th"),
    snippet: "Incumbent Austin Scott (R) and Kelly Esti (D) are running in the general election for U.S. House Georgia District 8 on November 3, 2026 — confirmed party nominees post-primary/runoff.",
  },
  "house-09": {
    advancingCandidateIds: ["H0GA09246", "H6GA09284"],
    source_url: GEORGIA_RESULTS_URL("9th"),
    snippet: "Incumbent Andrew Clyde (R) and Caitlyn Gegen (D) are running in the general election for U.S. House Georgia District 9 on November 3, 2026 — confirmed party nominees post-primary/runoff.",
  },
  "house-10": {
    advancingCandidateIds: ["H6GA10183", "H6GA10175"],
    source_url: GEORGIA_RESULTS_URL("10th"),
    snippet: "Pamela DeLancy (D) and Houston Gaines (R) are running in the general election for U.S. House Georgia District 10 on November 3, 2026 — confirmed party nominees post-primary/runoff, open seat.",
  },
  "house-11": {
    advancingCandidateIds: ["H6GA11116", "H0GA14048"],
    source_url: GEORGIA_RESULTS_URL("11th"),
    snippet: "Chris Harden (D) and John Cowan (R) are running in the general election for U.S. House Georgia District 11 on November 3, 2026 — confirmed party nominees post-primary/runoff, open seat.",
  },
  "house-12": {
    advancingCandidateIds: ["H2GA12121", "H6GA12080"],
    source_url: GEORGIA_RESULTS_URL("12th"),
    snippet: "Incumbent Rick Allen (R) and Ceretta Smith (D) are running in the general election for U.S. House Georgia District 12 on November 3, 2026 — confirmed party nominees post-primary/runoff.",
  },
  "house-13": {
    advancingCandidateIds: ["H6GA13070", "H2GA04201"],
    source_url: GEORGIA_RESULTS_URL("13th"),
    snippet: "Jasmine Clark won the Democratic primary for U.S. House Georgia District 13 on May 19, 2026 with 56% of the vote, without a runoff. Incumbent David Scott died April 22, 2026, before the primary — this is an open seat for the regular 2026 cycle, separate from the special election held to fill his unexpired term. Clark faces Jonathan Chavez (R) in November.",
  },
  "house-14": {
    advancingCandidateIds: ["H0GA14030", "H4GA14057"],
    source_url: GEORGIA_RESULTS_URL("14th"),
    snippet: "Shawn Harris advanced from the Democratic primary for U.S. House Georgia District 14 on May 19, 2026 with 100.0% (no runoff needed, no incumbents in that primary). Incumbent Clay Fuller (R) — who separately also won the special election for Marjorie Taylor Greene's unexpired term — is the confirmed Republican nominee for the regular 2026 cycle per Ballotpedia's general-election candidate list.",
  },
  senate: {
    advancingCandidateIds: ["S8GA00180", "S6GA00390"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Georgia,_2026",
    snippet: "Jon Ossoff (D, incumbent) and Mike Collins (R) are running in the general election for U.S. Senate Georgia on November 3, 2026. Libertarian Allen Buckley is also on the ballot but has no FEC 2026 registration found; see code comment.",
  },
};

export function getPrimaryFilter(state: string, raceSlug: string, cycle: number): PrimaryResult | null {
  if (state === "MT" && cycle === 2026) return MONTANA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "ND" && cycle === 2026) return NORTH_DAKOTA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "SD" && cycle === 2026) return SOUTH_DAKOTA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "NY" && cycle === 2026) return NEW_YORK_2026_PRIMARY[raceSlug] ?? null;
  if (state === "GA" && cycle === 2026) return GEORGIA_2026_PRIMARY[raceSlug] ?? null;
  return null;
}
