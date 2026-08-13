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

// Vermont's primary was 2026-08-11; this entry was added 2026-08-13, over a
// day late — the mechanism existed from day one (Vermont was one of the
// original three at-large pilot states) but narrowing was never actually
// applied for it, a real tracked gap (see [[ballotwise-primary-results-gap]]
// memory). Confirmed via a direct Ballotpedia check against the unfiltered
// build output: Mark Coester (R) lost the primary to Gerald Malloy but still
// held a live FEC registration; a second stray registration ("CARLSON, OWEN
// NICHOLAS", no party) doesn't match anyone on Ballotpedia's actual
// candidate list at all and was excluded the same way as Hawaii's Gelt.
// Andrew Giusto is included despite being Ballotpedia's officially-listed
// write-in candidate — he's still in the "General election" candidate table
// they publish, not excluded from it.
const VERMONT_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-AL": {
    advancingCandidateIds: ["H2VT01076", "H6VT01085", "H6VT00269", "H6VT01093", "H6VT01051"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_election_in_Vermont,_2026",
    snippet:
      "The following candidates are running in the general election for U.S. House Vermont At-large District on November 3, 2026. Becca Balint (D) Gerald Malloy (R) Adam Ortiz (Independent) Suzanne Seymour (Independent) Ryan Walton (Independent) Andrew Giusto (Unity Party) (Write-in).",
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

// Pennsylvania's primary (May 19, 2026, same day as Georgia's) was already
// certified before this pipeline covered the state, so — like MT/ND/SD/NY/GA
// — narrowing is needed immediately rather than deferred. No mid-term
// vacancy complexity here (PA-3's open seat is a normal announced retirement,
// Dwight Evans on 2025-06-30, not a death/resignation with a parallel
// special election like Georgia's 13th/14th). No Senate race this cycle
// either (Fetterman up 2028, McCormick up 2030).
const PENNSYLVANIA_RESULTS_URL = (district: string) => `https://ballotpedia.org/Pennsylvania's_${district}_Congressional_District_election,_2026`;

const PENNSYLVANIA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H6PA08277", "H6PA01181", "H6PA01264", "H6PA01215"],
    source_url: PENNSYLVANIA_RESULTS_URL("1st"),
    snippet: "Incumbent Brian Fitzpatrick, Bob Harvie, Jamie Frost Remmey, and John Hoban are running in the general election for U.S. House Pennsylvania District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H4PA13199", "H6PA02205"],
    source_url: PENNSYLVANIA_RESULTS_URL("2nd"),
    snippet: "Incumbent Brendan Boyle and Jessica Arriaga are running in the general election for U.S. House Pennsylvania District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H6PA03203", "H6PA03369"],
    source_url: PENNSYLVANIA_RESULTS_URL("3rd"),
    snippet: "Christopher Rabb and Dennis Mahoney are running in the general election for U.S. House Pennsylvania District 3 on November 3, 2026. Open seat: incumbent Dwight Evans announced June 30, 2025 that he would not seek re-election.",
  },
  "house-04": {
    advancingCandidateIds: ["H8PA04116", "H6PA04169"],
    source_url: PENNSYLVANIA_RESULTS_URL("4th"),
    snippet: "Incumbent Madeleine Dean and Aurora Stuski are running in the general election for U.S. House Pennsylvania District 4 on November 3, 2026.",
  },
  "house-05": {
    advancingCandidateIds: ["H8PA07200", "H6PA05216"],
    source_url: PENNSYLVANIA_RESULTS_URL("5th"),
    snippet: "Incumbent Mary Gay Scanlon and Nick Manganaro are running in the general election for U.S. House Pennsylvania District 5 on November 3, 2026.",
  },
  "house-06": {
    advancingCandidateIds: ["H8PA06087", "H6PA06156"],
    source_url: PENNSYLVANIA_RESULTS_URL("6th"),
    snippet: "Incumbent Chrissy Houlahan and Marty Young are running in the general election for U.S. House Pennsylvania District 6 on November 3, 2026.",
  },
  "house-07": {
    advancingCandidateIds: ["H8PA15195", "H6PA07188", "H6PA07212", "H6PA07204"],
    source_url: PENNSYLVANIA_RESULTS_URL("7th"),
    snippet: "Incumbent Ryan Mackenzie, Bob Brooks, Andrew Tupone, Frank Golden, and Ramon Granados are running in the general election for U.S. House Pennsylvania District 7 on November 3, 2026. Tupone (Green Party) has no FEC 2026 registration found; see code comment.",
  },
  "house-08": {
    advancingCandidateIds: ["H4PA08124", "H6PA08293"],
    source_url: PENNSYLVANIA_RESULTS_URL("8th"),
    snippet: "Incumbent Rob Bresnahan Jr. and Paige Cognetti are running in the general election for U.S. House Pennsylvania District 8 on November 3, 2026.",
  },
  "house-09": {
    advancingCandidateIds: ["H8PA10147", "H6PA09127"],
    source_url: PENNSYLVANIA_RESULTS_URL("9th"),
    snippet: "Incumbent Dan Meuser and Rachel Wallace are running in the general election for U.S. House Pennsylvania District 9 on November 3, 2026.",
  },
  "house-10": {
    advancingCandidateIds: ["H2PA04135", "H4PA10104", "H6PA10174"],
    source_url: PENNSYLVANIA_RESULTS_URL("10th"),
    snippet: "Incumbent Scott Perry, Janelle Stelson, and Isabelle Harman are running in the general election for U.S. House Pennsylvania District 10 on November 3, 2026.",
  },
  "house-11": {
    advancingCandidateIds: ["H6PA16320", "H6PA11099", "H4PA11060"],
    source_url: PENNSYLVANIA_RESULTS_URL("11th"),
    snippet: "Incumbent Lloyd Smucker, Nancy Mannion, and Jeffrey Wilder are running in the general election for U.S. House Pennsylvania District 11 on November 3, 2026.",
  },
  "house-12": {
    advancingCandidateIds: ["H2PA18200", "H4PA12068"],
    source_url: PENNSYLVANIA_RESULTS_URL("12th"),
    snippet: "Incumbent Summer Lee and James Hayes are running in the general election for U.S. House Pennsylvania District 12 on November 3, 2026.",
  },
  "house-13": {
    advancingCandidateIds: ["H8PA13125", "H4PA13298"],
    source_url: PENNSYLVANIA_RESULTS_URL("13th"),
    snippet: "Incumbent John Joyce and Beth Farnham are running in the general election for U.S. House Pennsylvania District 13 on November 3, 2026.",
  },
  "house-14": {
    advancingCandidateIds: ["H8PA18199", "H6PA14200", "H4PA14114"],
    source_url: PENNSYLVANIA_RESULTS_URL("14th"),
    snippet: "Incumbent Guy Reschenthaler, Alan Bradstock, and Adam Halfhill are running in the general election for U.S. House Pennsylvania District 14 on November 3, 2026.",
  },
  "house-15": {
    advancingCandidateIds: ["H8PA05071", "H6PA15181"],
    source_url: PENNSYLVANIA_RESULTS_URL("15th"),
    snippet: "Incumbent Glenn Thompson and Ray Bilger are running in the general election for U.S. House Pennsylvania District 15 on November 3, 2026.",
  },
  "house-16": {
    advancingCandidateIds: ["H0PA03271", "H6PA16379", "H6PA16361"],
    source_url: PENNSYLVANIA_RESULTS_URL("16th"),
    snippet: "Incumbent Mike Kelly, Justin Wagner, and Nick Singelis are running in the general election for U.S. House Pennsylvania District 16 on November 3, 2026.",
  },
  "house-17": {
    advancingCandidateIds: ["H2PA17103", "H6PA17203"],
    source_url: PENNSYLVANIA_RESULTS_URL("17th"),
    snippet: "Incumbent Chris Deluzio and Tony Guy are running in the general election for U.S. House Pennsylvania District 17 on November 3, 2026.",
  },
};

// Michigan's primary (August 4, 2026) was already certified before this
// pipeline covered the state, so narrowing is needed immediately, same as
// MT/ND/SD/NY/GA/PA. Three open seats, all with ordinary explanations —
// no death/resignation vacancy, no parallel special election like Georgia's:
// MI-10 (incumbent John James running for Governor instead), MI-11
// (incumbent Haley Stevens ran for U.S. Senate instead, lost that primary),
// MI-13 (incumbent Shri Thanedar lost his OWN primary to Donavan McKinney —
// worth remembering FEC's candidate list still carries primary losers
// indefinitely, same as Montana's Zinke; don't let a defeated incumbent's
// FEC registration get pulled in just because candidate_status is still
// active). District 11 also has a real same-surname trap: FEC has both
// "BAKER, ETHAN D" (R, the actual Ballotpedia general-election candidate)
// and "BAKER, STU" (D, a primary candidate who lost — incumbent_challenge
// "Open seat" but a different person) — only Ethan's ID is included here.
// District 13's "Shelby Campbell" is deliberately EXCLUDED despite two FEC
// records matching her name: both are Democratic Party, but Ballotpedia
// lists her as Independent for the general election — a real mismatch, not
// just a formatting quirk, so this isn't confidently the same person and
// forcing either ID in would risk misattributing someone else's filing.
const MICHIGAN_RESULTS_URL = (district: string) => `https://ballotpedia.org/Michigan's_${district}_Congressional_District_election,_2026`;

const MICHIGAN_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H6MI01226", "H4MI01155", "H6MI01283", "H6MI01275"],
    source_url: MICHIGAN_RESULTS_URL("1st"),
    snippet: "Jack Bergman (R), Callie Barr (D), LaVeta Davenport (G), Arnett Satterla (L), Doc Kovaly (U.S. Taxpayers Party), Liz Hakola (Working Class Party), and Zebulon Featherly (Independent) are running in the general election for U.S. House Michigan District 1 on November 3, 2026. Davenport, Kovaly, and Hakola have no FEC 2026 registration found; see code comment.",
  },
  "house-02": {
    advancingCandidateIds: ["H4MI04126", "H6MI02216"],
    source_url: MICHIGAN_RESULTS_URL("2nd"),
    snippet: "Incumbent John Moolenaar, Ben Ambrose, and Charlotte Magoon are running in the general election for U.S. House Michigan District 2 on November 3, 2026. Magoon has no FEC 2026 registration found; see code comment.",
  },
  "house-03": {
    advancingCandidateIds: ["H0MI03316", "H6MI03198"],
    source_url: MICHIGAN_RESULTS_URL("3rd"),
    snippet: "Incumbent Hillary Scholten, Terri DeBoer, and Joe Jock are running in the general election for U.S. House Michigan District 3 on November 3, 2026. Jock has no FEC 2026 registration found; see code comment.",
  },
  "house-04": {
    advancingCandidateIds: ["H0MI02094", "H6MI04204"],
    source_url: MICHIGAN_RESULTS_URL("4th"),
    snippet: "Incumbent Bill Huizenga, Sean McCann, and Shafina Barnett are running in the general election for U.S. House Michigan District 4 on November 3, 2026. Barnett has no FEC 2026 registration found; see code comment.",
  },
  "house-05": {
    advancingCandidateIds: ["H4MI07103", "H6MI05227", "H6MI05235"],
    source_url: MICHIGAN_RESULTS_URL("5th"),
    snippet: "Incumbent Tim Walberg, Christian Vukasovich, James Bronke, Ronald Muszynski, and Sharon Renier are running in the general election for U.S. House Michigan District 5 on November 3, 2026. Bronke and Renier have no FEC 2026 registration found; see code comment.",
  },
  "house-06": {
    advancingCandidateIds: ["H4MI12079", "H4MI06154"],
    source_url: MICHIGAN_RESULTS_URL("6th"),
    snippet: "Debbie Dingell, Heather Smiley, Clyde Shabazz, Tim Teagan, Michael Mickevicius, and Linda Rayburn are running in the general election for U.S. House Michigan District 6 on November 3, 2026 (incumbent Dingell). Shabazz, Teagan, Mickevicius, and Rayburn have no FEC 2026 registration found; see code comment.",
  },
  "house-07": {
    advancingCandidateIds: ["H2MI07123", "H6MI07298"],
    source_url: MICHIGAN_RESULTS_URL("7th"),
    snippet: "Incumbent Tom Barrett, William Lawrence, Shane Dedrick, and Felix Thibodeau are running in the general election for U.S. House Michigan District 7 on November 3, 2026. Dedrick and Thibodeau have no FEC 2026 registration found; see code comment.",
  },
  "house-08": {
    advancingCandidateIds: ["H4MI08218", "H6MI08312"],
    source_url: MICHIGAN_RESULTS_URL("8th"),
    snippet: "Incumbent Kristen McDonald Rivet, Thomas J. Smith, Jim Casha, C. Mia Pettus, and Kathy Goodwin are running in the general election for U.S. House Michigan District 8 on November 3, 2026. Casha, Pettus, and Goodwin have no FEC 2026 registration found; see code comment.",
  },
  "house-09": {
    advancingCandidateIds: ["H0MI10287", "H6MI09245", "H6MI09211", "H6MI09252"],
    source_url: MICHIGAN_RESULTS_URL("9th"),
    snippet: "Lisa McClain, Ray Pooley, Destiny Clayton, Kevin Vayko, John Vlahos, Jim Walkowicz, Jasen Cartwright, and Fernando Valdez are running in the general election for U.S. House Michigan District 9 on November 3, 2026 (incumbent McClain). Clayton, Vayko, Vlahos, and Walkowicz have no FEC 2026 registration found; see code comment.",
  },
  "house-10": {
    advancingCandidateIds: ["H6MI10276", "H6MI10359"],
    source_url: MICHIGAN_RESULTS_URL("10th"),
    snippet: "Christina Hines, Michael Bouchard, Kwabena Nkromo, Mike Saliba, and Andrea Kirby are running in the general election for U.S. House Michigan District 10 on November 3, 2026. Open seat: incumbent John James is running for Governor of Michigan instead. Nkromo, Saliba, and Kirby have no FEC 2026 registration found; see code comment.",
  },
  "house-11": {
    advancingCandidateIds: ["H6MI11191", "H6MI11290", "H4MI10131"],
    source_url: MICHIGAN_RESULTS_URL("11th"),
    snippet: "Jeremy Moss, Ethan Baker, Ryan Teasdale, and Anil Kumar are running in the general election for U.S. House Michigan District 11 on November 3, 2026. Open seat: incumbent Haley Stevens ran for U.S. Senate instead (lost the Democratic primary to Abdul El-Sayed). Teasdale has no FEC 2026 registration found; see code comment.",
  },
  "house-12": {
    advancingCandidateIds: ["H8MI13250", "H2MI12198"],
    source_url: MICHIGAN_RESULTS_URL("12th"),
    snippet: "Incumbent Rashida Tlaib, James Hooper, Brenda Sanders, Marc Joseph Sosnowski, and Gary Walkowicz are running in the general election for U.S. House Michigan District 12 on November 3, 2026. Sanders, Sosnowski, and Walkowicz have no FEC 2026 registration found; see code comment.",
  },
  "house-13": {
    advancingCandidateIds: ["H6MI13254", "H6MI13312", "H2MI13337", "H4MI14166"],
    source_url: MICHIGAN_RESULTS_URL("13th"),
    snippet: "Donavan McKinney, Taras Nykoriak, Christopher Dardzinski, Simone Coleman, Shelby Campbell, and Maurice Morton are running in the general election for U.S. House Michigan District 13 on November 3, 2026. Open seat: incumbent Shri Thanedar lost the Democratic primary to McKinney by about 4 points. Coleman has no FEC 2026 registration found; Campbell's only FEC matches (Democratic Party, not Independent as Ballotpedia lists her) don't confidently identify the same person, so she's excluded rather than force an uncertain match; see code comment.",
  },
  senate: {
    advancingCandidateIds: ["S6MI00418", "S4MI00595"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Michigan,_2026",
    snippet: "Abdul El-Sayed (D) won the Democratic primary for U.S. Senate Michigan on August 4, 2026 over Rep. Haley Stevens, and faces Mike Rogers (R, unopposed for the Republican nomination) in the general election on November 3, 2026 for the open seat — incumbent Gary Peters (D) announced in January 2025 that he would not seek re-election.",
  },
};

// Arizona's primary (moved up to July 21, 2026 by HB 2022 — see
// electionDates.ts) was already certified before this pipeline covered the
// state. No Senate race this cycle. AZ-07's incumbent Adelita Grijalva is
// NOT a vacancy trap despite the shape looking similar to Georgia's: her
// father, longtime AZ-07 Rep. Raúl Grijalva (D), died in office in March
// 2025, and a special election to fill the seat was held and fully resolved
// September 23, 2025 — well before this state was added. She is simply the
// regular incumbent now; there is no PARALLEL 2026 special election to
// confuse with the regular-cycle race (contrast Georgia's GA-13, where the
// special election was still unresolved at build time). FEC still carries a
// stale record for her late father (H2AZ07070, 2026 in election_years) —
// not used. AZ-01 and AZ-05 are both open because their Republican
// incumbents (Schweikert and Biggs) ran for Governor instead of re-election.
const ARIZONA_RESULTS_URL = (district: string) => `https://ballotpedia.org/Arizona's_${district}_Congressional_District_election,_2026`;

const ARIZONA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H4AZ01194", "H6AZ05190", "H6AZ01488"],
    source_url: ARIZONA_RESULTS_URL("1st"),
    snippet: "Amish Shah (D), Jay Feely (R), and Monica Alponte (L) are running in the general election for Arizona's 1st Congressional District on November 3, 2026. Open seat: incumbent David Schweikert (R) ran for Governor of Arizona instead of re-election.",
  },
  "house-02": {
    advancingCandidateIds: ["H2AZ01354", "H4AZ02184"],
    source_url: ARIZONA_RESULTS_URL("2nd"),
    snippet: "Incumbent Eli Crane, Jonathan Nez, and Curtis Goodwin are running in the general election for U.S. House Arizona District 2 on November 3, 2026. Goodwin (L) has no FEC 2026 registration found; see code comment.",
  },
  "house-03": {
    advancingCandidateIds: ["H4AZ03109", "H6AZ01322"],
    source_url: ARIZONA_RESULTS_URL("3rd"),
    snippet: "Incumbent Yassamin Ansari, David Redkey, Alan Aversa, and Jacob Parkman are running in the general election for U.S. House Arizona District 3 on November 3, 2026. Aversa's only FEC match has a mismatched party code (American Independent Party, not the No Labels Party Ballotpedia lists him under) so it's excluded rather than force-matched; Parkman (R write-in) has no FEC 2026 registration found; see code comment.",
  },
  "house-04": {
    advancingCandidateIds: ["H8AZ09040", "H4AZ04115"],
    source_url: ARIZONA_RESULTS_URL("4th"),
    snippet: "Incumbent Greg Stanton, Zuhdi Jasser, and Tisha Benoit are running in the general election for U.S. House Arizona District 4 on November 3, 2026. Benoit (No Labels Party) has no FEC 2026 registration found; see code comment.",
  },
  "house-05": {
    advancingCandidateIds: ["H6AZ05240", "H6AZ05265"],
    source_url: ARIZONA_RESULTS_URL("5th"),
    snippet: "Elizabeth Lee and Mark Lamb are running in the general election for U.S. House Arizona District 5 on November 3, 2026. Open seat: incumbent Andy Biggs (R) won the Republican gubernatorial nomination July 21, 2026 rather than seeking re-election.",
  },
  "house-06": {
    advancingCandidateIds: ["H2AZ02360", "H6AZ06099", "H6AZ06164", "H6AZ06214"],
    source_url: ARIZONA_RESULTS_URL("6th"),
    snippet: "Incumbent Juan Ciscomani, JoAnna Mendoza, Gary Swing, and Jereme Peters are running in the general election for U.S. House Arizona District 6 on November 3, 2026.",
  },
  "house-07": {
    advancingCandidateIds: ["H6AZ07121", "H4AZ07134"],
    source_url: ARIZONA_RESULTS_URL("7th"),
    snippet: "Incumbent Adelita Grijalva and Daniel Butierez Sr. are running in the general election for U.S. House Arizona District 7 on November 3, 2026. Grijalva won a September 23, 2025 special election to succeed her late father, longtime Rep. Raúl Grijalva (D), who died in office in March 2025 — she is the regular incumbent for the 2026 cycle, not a parallel special-election candidate; see code comment.",
  },
  "house-08": {
    advancingCandidateIds: ["H4AZ08108", "H4AZ08082"],
    source_url: ARIZONA_RESULTS_URL("8th"),
    snippet: "Incumbent Abraham Hamadeh and Bernadette Greene Placentia are running in the general election for U.S. House Arizona District 8 on November 3, 2026.",
  },
  "house-09": {
    advancingCandidateIds: ["H0AZ01259", "H6AZ09085"],
    source_url: ARIZONA_RESULTS_URL("9th"),
    snippet: "Incumbent Paul Gosar and Danielle Sterbinsky are running in the general election for U.S. House Arizona District 9 on November 3, 2026.",
  },
};

// Kentucky's primary (May 19, 2026) was already certified before this
// pipeline covered the state. Two open seats, both ordinary primary-loss/
// ran-for-other-office patterns, no vacancy: KY-4 (incumbent Thomas Massie
// lost his own primary to Ed Gallrein) and KY-6 (incumbent Andy Barr ran for
// the open Senate seat instead — McConnell retiring — and won that primary).
// KY-6's Jay Bowman is a confirmed second case of FEC's reversed-name quirk
// (first seen on NY-1's LaLota) — his record reads "JAY, BOWMAN J" instead
// of "BOWMAN, JAY J"; corrected via REVERSED_FEC_NAMES in fec.ts.
const KENTUCKY_RESULTS_URL = (district: string) => `https://ballotpedia.org/Kentucky's_${district}_Congressional_District_election,_2026`;

const KENTUCKY_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H6KY01110", "H6KY01169"],
    source_url: KENTUCKY_RESULTS_URL("1st"),
    snippet: "Incumbent James Comer Jr. and Drew Williams are running in the general election for U.S. House Kentucky District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H8KY02031", "H6KY02068"],
    source_url: KENTUCKY_RESULTS_URL("2nd"),
    snippet: "Incumbent Brett Guthrie, Megan Wingfield, and Thomas Loecken are running in the general election for U.S. House Kentucky District 2 on November 3, 2026. Loecken has no FEC 2026 registration found; see code comment.",
  },
  "house-03": {
    advancingCandidateIds: ["H2KY03206", "H6KY03223"],
    source_url: KENTUCKY_RESULTS_URL("3rd"),
    snippet: "Incumbent Morgan McGarvey and Maria Teresa Rodriguez are running in the general election for U.S. House Kentucky District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H6KY04189", "H6KY04171", "H6KY04205"],
    source_url: KENTUCKY_RESULTS_URL("4th"),
    snippet: "Melissa Strange, Ed Gallrein, and Jeremy Todd are running in the general election for U.S. House Kentucky District 4 on November 3, 2026. Open seat: incumbent Thomas Massie lost the Republican primary to Gallrein, 45.1% to 54.9%.",
  },
  "house-05": {
    advancingCandidateIds: ["H0KY05015", "H6KY05152", "H2KY05185", "H6KY05202", "H2KY05136"],
    source_url: KENTUCKY_RESULTS_URL("5th"),
    snippet: "Incumbent Hal Rogers, Ned Pillersdorf, Gerardo Serrano, Mikel Wein, and Billy Ray Wilson are running in the general election for U.S. House Kentucky District 5 on November 3, 2026.",
  },
  "house-06": {
    advancingCandidateIds: ["H6KY06184", "H6KY06192", "H6KY06242", "H6KY06234", "H6KY06283"],
    source_url: KENTUCKY_RESULTS_URL("6th"),
    snippet: "Zach Dembo, Ralph Alvarado, Pete Lynch, Jay Bowman, and Robert Quigley are running in the general election for U.S. House Kentucky District 6 on November 3, 2026. Open seat: incumbent Andy Barr ran for the open U.S. Senate seat instead (Mitch McConnell retiring) and won that Republican primary.",
  },
  senate: {
    advancingCandidateIds: ["S6KY00385", "S6KY00286", "S6KY00377"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Kentucky,_2026",
    snippet: "Charles Booker, Andy Barr, Christopher Campbell, and Thomas Murphy are running in the general election for U.S. Senate Kentucky on November 3, 2026. Incumbent Mitch McConnell (R) announced February 20, 2025 that he would not seek re-election. Murphy has no FEC 2026 registration found; see code comment.",
  },
};

// Colorado's primary (June 30, 2026) was already certified. One open seat,
// an ordinary primary-loss pattern: CO-1's incumbent Diana DeGette lost
// renomination to Melat Kiros. CO-4's Lauren Boebert is a confirmed case of
// an FEC candidate_id prefix (CO03) surviving a DISTRICT MOVE — she actually
// switched from CO-3 to CO-4 between cycles, not just a redistricting
// renumbering — but the record's own `district` field correctly reads 04.
// CO-5's Matt Cavanaugh is excluded for the same party-mismatch reason as
// Michigan's Campbell and Arizona's Aversa (his only FEC match is
// Democratic; Ballotpedia lists him Independent).
const COLORADO_RESULTS_URL = (district: string) => `https://ballotpedia.org/Colorado's_${district}_Congressional_District_election,_2026`;

const COLORADO_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H6CO01273", "H6CO01331", "H6CO01356"],
    source_url: COLORADO_RESULTS_URL("1st"),
    snippet: "Melat Kiros, Christy Peterson, Chad Humphrey, Shimon Blau, and Critter Milton are running in the general election for U.S. House Colorado District 1 on November 3, 2026. Open seat: incumbent Diana DeGette lost the Democratic primary to Kiros. Humphrey and Milton have no FEC 2026 registration found; see code comment.",
  },
  "house-02": {
    advancingCandidateIds: ["H8CO02160", "H6CO02206"],
    source_url: COLORADO_RESULTS_URL("2nd"),
    snippet: "Incumbent Joe Neguse and Kelley Dennison are running in the general election for U.S. House Colorado District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H4CO03357", "H6CO03253", "H6CO03246"],
    source_url: COLORADO_RESULTS_URL("3rd"),
    snippet: "Incumbent Jeff Hurd, Dwayne Romero, Heather Barton, and Clifton Brown are running in the general election for U.S. House Colorado District 3 on November 3, 2026. Brown has no FEC 2026 registration found; see code comment.",
  },
  "house-04": {
    advancingCandidateIds: ["H0CO03165", "H6CO04202", "H4CO04215", "H6CO04210", "H6CO04251"],
    source_url: COLORADO_RESULTS_URL("4th"),
    snippet: "Incumbent Lauren Boebert, Eileen Laubacher, Douglas Mangeris, Wayne Thornton, and Tim Veldhuizen are running in the general election for U.S. House Colorado District 4 on November 3, 2026.",
  },
  "house-05": {
    advancingCandidateIds: ["H6CO05142", "H6CO05324", "H4CO05071", "H6CO05365", "H6CO05282"],
    source_url: COLORADO_RESULTS_URL("5th"),
    snippet: "Incumbent Jeff Crank (R), Jessica Killin (D), and four other candidates are running in the general election for Colorado's 5th Congressional District on November 3, 2026. Matt Cavanaugh's only FEC match has a mismatched party (Democratic, not Independent as Ballotpedia lists him) so it's excluded rather than force-matched; see code comment.",
  },
  "house-06": {
    advancingCandidateIds: ["H8CO06229", "H6CO06165", "H6CO06132", "H6CO06116"],
    source_url: COLORADO_RESULTS_URL("6th"),
    snippet: "Incumbent Jason Crow, Jason Ray Clark, Patty McMahon, Edwardo Quinonez, Samir Witta, and Meredith Ryan are running in the general election for U.S. House Colorado District 6 on November 3, 2026. McMahon and Ryan have no FEC 2026 registration found; see code comment.",
  },
  "house-07": {
    advancingCandidateIds: ["H8CO07045", "H6CO07122", "H6CO07130"],
    source_url: COLORADO_RESULTS_URL("7th"),
    snippet: "Incumbent Brittany Pettersen, Timothy Bennett, Susan Hall, and Joe Krzeczkowski are running in the general election for U.S. House Colorado District 7 on November 3, 2026. Hall has no FEC 2026 registration found; see code comment.",
  },
  "house-08": {
    advancingCandidateIds: ["H4CO08034", "H6CO08013"],
    source_url: COLORADO_RESULTS_URL("8th"),
    snippet: "Incumbent Gabe Evans (R) and Manny Rutinel (D) are running in the general election for Colorado's 8th Congressional District on November 3, 2026.",
  },
  senate: {
    advancingCandidateIds: ["S0CO00575", "S6CO00507", "S6CO00549", "S4CO00452", "S6CO00390", "S6CO00564", "S6CO00432"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Colorado,_2026",
    snippet: "Incumbent John Hickenlooper (D), Mark Baisley (R), and five other candidates are running in the general election for U.S. Senate Colorado on November 3, 2026. Robert Wolfe's only FEC match is a stale 2024-cycle registration; see code comment.",
  },
};

// Illinois' primary (March 17, 2026) was already certified. Three open
// seats, all ordinary retirements (IL-04 Garcia, IL-07 Davis, IL-09
// Schakowsky) plus two more (IL-02 Kelly, IL-08 Krishnamoorthi) from
// incumbents who ran for the open Senate seat and both lost that primary to
// Juliana Stratton — five open seats total, all explainable, no vacancy
// complexity. IL-04 has a live, unresolved wrinkle: two independents
// (Mayra Macías, Byron Sigcho-Lopez) were removed from the ballot in July
// 2026 for insufficient signatures; Sigcho-Lopez's federal lawsuit
// challenging that removal was still pending as of early August 2026 (not
// resolved either way) — re-verify before a future rebuild in case a court
// ruling changes IL-04's field. Four more confirmed cases of FEC candidate
// IDs carrying OLD pre-2020-redistricting district-number prefixes that
// don't match the current, authoritative `district` field: Foster (IL14→
// actual 11), Koppie (IL08→actual 07), Marter (IL16→actual 14), LaHood
// (IL18→actual 16).
const ILLINOIS_RESULTS_URL = (district: string) => `https://ballotpedia.org/Illinois's_${district}_Congressional_District_election,_2026`;

const ILLINOIS_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H2IL01349", "H6IL01191"],
    source_url: ILLINOIS_RESULTS_URL("1st"),
    snippet: "Incumbent Jonathan Jackson and Christian Maxwell are running in the general election for U.S. House Illinois District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H6IL02355", "H6IL02389"],
    source_url: ILLINOIS_RESULTS_URL("2nd"),
    snippet: "Donna Miller and Mike Noack are running in the general election for U.S. House Illinois District 2 on November 3, 2026. Open seat: incumbent Robin Kelly ran for the open U.S. Senate seat instead and lost that Democratic primary to Juliana Stratton.",
  },
  "house-03": {
    advancingCandidateIds: ["H2IL03162", "H6IL03163"],
    source_url: ILLINOIS_RESULTS_URL("3rd"),
    snippet: "Incumbent Delia Ramirez and Angel Oakley are running in the general election for U.S. House Illinois District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H6IL04153", "H4IL04117", "H2IL04178", "H6IL04195"],
    source_url: ILLINOIS_RESULTS_URL("4th"),
    snippet: "Patty Garcia, Lupe Castillo, Ed Hershey, and Chris Getty are running in the general election for U.S. House Illinois District 4 on November 3, 2026. Open seat: incumbent Jesus 'Chuy' Garcia announced in November 2025, after the filing deadline, that he would not seek re-election. Two other independents (Mayra Macías, Byron Sigcho-Lopez) were removed from the ballot by the state elections board on July 21, 2026 for insufficient valid signatures; as of early August 2026 Sigcho-Lopez's federal lawsuit challenging that removal is still pending, not resolved, so neither appears in the confirmed general-election field.",
  },
  "house-05": {
    advancingCandidateIds: ["H0IL05096", "H2IL05241"],
    source_url: ILLINOIS_RESULTS_URL("5th"),
    snippet: "Incumbent Mike Quigley and Tom Hanson are running in the general election for U.S. House Illinois District 5 on November 3, 2026.",
  },
  "house-06": {
    advancingCandidateIds: ["H8IL06139", "H2IL06090"],
    source_url: ILLINOIS_RESULTS_URL("6th"),
    snippet: "Incumbent Sean Casten and Niki Conforti are running in the general election for U.S. House Illinois District 6 on November 3, 2026.",
  },
  "house-07": {
    advancingCandidateIds: ["H6IL07354", "H2IL08203"],
    source_url: ILLINOIS_RESULTS_URL("7th"),
    snippet: "La Shawn Ford and Chad Koppie are running in the general election for U.S. House Illinois District 7 on November 3, 2026. Open seat: incumbent Danny K. Davis announced July 31, 2025 that he would not seek re-election after nearly three decades in office, endorsing Ford to succeed him.",
  },
  "house-08": {
    advancingCandidateIds: ["H6IL08329", "H6IL08311"],
    source_url: ILLINOIS_RESULTS_URL("8th"),
    snippet: "Melissa Bean and Jennifer Davis are running in the general election for U.S. House Illinois District 8 on November 3, 2026. Open seat: incumbent Raja Krishnamoorthi ran for the open U.S. Senate seat instead and lost that Democratic primary to Juliana Stratton.",
  },
  "house-09": {
    advancingCandidateIds: ["H6IL09228", "H8IL09224"],
    source_url: ILLINOIS_RESULTS_URL("9th"),
    snippet: "Daniel K. Biss and John Elleson are running in the general election for U.S. House Illinois District 9 on November 3, 2026. Open seat: incumbent Jan Schakowsky retired after 26 years in Congress, endorsing Biss to succeed her.",
  },
  "house-10": {
    advancingCandidateIds: ["H2IL10068"],
    source_url: ILLINOIS_RESULTS_URL("10th"),
    snippet: "Incumbent Brad Schneider and Carl Lambrecht are running in the general election for U.S. House Illinois District 10 on November 3, 2026. Lambrecht has no FEC 2026 registration found; see code comment.",
  },
  "house-11": {
    advancingCandidateIds: ["H8IL14067", "H6IL11166"],
    source_url: ILLINOIS_RESULTS_URL("11th"),
    snippet: "Incumbent Bill Foster and Jeffrey Walter are running in the general election for U.S. House Illinois District 11 on November 3, 2026.",
  },
  "house-12": {
    advancingCandidateIds: ["H4IL12060", "H6IL12131"],
    source_url: ILLINOIS_RESULTS_URL("12th"),
    snippet: "Incumbent Mike Bost and Julie Fortier are running in the general election for U.S. House Illinois District 12 on November 3, 2026.",
  },
  "house-13": {
    advancingCandidateIds: ["H2IL13153", "H6IL13154"],
    source_url: ILLINOIS_RESULTS_URL("13th"),
    snippet: "Incumbent Nikki Budzinski and Jeff Wilson are running in the general election for U.S. House Illinois District 13 on November 3, 2026.",
  },
  "house-14": {
    advancingCandidateIds: ["H8IL14174", "H8IL16153"],
    source_url: ILLINOIS_RESULTS_URL("14th"),
    snippet: "Incumbent Lauren Underwood and James Marter are running in the general election for U.S. House Illinois District 14 on November 3, 2026.",
  },
  "house-15": {
    advancingCandidateIds: ["H0IL15129", "H6IL15092"],
    source_url: ILLINOIS_RESULTS_URL("15th"),
    snippet: "Incumbent Mary Miller and Jennifer Todd are running in the general election for U.S. House Illinois District 15 on November 3, 2026.",
  },
  "house-16": {
    advancingCandidateIds: ["H6IL18088", "H6IL16108"],
    source_url: ILLINOIS_RESULTS_URL("16th"),
    snippet: "Incumbent Darin LaHood and Paul Nolley are running in the general election for U.S. House Illinois District 16 on November 3, 2026.",
  },
  "house-17": {
    advancingCandidateIds: ["H2IL17147", "H6IL17247"],
    source_url: ILLINOIS_RESULTS_URL("17th"),
    snippet: "Incumbent Eric Sorensen and Dillan Vancil are running in the general election for U.S. House Illinois District 17 on November 3, 2026.",
  },
  senate: {
    advancingCandidateIds: ["S6IL00458", "S6IL00615", "S6IL00680"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Illinois,_2026",
    snippet: "Juliana Stratton, Don Tracy, and Whitfield Harrington Jr. are running in the general election for U.S. Senate Illinois on November 3, 2026. Open seat: incumbent Dick Durbin announced retirement in April 2025; Stratton won the Democratic primary over Reps. Raja Krishnamoorthi and Robin Kelly.",
  },
};

// Batch 2 of the post-pilot multi-agent scale-up (2026-08-12): Arkansas,
// Connecticut, Indiana, Iowa, Minnesota, New Jersey — all six clean, all
// with already-certified primaries. A seventh state in this batch,
// Tennessee, was correctly excluded by the scope check for active,
// unresolved redistricting litigation (multiple consolidated federal
// lawsuits still pending post-primary) and isn't included here.
//
// Notable per-state findings, each independently verified before use:
// - Connecticut CT-01: longtime incumbent Rep. John Larson lost his
//   Democratic primary to Luke Bronin on August 11, 2026 (the day before
//   this batch ran) — confirmed a real, AP-called result across CBS News,
//   NBC News, Washington Post, CT Mirror, and The Hill, not a hallucination.
// - Indiana IN-01: candidate "James Johnson"'s only FEC record has
//   genuinely CORRUPTED name fields (candidate_first_name literally reads
//   "PRESCRIPTION", candidate_last_name reads "JOHNSON FOR JAMES L JOHNSON
//   JR" — confirmed directly via the FEC API, not a pipeline parsing bug).
//   This is a different failure mode than the reversed-name cases
//   (NY-1, KY-6) — those were simple field-order swaps of otherwise-clean
//   data; this is data that can't be confidently reconstructed at all — so
//   he's excluded entirely rather than guessed at or shown garbled.
// - New Jersey NJ-08: FEC has two same-surname "Menendez" records in this
//   district — the actual candidate, incumbent Rep. Robert Menendez Jr.,
//   and a second record for his father, former Sen. Robert Menendez Sr.
//   (expelled from the Senate after a 2024 corruption conviction) — a
//   genuine different-person collision, confirmed via each record's
//   distinct office/election-year history; only the son's ID is used.
// - New Jersey NJ-11: incumbent Mikie Sherrill resigned after winning the
//   2025 governor's race; Analilia Mejia won the April 16, 2026 special
//   election to succeed her and is simply the regular incumbent for the
//   2026 cycle now — same resolved-vacancy pattern as Arizona's AZ-7, not
//   a parallel special-election trap like Georgia's.
const ARKANSAS_RESULTS_URL = (district: string) => `https://ballotpedia.org/Arkansas's_${district}_Congressional_District_election,_2026`;

const ARKANSAS_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H0AR01083", "H6AR01155"],
    source_url: ARKANSAS_RESULTS_URL("1st"),
    snippet: "Incumbent Rick Crawford, Terri Yarbrough Green, and Steve Parsons are running in the general election for U.S. House Arkansas District 1 on November 3, 2026. Parsons (L) has no FEC 2026 registration found; see code comment.",
  },
  "house-02": {
    advancingCandidateIds: ["H4AR02141", "H6AR02286"],
    source_url: ARKANSAS_RESULTS_URL("2nd"),
    snippet: "Incumbent French Hill and Chris Jones are running in the general election for U.S. House Arkansas District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H0AR03055", "H6AR03128"],
    source_url: ARKANSAS_RESULTS_URL("3rd"),
    snippet: "Incumbent Steve Womack, Robb Ryerse, and Bobby Wilson are running in the general election for U.S. House Arkansas District 3 on November 3, 2026. Wilson (L) has no FEC 2026 registration found; see code comment.",
  },
  "house-04": {
    advancingCandidateIds: ["H4AR04048", "H6AR04084"],
    source_url: ARKANSAS_RESULTS_URL("4th"),
    snippet: "Incumbent Bruce Westerman and James Russell are running in the general election for U.S. House Arkansas District 4 on November 3, 2026.",
  },
  senate: {
    advancingCandidateIds: ["S4AR00103", "S6AR00199", "S6AR00223"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Arkansas,_2026",
    snippet: "Incumbent Tom Cotton, Hallie Shoffner, and Jeff Wadlin are running in the general election for U.S. Senate Arkansas on November 3, 2026. Shoffner won a contested Democratic primary over Ethan Dunbar, March 3, 2026.",
  },
};

const CONNECTICUT_RESULTS_URL = (district: string) => `https://ballotpedia.org/Connecticut's_${district}_Congressional_District_election,_2026`;

const CONNECTICUT_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H6CT01206", "H2CT03102"],
    source_url: CONNECTICUT_RESULTS_URL("1st"),
    snippet: "Luke Bronin and Amy Chai are running in the general election for U.S. House Connecticut District 1 on November 3, 2026. Open seat: incumbent Rep. John Larson lost the Democratic primary to Bronin on August 11, 2026, a widely covered upset (53.5% to 34.7%).",
  },
  "house-02": {
    advancingCandidateIds: ["H2CT02112", "H6CT02196"],
    source_url: CONNECTICUT_RESULTS_URL("2nd"),
    snippet: "Incumbent Joe Courtney and George Austin are running in the general election for U.S. House Connecticut District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H0CT03072", "H6CT03178"],
    source_url: CONNECTICUT_RESULTS_URL("3rd"),
    snippet: "Incumbent Rosa L. DeLauro and Christopher Lancia are running in the general election for U.S. House Connecticut District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H8CT04172", "H6CT04143", "H0CT04237"],
    source_url: CONNECTICUT_RESULTS_URL("4th"),
    snippet: "Incumbent Jim Himes, Michael Goldstein, and Damon Cerreta are running in the general election for U.S. House Connecticut District 4 on November 3, 2026.",
  },
  "house-05": {
    advancingCandidateIds: ["H8CT05245", "H6CT05231"],
    source_url: CONNECTICUT_RESULTS_URL("5th"),
    snippet: "Incumbent Jahana Hayes and Chris Shea are running in the general election for U.S. House Connecticut District 5 on November 3, 2026.",
  },
};

const INDIANA_RESULTS_URL = (district: string) => `https://ballotpedia.org/Indiana's_${district}_Congressional_District_election,_2026`;

const INDIANA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H0IN01150", "H6IN01231"],
    source_url: INDIANA_RESULTS_URL("1st"),
    snippet: "Incumbent Frank Mrvan, Barb Regnitz, Alexander Degman, and James Johnson are running in the general election for U.S. House Indiana District 1 on November 3, 2026. Degman (Ind) has no FEC 2026 registration found. Johnson's FEC record has corrupted name fields (first name field literally reads \"PRESCRIPTION\") rather than a simple reversal, so it's excluded rather than guessed at; see code comment.",
  },
  "house-02": {
    advancingCandidateIds: ["H2IN02295", "H6IN02189", "H6IN02205"],
    source_url: INDIANA_RESULTS_URL("2nd"),
    snippet: "Incumbent Rudy Yakym, Jamee Decio, William Henry, and Eric Beebe are running in the general election for U.S. House Indiana District 2 on November 3, 2026. Beebe's only FEC match is Democratic Party, but Ballotpedia lists him as an Independent general-election candidate, so it's excluded rather than force-matched; see code comment.",
  },
  "house-03": {
    advancingCandidateIds: ["H0IN03198", "H6IN03294"],
    source_url: INDIANA_RESULTS_URL("3rd"),
    snippet: "Incumbent Marlin A. Stutzman, Kelly Thompson, and Phillip Beachy are running in the general election for U.S. House Indiana District 3 on November 3, 2026. Beachy (Ind, write-in) has no FEC 2026 registration found.",
  },
  "house-04": {
    advancingCandidateIds: ["H8IN04199", "H6IN04193", "H6IN04243"],
    source_url: INDIANA_RESULTS_URL("4th"),
    snippet: "Incumbent Jim Baird, Drew Cox, and David Bokash are running in the general election for U.S. House Indiana District 4 on November 3, 2026.",
  },
  "house-05": {
    advancingCandidateIds: ["H0IN05326", "H6IN05307"],
    source_url: INDIANA_RESULTS_URL("5th"),
    snippet: "Incumbent Victoria Spartz and J.D. Ford are running in the general election for U.S. House Indiana District 5 on November 3, 2026.",
  },
  "house-06": {
    advancingCandidateIds: ["H4IN06185", "H6IN06230"],
    source_url: INDIANA_RESULTS_URL("6th"),
    snippet: "Incumbent Jefferson Shreve and Cynthia Wirth are running in the general election for U.S. House Indiana District 6 on November 3, 2026.",
  },
  "house-07": {
    advancingCandidateIds: ["H8IN07184", "H6IN07444"],
    source_url: INDIANA_RESULTS_URL("7th"),
    snippet: "Incumbent Andre Carson, Patrick McAuley, and James Sceniak are running in the general election for U.S. House Indiana District 7 on November 3, 2026. Sceniak (L, convention nominee) has no FEC 2026 registration found.",
  },
  "house-08": {
    advancingCandidateIds: ["H4IN08249", "H6IN08293", "H6IN08285"],
    source_url: INDIANA_RESULTS_URL("8th"),
    snippet: "Incumbent Mark Messmer, Mary Allen, and James Burke are running in the general election for U.S. House Indiana District 8 on November 3, 2026.",
  },
  "house-09": {
    advancingCandidateIds: ["H6IN09143", "H6IN09242", "H6IN09317", "H6IN09283"],
    source_url: INDIANA_RESULTS_URL("9th"),
    snippet: "Incumbent Erin Houchin, Brad Meyer, Tonya Hudson, and Floyd Taylor are running in the general election for U.S. House Indiana District 9 on November 3, 2026.",
  },
};

const IOWA_RESULTS_URL = (district: string) => `https://ballotpedia.org/Iowa's_${district}_Congressional_District_election,_2026`;

const IOWA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H8IA02043", "H2IA02111", "H6IA01213"],
    source_url: IOWA_RESULTS_URL("1st"),
    snippet: "Incumbent Mariannette Miller-Meeks, Christina Bohannan, and Michael Bridgford are running in the general election for U.S. House Iowa District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H6IA02211", "H6IA02237", "H6IA02260"],
    source_url: IOWA_RESULTS_URL("2nd"),
    snippet: "Lindsay James, Joe Mitchell, Rick Stewart, and Dave Bushaw are running in the general election for U.S. House Iowa District 2 on November 3, 2026. Open seat: incumbent Ashley Hinson ran for the open U.S. Senate seat instead and won that Republican primary. Stewart (L) has no current FEC 2026 registration found; see code comment.",
  },
  "house-03": {
    advancingCandidateIds: ["H2IA03119", "H6IA03268"],
    source_url: IOWA_RESULTS_URL("3rd"),
    snippet: "Incumbent Zach Nunn and Sarah Trone Garriott are running in the general election for U.S. House Iowa District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H6IA04217", "H6IA04167", "H6IA04233"],
    source_url: IOWA_RESULTS_URL("4th"),
    snippet: "Dave Dawson, Chris McGowan, and Jermaine Decker are running in the general election for U.S. House Iowa District 4 on November 3, 2026. Open seat: incumbent Randy Feenstra is running for Governor of Iowa instead.",
  },
  senate: {
    advancingCandidateIds: ["S6IA00298", "S6IA00314", "S6IA00181"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Iowa,_2026",
    snippet: "Josh Turek, Ashley Hinson, and Thomas Laehn are running in the general election for U.S. Senate Iowa on November 3, 2026. Open seat: incumbent Joni Ernst (R) is not seeking re-election.",
  },
};

const MINNESOTA_RESULTS_URL = (district: string) => `https://ballotpedia.org/Minnesota's_${district}_Congressional_District_election,_2026`;

const MINNESOTA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H2MN01223", "H6MN01190"],
    source_url: MINNESOTA_RESULTS_URL("1st"),
    snippet: "Incumbent Brad Finstad and Jake Johnson are running in the general election for U.S. House Minnesota District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H6MN02230", "H6MN02263"],
    source_url: MINNESOTA_RESULTS_URL("2nd"),
    snippet: "Matt Little and Eric Pratt are running in the general election for U.S. House Minnesota District 2 on November 3, 2026. Open seat: incumbent Angie Craig ran for the open U.S. Senate seat instead and placed second in that Democratic primary.",
  },
  "house-03": {
    advancingCandidateIds: ["H4MN03118", "H6MN03170"],
    source_url: MINNESOTA_RESULTS_URL("3rd"),
    snippet: "Incumbent Kelly Morrison and Tyler Bass are running in the general election for U.S. House Minnesota District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H0MN04049", "H6MN04293"],
    source_url: MINNESOTA_RESULTS_URL("4th"),
    snippet: "Incumbent Betty McCollum and Paul Wikstrom are running in the general election for U.S. House Minnesota District 4 on November 3, 2026.",
  },
  "house-05": {
    advancingCandidateIds: ["H8MN05239", "H6MN05357", "H6MN05373"],
    source_url: MINNESOTA_RESULTS_URL("5th"),
    snippet: "Incumbent Ilhan Omar, John Nagel, and DeVelle Jackson are running in the general election for U.S. House Minnesota District 5 on November 3, 2026.",
  },
  "house-06": {
    advancingCandidateIds: ["H4MN06087", "H6MN06215"],
    source_url: MINNESOTA_RESULTS_URL("6th"),
    snippet: "Incumbent Tom Emmer and Doug Chapin are running in the general election for U.S. House Minnesota District 6 on November 3, 2026.",
  },
  "house-07": {
    advancingCandidateIds: ["H0MN07091", "H6MN07312"],
    source_url: MINNESOTA_RESULTS_URL("7th"),
    snippet: "Incumbent Michelle Fischbach and Erik Osberg are running in the general election for U.S. House Minnesota District 7 on November 3, 2026.",
  },
  "house-08": {
    advancingCandidateIds: ["H8MN08043", "H6MN08179"],
    source_url: MINNESOTA_RESULTS_URL("8th"),
    snippet: "Incumbent Pete Stauber and Trina Swanson are running in the general election for U.S. House Minnesota District 8 on November 3, 2026.",
  },
  senate: {
    advancingCandidateIds: ["S6MN00440", "S6MN00556", "S6MN00572", "S6MN00481"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Minnesota,_2026",
    snippet: "Peggy Flanagan, Michele Tafoya, Rebecca Whiting, and Marisa Simonetti are running in the general election for U.S. Senate Minnesota on November 3, 2026. Open seat: incumbent Tina Smith (D) is not seeking re-election; Flanagan won the Democratic primary over Rep. Angie Craig.",
  },
};

const NEW_JERSEY_RESULTS_URL = (district: string) => `https://ballotpedia.org/New_Jersey's_${district}_Congressional_District_election,_2026`;

const NEW_JERSEY_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H4NJ01084", "H2NJ01187"],
    source_url: NEW_JERSEY_RESULTS_URL("1st"),
    snippet: "Incumbent Donald Norcross and Damon Galdo are running in the general election for U.S. House New Jersey District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H8NJ02166", "H6NJ02251", "H6NJ02269"],
    source_url: NEW_JERSEY_RESULTS_URL("2nd"),
    snippet: "Incumbent Jeff Van Drew, Zack Mullock, and Ramon Mora Jr. are running in the general election for U.S. House New Jersey District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H4NJ03080", "H6NJ03184", "H6NJ03192"],
    source_url: NEW_JERSEY_RESULTS_URL("3rd"),
    snippet: "Incumbent Herbert C. Conaway Jr., Michael McGuire, Ryan Kelly, and Steven Welzer are running in the general election for U.S. House New Jersey District 3 on November 3, 2026. Welzer (G) has no FEC 2026 registration found.",
  },
  "house-04": {
    advancingCandidateIds: ["H8NJ04014", "H6NJ04257"],
    source_url: NEW_JERSEY_RESULTS_URL("4th"),
    snippet: "Incumbent Chris Smith and Rachel Peace are running in the general election for U.S. House New Jersey District 4 on November 3, 2026.",
  },
  "house-05": {
    advancingCandidateIds: ["H6NJ05171", "H6NJ05221", "H6NJ05247"],
    source_url: NEW_JERSEY_RESULTS_URL("5th"),
    snippet: "Incumbent Josh Gottheimer, Sean Kirrane, and Adam Rueda are running in the general election for U.S. House New Jersey District 5 on November 3, 2026.",
  },
  "house-06": {
    advancingCandidateIds: ["H8NJ03073", "H6NJ06278"],
    source_url: NEW_JERSEY_RESULTS_URL("6th"),
    snippet: "Incumbent Frank Pallone Jr. and Hillary Herzig are running in the general election for U.S. House New Jersey District 6 on November 3, 2026.",
  },
  "house-07": {
    advancingCandidateIds: ["H0NJ07261", "H6NJ07201"],
    source_url: NEW_JERSEY_RESULTS_URL("7th"),
    snippet: "Incumbent Thomas Kean Jr., Rebecca Bennett, and Seamus O'Toole are running in the general election for U.S. House New Jersey District 7 on November 3, 2026. O'Toole has no FEC 2026 registration found.",
  },
  "house-08": {
    advancingCandidateIds: ["H2NJ08232", "H6NJ08217"],
    source_url: NEW_JERSEY_RESULTS_URL("8th"),
    snippet: "Incumbent Robert Menendez Jr., Craig Honts, Da'Shone Hughey, and Aristotle Eliopoulos are running in the general election for U.S. House New Jersey District 8 on November 3, 2026. Honts and Eliopoulos have no FEC 2026 registration found. A same-surname FEC record (his father, former Sen. Robert Menendez Sr., convicted of corruption in 2024) is a confirmed different person and was not used; see code comment.",
  },
  "house-09": {
    advancingCandidateIds: ["H4NJ09194", "H6NJ09264", "H6NJ09306"],
    source_url: NEW_JERSEY_RESULTS_URL("9th"),
    snippet: "Incumbent Nellie Pou, Rosemary Pino, and Terrisa Bukovinac are running in the general election for U.S. House New Jersey District 9 on November 3, 2026.",
  },
  "house-10": {
    advancingCandidateIds: ["H4NJ10176", "H4NJ10135"],
    source_url: NEW_JERSEY_RESULTS_URL("10th"),
    snippet: "Incumbent LaMonica McIver and Carmen Bucco are running in the general election for U.S. House New Jersey District 10 on November 3, 2026.",
  },
  "house-11": {
    advancingCandidateIds: ["H6NJ11286", "H6NJ11211", "H6NJ11328"],
    source_url: NEW_JERSEY_RESULTS_URL("11th"),
    snippet: "Incumbent Analilia Mejia, Joe Hathaway, and Alan Bond are running in the general election for U.S. House New Jersey District 11 on November 3, 2026. Mejia won an April 16, 2026 special election to succeed Mikie Sherrill, who resigned after winning the New Jersey governorship — she is the regular incumbent for the 2026 cycle, not a parallel special-election candidate; see code comment.",
  },
  "house-12": {
    advancingCandidateIds: ["H6NJ12417", "H2NJ06210", "H6NJ12441"],
    source_url: NEW_JERSEY_RESULTS_URL("12th"),
    snippet: "Adam Hamawy, Gregg Mele, Andres Jinete, and Winston Jordan are running in the general election for U.S. House New Jersey District 12 on November 3, 2026. Open seat: incumbent Bonnie Watson Coleman did not seek re-election. Jordan has no FEC 2026 registration found.",
  },
  senate: {
    advancingCandidateIds: ["S4NJ00185", "S4NJ00532", "S0NJ00258"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_New_Jersey,_2026",
    snippet: "Incumbent Cory Booker, Justin Murphy, Veronica Fernandez, and Joanne Kuniansky are running in the general election for U.S. Senate New Jersey on November 3, 2026. Kuniansky has no FEC 2026 registration found.",
  },
};

// Nebraska: like every other state added in this same pass (HI/ID/KS/NV),
// the research pass's per-district Ballotpedia pull only confirmed the
// resolved GENERAL-ELECTION field — it didn't check whether primary LOSERS
// still hold live FEC registrations for the same district, which is exactly
// what this file exists to filter. Confirmed empirically: the first
// unfiltered build of this batch showed 2-4x more candidates per race than
// Ballotpedia's actual general-election list. All 3 House races get a full
// filter here, same treatment as every multi-district state before it.
// Senate is a second, genuinely different case layered on top — Cindy
// Burbank (D) won her May 12, 2026 primary outright, then withdrew July 17;
// Nebraska's Secretary of State (the state's own certifying election
// authority, same evidentiary tier as Montana's canvass or North Dakota's
// results dashboard used elsewhere in this file) confirmed her removal from
// the ballot on July 21.
const NEBRASKA_RESULTS_URL = (district: string) => `https://ballotpedia.org/Nebraska%27s_${district}_Congressional_District_election,_2026`;

const NEBRASKA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H2NE01118", "H6NE01143"],
    source_url: NEBRASKA_RESULTS_URL("1st"),
    snippet: "Incumbent Mike Flood, Christopher Backemeyer, and Nik Sandman are running in the general election for U.S. House Nebraska District 1 on November 3, 2026.",
  },
  // Brett Lindstrom and incumbent Don Bacon both hold live FEC 2026
  // registrations for this district (Bacon's FEC record is still tagged
  // "Incumbent" despite not filing for re-election), but neither ran in the
  // primary — Brinker Harding is the actual Republican nominee for this
  // open seat.
  "house-02": {
    advancingCandidateIds: ["H6NE02174", "H6NE02208", "H6NE02273"],
    source_url: NEBRASKA_RESULTS_URL("2nd"),
    snippet: "Denise Powell, Brinker Harding, and Eric Michael Foreman are running in the general election for U.S. House Nebraska District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H6NE03115", "H6NE03180", "H0NE03217", "H6NE03198"],
    source_url: NEBRASKA_RESULTS_URL("3rd"),
    snippet: "Incumbent Adrian Smith, Becky Lynn Stille, David J. Else, and Mark Cohen are running in the general election for U.S. House Nebraska District 3 on November 3, 2026.",
  },
  senate: {
    advancingCandidateIds: ["S6NE00129", "S6NE00152", "S4NE00207"],
    source_url:
      "https://nebraskaexaminer.com/2026/07/21/nebraska-secretary-of-state-says-democrat-cindy-burbank-wont-appear-on-us-senate-ballot/",
    snippet:
      "\"We have consulted with the Attorney General's office,\" Evnen said Tuesday in a statement. \"Under Nebraska law, when a candidate has declined a nomination by the deadline, the Secretary of State has no discretion to refuse it. For that reason, Cindy Burbank's name will not appear on the November ballot as the Democratic nominee for U.S. Senate.\" ... Now with Burbank off the ballot, Osborn and Ricketts are the main two candidates in the Senate race. Marijuana NOW Party's U.S. Senate nominee Mike Marvin is still currently on the ballot.",
  },
};

// Oklahoma uses a majority-vote runoff system (Aug 25, 2026 this cycle),
// which produces genuinely crowded primaries — OK-1's Republican primary
// alone drew 11 candidates. Confirmed directly (not just from the research
// pass) via a live Ballotpedia check: Mark Tedford led the June 16 primary
// at 31.9%, was set for an Aug 25 runoff against second-place Jackson
// Lahmeyer, but that runoff was canceled after Lahmeyer withdrew, so Tedford
// advanced automatically — resolved and certified before this was built.
// Oklahoma's Senate race has NOT reached that same resolution (Democratic
// runoff between Priest and Thomas is still pending Aug 25) and is
// deliberately not built at all yet — see build.ts.
const OKLAHOMA_RESULTS_URL = (district: string) => `https://ballotpedia.org/Oklahoma's_${district}_Congressional_District_election,_2026`;

const OKLAHOMA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H6OK01201", "H6OK01235"],
    source_url: OKLAHOMA_RESULTS_URL("1st"),
    snippet:
      "John Croisant and Mark Tedford are running in the general election for U.S. House Oklahoma District 1 on November 3, 2026. ... Republican primary runoff election: The Republican primary runoff election was canceled. Mark Tedford advanced from the Republican primary runoff for U.S. House Oklahoma District 1. Withdrawn or disqualified candidates: Jackson Lahmeyer (R).",
  },
  "house-02": {
    advancingCandidateIds: ["H2OK02315", "H4OK02196", "H4OK02204"],
    source_url: OKLAHOMA_RESULTS_URL("2nd"),
    snippet: "Incumbent Josh Brecheen, Brandon Wade, and Ronnie Hopkins are running in the general election for U.S. House Oklahoma District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H4OK06056"],
    source_url: OKLAHOMA_RESULTS_URL("3rd"),
    snippet:
      "Incumbent Frank Lucas and Suzie Byrd are running in the general election for U.S. House Oklahoma District 3 on November 3, 2026. Byrd has no FEC 2026 registration found.",
  },
  "house-04": {
    advancingCandidateIds: ["H2OK04055", "H6OK04155"],
    source_url: OKLAHOMA_RESULTS_URL("4th"),
    snippet:
      "Incumbent Tom Cole, Mitchell Jacob, and Rocco Bonacci are running in the general election for U.S. House Oklahoma District 4 on November 3, 2026. Bonacci has no FEC 2026 registration found.",
  },
  "house-05": {
    advancingCandidateIds: ["H0OK05205", "H6OK05293", "H6OK05301", "H4OK04176"],
    source_url: OKLAHOMA_RESULTS_URL("5th"),
    snippet:
      "Incumbent Stephanie Bice, Jena Nelson, Robert Henri, and Austin Nieves are running in the general election for U.S. House Oklahoma District 5 on November 3, 2026.",
  },
};

// Kansas: full per-district filter, same empirical basis as Nebraska above
// (unfiltered build showed 4-10 candidates per race against an expected
// 2-3). KS-03 has an extra, individually-confirmed wrinkle: Chase LaPorte
// (R) lost the Republican primary to Eric Jenkins but still holds two
// separate live FEC 2026 registrations for that district (H6KS03258 and
// H6KS03274, a probable duplicate filing).
const KANSAS_RESULTS_URL = (district: string) => `https://ballotpedia.org/Kansas'_${district}_Congressional_District_election,_2026`;

const KANSAS_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H0KS01123", "H6KS01203", "H6KS01229"],
    source_url: KANSAS_RESULTS_URL("1st"),
    snippet: "Incumbent Tracey Mann, Lauren Reinhold, and Steven Jacob are running in the general election for U.S. House Kansas District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H4KS02164", "H6KS02276"],
    source_url: KANSAS_RESULTS_URL("2nd"),
    snippet: "Incumbent Derek Schmidt, Don Coover, and John Hauer are running in the general election for U.S. House Kansas District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H8KS03155", "H6KS03308"],
    source_url: KANSAS_RESULTS_URL("3rd"),
    snippet: "Incumbent Sharice Davids, Eric Jenkins, and Steve Hohe are running in the general election for U.S. House Kansas District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H8KS04112", "H6KS04272", "H6KS04280"],
    source_url: KANSAS_RESULTS_URL("4th"),
    snippet: "Incumbent Ron Estes, Katy Tyndell, and Drew Cranmer are running in the general election for U.S. House Kansas District 4 on November 3, 2026.",
  },
  senate: {
    advancingCandidateIds: ["S0KS00315", "S6KS00312"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Kansas,_2026",
    snippet: "Incumbent Roger Marshall, Adam Hamilton, and David Graham are running in the general election for U.S. Senate Kansas on November 3, 2026.",
  },
};

// Hawaii: HI-01 needs a filter both for the same primary-loser leakage as
// every other state here AND a specific confirmed extra — a Nonpartisan FEC
// 2026 registrant, Sholom Gelt (H6HI01378), who doesn't appear anywhere on
// Ballotpedia's actual HI-01 candidate lists (general, Democratic,
// Republican, or Nonpartisan primary). HI-02's unfiltered build already
// matched its expected 2-candidate field exactly, so it's left unfiltered.
const HAWAII_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H2HI02128", "H6HI01360", "H6HI01386"],
    source_url: "https://ballotpedia.org/Hawaii%27s_1st_Congressional_District_election,_2026",
    snippet:
      "Incumbent Ed Case, Adriel Lam, Jordan Conley, and Nathan Berning are running in the general election for U.S. House Hawaii District 1 on November 3, 2026.",
  },
};

// Idaho: the research pass explicitly (and, per the unfiltered build's
// candidate counts, incorrectly) concluded no narrowing was needed here —
// ID-01 came back with 7 raw candidates against an expected 4, ID-02 with
// 9 against 4, and the Senate race with 8 against 4. Full filter for all
// three races, same treatment as every other state in this file.
const IDAHO_RESULTS_URL = (district: string) => `https://ballotpedia.org/Idaho%27s_${district}_Congressional_District_election,_2026`;

const IDAHO_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H8ID01124", "H2ID01192", "H4ID01149", "H6ID01318"],
    source_url: IDAHO_RESULTS_URL("1st"),
    snippet:
      "Incumbent Russ Fulcher, Kaylee Peterson, Brendan Gomez, and Sarah Zabel are running in the general election for U.S. House Idaho District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H8ID02064", "H6ID02274", "H6ID02282", "H6ID02241"],
    source_url: IDAHO_RESULTS_URL("2nd"),
    snippet:
      "The following candidates are running in the general election for U.S. House Idaho District 2 on November 3, 2026. Candidate: Michael K. Simpson (R), Elinor Gilbreath (D), Idaho Law (Constitution Party), Will Johanson (L), Emre Houser (Independent), Tripp Hutchinson (Independent).",
  },
  senate: {
    advancingCandidateIds: ["S8ID00092", "S6ID00138", "S6ID00146", "S0ID00172"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Idaho,_2026",
    snippet:
      "Incumbent Jim Risch, David Roth, Matt Loesby, Todd Achilles, and Natalie Fleming are running in the general election for U.S. Senate Idaho on November 3, 2026.",
  },
};

// Nevada: full per-district filter, same empirical basis as the states
// above. NV-03 has an extra wrinkle beyond ordinary primary-loser
// leakage — Marty O'Donnell (R) holds two separate live FEC 2026
// registrations for the same campaign (H4NV03225, filed 2024 and still
// active; H6NV03204, filed fresh for 2026) — both share the same current
// committee (C00900910), so without narrowing he'd otherwise appear twice
// as if two different candidates. Kept H4NV03225, the one with the longer
// continuous filing history, matching the research pass's own choice.
const NEVADA_RESULTS_URL = (district: string) => `https://ballotpedia.org/Nevada's_${district}_Congressional_District_election,_2026`;

const NEVADA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H8NV03036", "H6NV01331", "H6NV01315"],
    source_url: NEVADA_RESULTS_URL("1st"),
    snippet: "Incumbent Dina Titus, Carrie Buck, Steven St John, and Bobby Khan are running in the general election for U.S. House Nevada District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H6NV02362", "H4NV04108"],
    source_url: NEVADA_RESULTS_URL("2nd"),
    snippet: "Teresa Benitez-Thompson, David Flippo, and Lynn Chapman are running in the general election for U.S. House Nevada District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H6NV04020", "H4NV03225"],
    source_url: NEVADA_RESULTS_URL("3rd"),
    snippet: "Incumbent Susie Lee, Marty O'Donnell, and Jon Kamerath are running in the general election for U.S. House Nevada District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H2NV04011", "H6NV04111"],
    source_url: NEVADA_RESULTS_URL("4th"),
    snippet: "Incumbent Steven Horsford, Cody Whipple, Russell Best, and William Johnson are running in the general election for U.S. House Nevada District 4 on November 3, 2026.",
  },
};

export function getPrimaryFilter(state: string, raceSlug: string, cycle: number): PrimaryResult | null {
  if (state === "MT" && cycle === 2026) return MONTANA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "VT" && cycle === 2026) return VERMONT_2026_PRIMARY[raceSlug] ?? null;
  if (state === "ND" && cycle === 2026) return NORTH_DAKOTA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "SD" && cycle === 2026) return SOUTH_DAKOTA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "NY" && cycle === 2026) return NEW_YORK_2026_PRIMARY[raceSlug] ?? null;
  if (state === "GA" && cycle === 2026) return GEORGIA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "PA" && cycle === 2026) return PENNSYLVANIA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "MI" && cycle === 2026) return MICHIGAN_2026_PRIMARY[raceSlug] ?? null;
  if (state === "AZ" && cycle === 2026) return ARIZONA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "KY" && cycle === 2026) return KENTUCKY_2026_PRIMARY[raceSlug] ?? null;
  if (state === "CO" && cycle === 2026) return COLORADO_2026_PRIMARY[raceSlug] ?? null;
  if (state === "IL" && cycle === 2026) return ILLINOIS_2026_PRIMARY[raceSlug] ?? null;
  if (state === "AR" && cycle === 2026) return ARKANSAS_2026_PRIMARY[raceSlug] ?? null;
  if (state === "CT" && cycle === 2026) return CONNECTICUT_2026_PRIMARY[raceSlug] ?? null;
  if (state === "IN" && cycle === 2026) return INDIANA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "IA" && cycle === 2026) return IOWA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "MN" && cycle === 2026) return MINNESOTA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "NJ" && cycle === 2026) return NEW_JERSEY_2026_PRIMARY[raceSlug] ?? null;
  if (state === "NE" && cycle === 2026) return NEBRASKA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "OK" && cycle === 2026) return OKLAHOMA_2026_PRIMARY[raceSlug] ?? null;
  if (state === "KS" && cycle === 2026) return KANSAS_2026_PRIMARY[raceSlug] ?? null;
  if (state === "HI" && cycle === 2026) return HAWAII_2026_PRIMARY[raceSlug] ?? null;
  if (state === "ID" && cycle === 2026) return IDAHO_2026_PRIMARY[raceSlug] ?? null;
  if (state === "NV" && cycle === 2026) return NEVADA_2026_PRIMARY[raceSlug] ?? null;
  return null;
}
