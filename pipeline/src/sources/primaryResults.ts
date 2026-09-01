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

// Auto-resolved results, written by resolvePendingPrimaries.ts once it's
// found a primary/runoff result confident enough to publish without a
// human review pass. Kept in a separate JSON file rather than mixed into
// this hand-curated one -- an automated process should never need to
// safely edit real TypeScript source unattended, and every hand-written
// entry above stays completely untouched by this either way. Checked only
// as a fallback below, after every hand-curated state -- if a human ever
// hand-writes a real entry for the same race, it wins.
import { readFileSync } from "node:fs";
import { join } from "node:path";

interface AutoPrimaryEntry extends PrimaryResult {
  resolvedAt: string;
}

let autoPrimaryResultsCache: Record<string, Record<string, AutoPrimaryEntry>> | null = null;

function getAutoPrimaryResult(state: string, raceSlug: string, cycle: number): PrimaryResult | null {
  if (cycle !== 2026) return null;
  if (autoPrimaryResultsCache === null) {
    try {
      const path = join(import.meta.dirname, "..", "ci", "autoPrimaryResults.json");
      autoPrimaryResultsCache = JSON.parse(readFileSync(path, "utf8"));
    } catch {
      autoPrimaryResultsCache = {};
    }
  }
  const entry = autoPrimaryResultsCache![state]?.[raceSlug];
  if (!entry) return null;
  return { advancingCandidateIds: entry.advancingCandidateIds, source_url: entry.source_url, snippet: entry.snippet };
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
// Alaska's own results portal (elections.alaska.gov) is Cloudflare-gated
// against automated access — same shape as Census's own WAF and
// Ballotpedia's bot-detection elsewhere in this project — so sourced from
// AP's results via NPR instead, fetched and read directly (not just a
// research summary trusted blindly), independently re-confirmed a second
// time before writing this. Unofficial as of 2026-08-19 (~80% reporting,
// Alaska's own certification target is 2026-08-31): Matt Schultz finished
// 3rd by raw votes (10,435, 8.1%) but suspended his campaign and endorsed
// Bill Hill on 2026-07-17, a month before the primary — AP's own tracker
// explicitly marks him ineligible to advance despite remaining on the
// ballot (Alaska's "silent primary" mechanic backfills his slot with the
// next-highest finisher, John Brendan Williams). The 4th slot here
// (Williams over 5th-place Strickland, a 293-vote/0.2-point gap with
// ~20% of the statewide vote still outstanding) carries real if smaller
// residual risk than the top 3 — worth rechecking once AK certifies.
const ALASKA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-AL": {
    advancingCandidateIds: ["H2AK01083", "H6AK01092", "H4AK00164", "H6AK01068"],
    source_url: "https://apps.npr.org/primary-election-results-2026/states/AK.html",
    snippet:
      "Matt Schultz withdrew from this race. While he remains on the primary ballot, he is not eligible to advance to the general election.",
  },
};

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
  // Mufi Hannemann (H6HI01113) filed FEC paperwork as an "Open seat"
  // Democratic challenger but never appeared on the actual Aug 8 primary
  // ballot — Ballotpedia's own primary-results page lists only Tokuda,
  // Steven King, Greg Guithues, and Kirill Basin as Democratic primary
  // candidates, with Tokuda winning 91.6%. Same pre-ballot-withdrawal
  // pattern as Alaska's Matt Schultz (see ALASKA_2026_PRIMARY).
  "house-02": {
    advancingCandidateIds: ["H6HI02426", "H2HI02581"],
    source_url: "https://ballotpedia.org/Hawaii%27s_2nd_Congressional_District_election,_2026",
    snippet:
      "Brenton Awa advanced from the Republican primary for U.S. House Hawaii District 2. Incumbent Jill Tokuda (D) defeated Steven King (D), Greg Guithues (D), and Kirill Basin (D) in the Democratic primary for U.S. House Hawaii District 2 on August 8, 2026, with 91.6% of the vote.",
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

const MARYLAND_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H8MD01094", "H6MD01320"],
    source_url: "https://ballotpedia.org/Maryland's_1st_Congressional_District_election,_2026",
    snippet: "General election for U.S. House Maryland District 1 Incumbent Andrew Harris, Dan Schwartz, and Edward Shlikas are running in the general election for U.S. House Maryland District 1 on November 3, 2026. Candidate Andrew Harris (R) Dan Schwartz (D) Edward Shlikas (Unaffiliated) (Write-in)",
  },
  "house-02": {
    advancingCandidateIds: ["H4MD02232", "H2MD06138"],
    source_url: "https://ballotpedia.org/Maryland's_2nd_Congressional_District_election,_2026",
    snippet: "General election for U.S. House Maryland District 2 Incumbent John Olszewski Jr. and Dave Wallace are running in the general election for U.S. House Maryland District 2 on November 3, 2026. Candidate John Olszewski Jr. (D) Dave Wallace (R)",
  },
  "house-03": {
    advancingCandidateIds: ["H4MD03156", "H4MD03149"],
    source_url: "https://ballotpedia.org/Maryland's_3rd_Congressional_District_election,_2026",
    snippet: "General election for U.S. House Maryland District 3 Incumbent Sarah Elfreth and Bernard Flowers are running in the general election for U.S. House Maryland District 3 on November 3, 2026. Candidate Sarah Elfreth (D) Bernard Flowers (R)",
  },
  "house-04": {
    advancingCandidateIds: ["H2MD04232"],
    source_url: "https://ballotpedia.org/Maryland's_4th_Congressional_District_election,_2026",
    snippet: "General election for U.S. House Maryland District 4 Incumbent Glenn Ivey, George McDermott, and Sam Husseini are running in the general election for U.S. House Maryland District 4 on November 3, 2026. Candidate Glenn Ivey (D) George McDermott (R) Sam Husseini (G)",
  },
  "house-05": {
    advancingCandidateIds: ["H6MD05321", "H6MD05271", "H6MD05305"],
    source_url: "https://ballotpedia.org/Maryland's_5th_Congressional_District_election,_2026",
    snippet: "General election for U.S. House Maryland District 5 Adrian Boafo, Chris Chaffee, Jonathan Burruss, Brian Jordan, and Mildred Hall are running in the general election for U.S. House Maryland District 5 on November 3, 2026. Candidate Adrian Boafo (D) Chris Chaffee (R) Jonathan Burruss (Unaffiliated) Brian Jordan (Unaffiliated) Mildred Hall (Other) (Write-in)",
  },
  "house-06": {
    advancingCandidateIds: ["H4MD06340", "H6MD06287"],
    source_url: "https://ballotpedia.org/Maryland's_6th_Congressional_District_election,_2026",
    snippet: "General election for U.S. House Maryland District 6 Incumbent April McClain Delaney, Robin Ficker, and Moshe Landman are running in the general election for U.S. House Maryland District 6 on November 3, 2026. Candidate April McClain Delaney (D) Robin Ficker (R) Moshe Landman (G)",
  },
  "house-07": {
    advancingCandidateIds: ["H6MD07020"],
    source_url: "https://ballotpedia.org/Maryland's_7th_Congressional_District_election,_2026",
    snippet: "General election for U.S. House Maryland District 7 Incumbent Kweisi Mfume and Scott Collier are running in the general election for U.S. House Maryland District 7 on November 3, 2026. Candidate Kweisi Mfume (D) Scott Collier (R)",
  },
  "house-08": {
    advancingCandidateIds: ["H6MD08457", "H4MD08213"],
    source_url: "https://ballotpedia.org/Maryland's_8th_Congressional_District_election,_2026",
    snippet: "General election for U.S. House Maryland District 8 Incumbent Jamie Raskin, Cheryl Riley, and Nancy Wallace are running in the general election for U.S. House Maryland District 8 on November 3, 2026. Candidate Jamie Raskin (D) Cheryl Riley (R) Nancy Wallace (G)",
  },
};

const MISSISSIPPI_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H6MS01131", "H6MS01313"],
    source_url: "https://ballotpedia.org/Mississippi's_1st_Congressional_District_election,_2026",
    snippet: "Incumbent Trent Kelly, Cliff Johnson, and Johnny Baucom are running in the general election for U.S. House Mississippi District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H4MS02068", "H2MS02203", "H6MS02188"],
    source_url: "https://ballotpedia.org/Mississippi's_2nd_Congressional_District_election,_2026",
    snippet: "Incumbent Bennie Thompson, Ron Eller, and Bennie Foster are running in the general election for U.S. House Mississippi District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H8MS03125", "H6MS03228", "H6MS03236"],
    source_url: "https://ballotpedia.org/Mississippi's_3rd_Congressional_District_election,_2026",
    snippet: "Incumbent Michael Guest, Michael Chiaradio, and Erik Kiehle are running in the general election for U.S. House Mississippi District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H2MS04258", "H6MS04242", "H6MS04259"],
    source_url: "https://ballotpedia.org/Mississippi's_4th_Congressional_District_election,_2026",
    snippet: "Incumbent Mike Ezell, Jeffrey Hulum III, and Carl Boyanton are running in the general election for U.S. House Mississippi District 4 on November 3, 2026.",
  },
  senate: {
    advancingCandidateIds: ["S8MS00261", "S6MS00133", "S4MS00187"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Mississippi,_2026",
    snippet: "Incumbent Cindy Hyde-Smith, Scott Colom, and Ty Pinkins are running in the general election for U.S. Senate Mississippi on November 3, 2026.",
  },
};

const NEW_MEXICO_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H2NM01144", "H6NM01129"],
    source_url: "https://ballotpedia.org/New_Mexico%27s_1st_Congressional_District_election,_2026",
    snippet: "Incumbent Melanie Ann Stansbury and Ndidiamaka Okpareke are running in the general election for U.S. House New Mexico District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H2NM02191", "H6NM02127"],
    source_url: "https://ballotpedia.org/New_Mexico%27s_2nd_Congressional_District_election,_2026",
    snippet: "Incumbent Gabriel Vasquez and Greg Cunningham are running in the general election for U.S. House New Mexico District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H0NM03102", "H6NM03083"],
    source_url: "https://ballotpedia.org/New_Mexico%27s_3rd_Congressional_District_election,_2026",
    snippet: "Incumbent Teresa Leger Fernandez and Martin Ruben Zamora are running in the general election for U.S. House New Mexico District 3 on November 3, 2026.",
  },
  senate: {
    advancingCandidateIds: ["S0NM00058", "S6NM01186", "S6NM01152"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_New_Mexico,_2026",
    snippet: "Incumbent Ben Ray Luján, Larry E. Marker, and Cameron Chick are running in the general election for U.S. Senate New Mexico on November 3, 2026.",
  },
};

const OREGON_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H2OR01133", "H6OR01308"],
    source_url: "https://ballotpedia.org/Oregon%27s_1st_Congressional_District_election,_2026",
    snippet: "Incumbent Suzanne Bonamici and Barbara Kahl are running in the general election for U.S. House Oregon District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H0OR02127", "H6OR02322"],
    source_url: "https://ballotpedia.org/Oregon%27s_2nd_Congressional_District_election,_2026",
    snippet: "Incumbent Cliff Bentz and Chris Beck are running in the general election for U.S. House Oregon District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H4OR03192"],
    source_url: "https://ballotpedia.org/Oregon%27s_3rd_Congressional_District_election,_2026",
    snippet: "Incumbent Maxine Dexter and Loran Ayles are running in the general election for U.S. House Oregon District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H2OR04095", "H6OR04260"],
    source_url: "https://ballotpedia.org/Oregon%27s_4th_Congressional_District_election,_2026",
    snippet: "Incumbent Val Hoyle and Monique DeSpain are running in the general election for U.S. House Oregon District 4 on November 3, 2026.",
  },
  "house-05": {
    advancingCandidateIds: ["H4OR05304", "H6OR05242"],
    source_url: "https://ballotpedia.org/Oregon%27s_5th_Congressional_District_election,_2026",
    snippet: "Incumbent Janelle Bynum and Patti Adair are running in the general election for U.S. House Oregon District 5 on November 3, 2026.",
  },
  "house-06": {
    advancingCandidateIds: ["H2OR06066", "H2OR01240", "H6OR06018"],
    source_url: "https://ballotpedia.org/Oregon%27s_6th_Congressional_District_election,_2026",
    snippet: "Incumbent Andrea Salinas, David Russ, and Jason Faler are running in the general election for U.S. House Oregon District 6 on November 3, 2026.",
  },
  senate: {
    advancingCandidateIds: ["S8OR00207", "S6OR05218"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Oregon,_2026",
    snippet: "Incumbent Jeff Merkley and David Brock Smith are running in the general election for U.S. Senate Oregon on November 3, 2026.",
  },
};

const SOUTH_CAROLINA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H6SC01359", "H6SC01334", "H6SC01342", "H6SC01375"],
    source_url: "https://ballotpedia.org/South_Carolina%27s_1st_Congressional_District_election,_2026",
    snippet: "Nancy Lacore, Jenny Honeycutt, Margo Ellis, Bill Reeside, and Clayton Cuteri are running in the general election for U.S. House South Carolina District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H2SC02059", "H6SC02159"],
    source_url: "https://ballotpedia.org/South_Carolina%27s_2nd_Congressional_District_election,_2026",
    snippet: "Incumbent Joe Wilson, Zyon Khalifa, and Dayna Alane Smith are running in the general election for U.S. House South Carolina District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H4SC01313", "H6SC03090"],
    source_url: "https://ballotpedia.org/South_Carolina%27s_3rd_Congressional_District_election,_2026",
    snippet: "Incumbent Sheri Biggs, Eunice Lehmacher, and Brian Corriea are running in the general election for U.S. House South Carolina District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H8SC04250", "H6SC04171", "H6SC04197"],
    source_url: "https://ballotpedia.org/South_Carolina%27s_4th_Congressional_District_election,_2026",
    snippet: "Incumbent William Timmons, Courtney McClain, and Jessica Ethridge are running in the general election for U.S. House South Carolina District 4 on November 3, 2026.",
  },
  "house-05": {
    advancingCandidateIds: ["H6SC05228", "H6SC05202", "H6SC05236"],
    source_url: "https://ballotpedia.org/South_Carolina%27s_5th_Congressional_District_election,_2026",
    snippet: "Mallory Dittmer, Wes Climer, and Andy Kaplan are running in the general election for U.S. House South Carolina District 5 on November 3, 2026.",
  },
  "house-06": {
    advancingCandidateIds: ["H2SC02042", "H6SC06184"],
    source_url: "https://ballotpedia.org/South_Carolina%27s_6th_Congressional_District_election,_2026",
    snippet: "Incumbent James Clyburn, John Peterson, and Joseph Oddo are running in the general election for U.S. House South Carolina District 6 on November 3, 2026.",
  },
  "house-07": {
    advancingCandidateIds: ["H2SC07280", "H6SC07034", "H8SC07089"],
    source_url: "https://ballotpedia.org/South_Carolina%27s_7th_Congressional_District_election,_2026",
    snippet: "Incumbent Russell Fry (R), John Vincent (D), and Branden Brown (R) are running in the general election for U.S. House South Carolina District 7 on November 3, 2026.",
  },
};

const VIRGINIA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H8VA01147", "H6VA01299"],
    source_url: "https://ballotpedia.org/Virginia's_1st_Congressional_District_election,_2026",
    snippet: "Incumbent Robert J. Wittman and Shannon Taylor are running in the general election for U.S. House Virginia District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H2VA02064", "H6VA02198", "H6VA02230", "H6VA02248", "H6VA02222"],
    source_url: "https://ballotpedia.org/Virginia's_2nd_Congressional_District_election,_2026",
    snippet: "Incumbent Jennifer Kiggans, Elaine Luria, DeVinche Albritton, Makiba Gaines, and Bishop Staten are running in the general election for U.S. House Virginia District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H6VA01117", "H6VA03121", "H2VA03096", "H6VA03097"],
    source_url: "https://ballotpedia.org/Virginia's_3rd_Congressional_District_election,_2026",
    snippet: "Incumbent Robert C. Scott, Edwin Rivera, James Taylor, and Dawn Vasquez are running in the general election for U.S. House Virginia District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H4VA04066", "H6VA04095"],
    source_url: "https://ballotpedia.org/Virginia's_4th_Congressional_District_election,_2026",
    snippet: "Incumbent Jennifer McClellan and Jason Brown are running in the general election for U.S. House Virginia District 4 on November 3, 2026.",
  },
  "house-05": {
    advancingCandidateIds: ["H0VA07133", "H6VA05217", "H6VA05241", "H6VA05225"],
    source_url: "https://ballotpedia.org/Virginia's_5th_Congressional_District_election,_2026",
    snippet: "Incumbent John McGuire, Tom Perriello, Cooke Harvey, and Chris Register are running in the general election for U.S. House Virginia District 5 on November 3, 2026.",
  },
  "house-06": {
    advancingCandidateIds: ["H8VA06104", "H6VA06173"],
    source_url: "https://ballotpedia.org/Virginia's_6th_Congressional_District_election,_2026",
    snippet: "Incumbent Benjamin Lee Cline and Beth Macy are running in the general election for U.S. House Virginia District 6 on November 3, 2026.",
  },
  "house-07": {
    advancingCandidateIds: ["H4VA07234", "H6VA07205", "H6VA07353"],
    source_url: "https://ballotpedia.org/Virginia's_7th_Congressional_District_election,_2026",
    snippet: "Incumbent Eugene Vindman, Douglas Ollivant, and Alaha Ahrar are running in the general election for U.S. House Virginia District 7 on November 3, 2026.",
  },
  "house-08": {
    advancingCandidateIds: ["H4VA08224", "H6VA08252"],
    source_url: "https://ballotpedia.org/Virginia's_8th_Congressional_District_election,_2026",
    snippet: "Incumbent Donald Sternoff Beyer Jr. and Tony Sabio are running in the general election for U.S. House Virginia District 8 on November 3, 2026.",
  },
  "house-09": {
    advancingCandidateIds: ["H0VA09055", "H6VA09136", "H6VA09151"],
    source_url: "https://ballotpedia.org/Virginia's_9th_Congressional_District_election,_2026",
    snippet: "Incumbent H. Morgan Griffith, Joy Powers, and Michael Jackson are running in the general election for U.S. House Virginia District 9 on November 3, 2026.",
  },
  "house-10": {
    advancingCandidateIds: ["H4VA10279", "H2VA10273", "H6VA10241", "H6VA10266"],
    source_url: "https://ballotpedia.org/Virginia's_10th_Congressional_District_election,_2026",
    snippet: "Incumbent Suhas Subramanyam, Dave Beckwith, Steven Goforth, and Omar Morsy are running in the general election for U.S. House Virginia District 10 on November 3, 2026.",
  },
  "house-11": {
    advancingCandidateIds: ["H6VA11066", "H6VA11249"],
    source_url: "https://ballotpedia.org/Virginia's_11th_Congressional_District_election,_2026",
    snippet: "Incumbent James Walkinshaw and Arthur Purves are running in the general election for U.S. House Virginia District 11 on November 3, 2026.",
  },
  senate: {
    advancingCandidateIds: ["S6VA00093", "S8VA00321", "S6VA00218"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Virginia,_2026",
    snippet: "Incumbent Mark Warner, Bert Mizusawa, and Mark Moran are running in the general election for U.S. Senate Virginia on November 3, 2026.",
  },
};

const WEST_VIRGINIA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H8WV03097", "H6WV01160", "H6WV01103"],
    source_url: "https://ballotpedia.org/West_Virginia's_1st_Congressional_District_election,_2026",
    snippet: "General election for U.S. House West Virginia District 1 — Incumbent Carol Miller, Vince George, Belinda Fox-Spencer, and Isaiah Rucker are running in the general election for U.S. House West Virginia District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H4WV02205", "H6WV02150", "H6WV02176", "H6WV02168"],
    source_url: "https://ballotpedia.org/West_Virginia's_2nd_Congressional_District_election,_2026",
    snippet: "General election for U.S. House West Virginia District 2 — Incumbent Riley Moore, Ace Parsi, Patrick Carney, and Christopher Whitcomb are running in the general election for U.S. House West Virginia District 2 on November 3, 2026.",
  },
  senate: {
    advancingCandidateIds: ["S4WV00159", "S6WV00188", "S6WV00204", "S6WV00170"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_West_Virginia,_2026",
    snippet: "General election for U.S. Senate West Virginia — Incumbent Shelley Moore Capito, Rachel Fetty Anderson, S. Marshall Wilson, and Rio Phillips are running in the general election for U.S. Senate West Virginia on November 3, 2026.",
  },
};

const WISCONSIN_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H8WI01156", "H6WI01283"],
    source_url: "https://ballotpedia.org/Wisconsin%27s_1st_Congressional_District_election,_2026",
    snippet: "Incumbent Bryan Steil and Mitchell Berman are running in the general election for U.S. House Wisconsin District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H2WI02124"],
    source_url: "https://ballotpedia.org/Wisconsin%27s_2nd_Congressional_District_election,_2026",
    snippet: "Incumbent Mark Pocan is running in the general election for U.S. House Wisconsin District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H0WI03175", "H4WI03169", "H6WI03230", "H2WI03163"],
    source_url: "https://ballotpedia.org/Wisconsin%27s_3rd_Congressional_District_election,_2026",
    snippet: "Incumbent Derrick Van Orden, Rebecca Cooke, Alexander Valiensi Kent, and Rustin Provance are running in the general election for U.S. House Wisconsin District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H4WI04183", "H4WI04274"],
    source_url: "https://ballotpedia.org/Wisconsin%27s_4th_Congressional_District_election,_2026",
    snippet: "Incumbent Gwen Moore, Tim Rogers, and Arthur Burks are running in the general election for U.S. House Wisconsin District 4 on November 3, 2026.",
  },
  "house-05": {
    advancingCandidateIds: ["H0WI05113", "H6WI05136"],
    source_url: "https://ballotpedia.org/Wisconsin%27s_5th_Congressional_District_election,_2026",
    snippet: "Incumbent Scott Fitzgerald and Andrew Beck are running in the general election for U.S. House Wisconsin District 5 on November 3, 2026.",
  },
  "house-06": {
    advancingCandidateIds: ["H4WI06048", "H6WI06274", "H6WI06241", "H6WI06233", "H6WI06191"],
    source_url: "https://ballotpedia.org/Wisconsin%27s_6th_Congressional_District_election,_2026",
    snippet: "Incumbent Glenn Grothman, Matthew Arndt, Elizabeth Fitzgibbon, and Mike Thurow are running in the general election for U.S. House Wisconsin District 6 on November 3, 2026.",
  },
  "house-07": {
    advancingCandidateIds: ["H6WI07207", "H6WI07223"],
    source_url: "https://ballotpedia.org/Wisconsin%27s_7th_Congressional_District_election,_2026",
    snippet: "Fred Clark and Michael Alfonso are running in the general election for U.S. House Wisconsin District 7 on November 3, 2026.",
  },
  "house-08": {
    advancingCandidateIds: ["H4WI08119", "H6WI08205"],
    source_url: "https://ballotpedia.org/Wisconsin%27s_8th_Congressional_District_election,_2026",
    snippet: "Incumbent Tony Wied and Rick Crosson are running in the general election for U.S. House Wisconsin District 8 on November 3, 2026.",
  },
};

const NORTH_CAROLINA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H2NC02287", "H4NC01137", "H8NC13075"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_North_Carolina,_2026",
    snippet: "Donald Davis (Incumbent) (Democratic Party); Laurie Buckhout (Republican Party); Tom Bailey (Libertarian Party)",
  },
  "house-02": {
    advancingCandidateIds: ["H0NC02125", "H4NC02135", "H6NC02205"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_North_Carolina,_2026",
    snippet: "Deborah Ross (Incumbent) (Democratic Party); Eugene Douglass (Republican Party); Matthew Laszacs (Libertarian Party)",
  },
  "house-03": {
    advancingCandidateIds: ["H0NC03172", "H6NC03229", "H6NC03237"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_North_Carolina,_2026",
    snippet: "Gregory Murphy (Incumbent) (Republican Party); Raymond Smith Jr. (Democratic Party); Daniel Cavender (Libertarian Party)",
  },
  "house-04": {
    advancingCandidateIds: ["H2NC06114", "H4NC02150", "H4NC04149"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_North_Carolina,_2026",
    snippet: "Valerie Foushee (Incumbent) (Democratic Party); Mahesh Ganorkar (Republican Party); Guy Meilleur (Libertarian Party)",
  },
  "house-05": {
    advancingCandidateIds: ["H4NC05146", "H4NC05294", "H6NC05174", "H6NC05133"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_North_Carolina,_2026",
    snippet: "Virginia Foxx (Incumbent) (Republican Party); Chuck Hubbard (Democratic Party); Robert Luffman (Libertarian Party); David Clayton (Independent)",
  },
  "house-06": {
    advancingCandidateIds: ["H4NC06177", "H6NC06164", "H6NC06149"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_North_Carolina,_2026",
    snippet: "Addison McDowell (Incumbent) (Republican Party); Cyril Jefferson (Democratic Party); Joshua Hager (Independent)",
  },
  "house-07": {
    advancingCandidateIds: ["H2NC07096", "H6NC07196", "H6NC07204", "H6NC07212"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_North_Carolina,_2026",
    snippet: "David Rouzer (Incumbent) (Republican Party); Kimberly Hardy (Democratic Party); Maad Abu-Ghazalah (Libertarian Party); Michael Henry (Independent)",
  },
  "house-08": {
    advancingCandidateIds: ["H4NC08066", "H6NC08202", "H6NC08210"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_North_Carolina,_2026",
    snippet: "Mark Harris (Incumbent) (Republican Party); Colby Watson (Democratic Party); Bo Whitehead (Green Party)",
  },
  "house-09": {
    advancingCandidateIds: ["H2NC08185", "H6NC09218", "H6NC09234"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_North_Carolina,_2026",
    snippet: "Richard Hudson (Incumbent) (Republican Party); Richard Ojeda (Democratic Party); Tita Hunter-Herod (Independent)",
  },
  "house-10": {
    advancingCandidateIds: ["H2NC13243", "H6NC10174", "H4NC10146"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_North_Carolina,_2026",
    snippet: "Pat Harrigan (Incumbent) (Republican Party); Ashley Bell (Democratic Party); Steven Feldman (Libertarian Party)",
  },
  "house-11": {
    advancingCandidateIds: ["H6NC11248", "H6NC11321", "H6NC11313", "H6NC11305"],
    source_url: "https://ballotpedia.org/North_Carolina%27s_11th_Congressional_District_election,_2026",
    snippet: "Jamie Ager, Jennifer Balkcom, Travis Groo, and John Rogers are running in the general election for U.S. House North Carolina District 11 on November 3, 2026.",
  },
  "house-12": {
    advancingCandidateIds: ["H4NC12100", "H6NC12113"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_North_Carolina,_2026",
    snippet: "Alma Adams (Incumbent) (Democratic Party); Jack Codiga (Republican Party)",
  },
  "house-13": {
    advancingCandidateIds: ["H4NC13116", "H6NC13228", "H6NC13244", "H6NC13251"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_North_Carolina,_2026",
    snippet: "Brad Knott (Incumbent) (Republican Party); Paul Barringer (Democratic Party); Anthony Aguilar (Green Party); Steven Swinton (Libertarian Party)",
  },
  "house-14": {
    advancingCandidateIds: ["H4NC14015", "H6NC14069"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_North_Carolina,_2026",
    snippet: "Timothy K. Moore (Incumbent) (Republican Party); Lakesha Womack (Democratic Party)",
  },
  senate: {
    advancingCandidateIds: ["S6NC00407", "S6NC00415", "S0NC00335", "S6NC00563"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_North_Carolina,_2026",
    snippet: "US SENATE / DUBLIN, MICHAEL LOUIS JR / 06/15/2026 ... Michael Dublin / GRE [and] US SENATE / COOPER, ROY ASBERRY III / 12/03/2025 ... Roy Cooper / DEM [and] US SENATE / BRAY, SHANNON WILSON / 12/17/2025 ... Shannon W. Bray / LIB [and] US SENATE / WHATLEY, MICHAEL DAVID / 12/02/2025 ... Michael Whatley / REP — sourced from the official NCSBE 2026 general candidate filing database (s3.amazonaws.com/dl.ncsbe.gov/Elections/2026/Candidate%20Filing/2026_general_candidate_detail_list.pdf), generated Aug 13, 2026; no 'McGinnis' or 'Shaunesi' entries appear anywhere in that 475-page, all-100-county document.",
  },
};

const MISSOURI_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H4MO01134", "H2MO02219", "H0MO08285", "H6MO01329"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Missouri,_2026",
    snippet: "Wesley Bell (Incumbent) (Democratic Party) Paul Berry (Republican Party) Tom Schmitz (Libertarian Party) Xavier Phillips (Independent)",
  },
  "house-02": {
    advancingCandidateIds: ["H2MO02102", "H6MO02343", "H4MO02116"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Missouri,_2026",
    snippet: "Ann Wagner (Incumbent) (Republican Party) Frederick Wellman (Democratic Party) Brandon Daugherty (Libertarian Party)",
  },
  "house-03": {
    advancingCandidateIds: ["H2MO03167", "H8MO09146", "H2MO02078"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Missouri,_2026",
    snippet: "Bob Onder (Incumbent) (Republican Party) Bethany Mann (Democratic Party) Jim Higgins (Libertarian Party)",
  },
  "house-04": {
    advancingCandidateIds: ["H2MO04207", "H6MO05254", "H2MO04108"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Missouri,_2026",
    snippet: "Mark Alford (Incumbent) (Republican Party) Jordan Herrera (Democratic Party) Thomas Holbrook (Libertarian Party)",
  },
  "house-05": {
    advancingCandidateIds: ["H4MO05234", "H2MO04199", "H6MO05197", "H6MO05288"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Missouri,_2026",
    snippet: "Emanuel Cleaver (Incumbent) (Democratic Party) Rick Brattin (Republican Party) Randy Langkraehr (Libertarian Party) Todd Becker (Independent)",
  },
  "house-06": {
    advancingCandidateIds: ["H6MO06310", "H6MO06260", "H2MO06269"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Missouri,_2026",
    snippet: "Josh Smead (Democratic Party) Chris Stigall (Republican Party) Andy Maidment (Libertarian Party)",
  },
  "house-07": {
    advancingCandidateIds: ["H2MO07143", "H4MO07156", "H4MO07107"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Missouri,_2026",
    snippet: "Eric Burlison (Incumbent) (Republican Party) Missi Hesketh (Democratic Party) Kevin Craig (Libertarian Party)",
  },
  "house-08": {
    advancingCandidateIds: ["H4MO08162", "H6MO08183"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Missouri,_2026",
    snippet: "Jason Smith (Incumbent) (Republican Party) Christopher Reichard (Democratic Party) Rebecca Sharpe Lombard (Libertarian Party)",
  },
};

const OHIO_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H2OH01194", "H6OH01138", "H6OH01179", "H6OH01237", "H6OH01229"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Ohio,_2026",
    snippet: "Greg Landsman  (Incumbent) (Democratic Party) Eric Conroy  (Republican Party) John Hancock  (Libertarian Party) Nathan Weise  (Libertarian Party)",
  },
  "house-02": {
    advancingCandidateIds: ["H4OH02248"],
    source_url: "https://ballotpedia.org/Ohio%27s_2nd_Congressional_District_election,_2026",
    snippet: "Incumbent David Taylor and Jen Mazzuckelli are running in the general election for U.S. House Ohio District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H2OH03125"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Ohio,_2026",
    snippet: "Joyce Beatty  (Incumbent) (Democratic Party) Cleophus Dulaney  (Republican Party)",
  },
  "house-04": {
    advancingCandidateIds: ["H6OH04082", "H6OH04181"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Ohio,_2026",
    snippet: "Jim Jordan  (Incumbent) (Republican Party) Joshua Kolasinski  (Democratic Party) Tracey Tackett  (Independent) Did not make the ballot: Tamie Wilson (Independent)",
  },
  "house-05": {
    advancingCandidateIds: ["H8OH05036", "H6OH05154", "H6OH05139"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Ohio,_2026",
    snippet: "Bob Latta  (Incumbent) (Republican Party) Brian Shaver  (Democratic Party) Michael Veloff  (Libertarian Party) Dalton Franklin  (Independent)",
  },
  "house-06": {
    advancingCandidateIds: ["H4OH06165", "H6OH06244"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Ohio,_2026",
    snippet: "Michael Rulli  (Incumbent) (Republican Party) Elizabeth Kirtley  (Democratic Party)",
  },
  "house-07": {
    advancingCandidateIds: ["H2OH16051", "H6OH07168"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Ohio,_2026",
    snippet: "Max Miller  (Incumbent) (Republican Party) Brian Poindexter  (Democratic Party) Thahbia Asad  (Independent) (Write-in) Andrey Martinichin  (Independent) (Write-in)",
  },
  "house-08": {
    advancingCandidateIds: ["H6OH08315", "H8OH08097"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Ohio,_2026",
    snippet: "Warren Davidson  (Incumbent) (Republican Party) Vanessa Enoch  (Democratic Party)",
  },
  "house-09": {
    advancingCandidateIds: ["H2OH09031", "H4OH09169"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Ohio,_2026",
    snippet: "Marcy Kaptur  (Incumbent) (Democratic Party) Derek Merrin  (Republican Party) Matthew Althaus  (Libertarian Party)",
  },
  "house-10": {
    advancingCandidateIds: ["H2OH03067", "H6OH10121"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Ohio,_2026",
    snippet: "Michael Turner  (Incumbent) (Republican Party) Kristina Knickerbocker  (Democratic Party) Thomas McMasters  (Libertarian Party)",
  },
  "house-11": {
    advancingCandidateIds: ["H2OH11169", "H6OH11186"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Ohio,_2026",
    snippet: "Shontel Brown  (Incumbent) (Democratic Party) Mike Kirchner  (Republican Party) Cortney Peterson  (Independent)",
  },
  "house-12": {
    advancingCandidateIds: ["H8OH12180", "H4OH12080"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Ohio,_2026",
    snippet: "Troy Balderson  (Incumbent) (Republican Party) Jerrad Christian  (Democratic Party)",
  },
  "house-13": {
    advancingCandidateIds: ["H2OH13264", "H6OH13307", "H6OH13273"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Ohio,_2026",
    snippet: "Emilia Sykes  (Incumbent) (Democratic Party) Carey Coleman  (Republican Party) Sandeep Dixit  (Independent)",
  },
  "house-14": {
    advancingCandidateIds: ["H2OH14064", "H6OH14248"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Ohio,_2026",
    snippet: "David Joyce  (Incumbent) (Republican Party) Maria Jukic  (Democratic Party)",
  },
  "house-15": {
    advancingCandidateIds: ["H2OH15228", "H6OH15112", "H6OH15138", "H6OH01088"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Ohio,_2026",
    snippet: "Mike Carey  (Incumbent) (Republican Party) Don Leonard  (Democratic Party) Brennan Barrington  (Libertarian Party) Samuel Ronan  (Independent) (Write-in)",
  },
  senate: {
    advancingCandidateIds: ["S6OH00304", "S6OH00163", "S6OH00429", "S6OH00395", "S8OH00144"],
    source_url: "https://ballotpedia.org/United_States_Senate_special_election_in_Ohio,_2026",
    snippet: "Incumbent Jon Husted, Sherrod Brown, Bill Redpath, Gregory Levy, and Stephen Faris are running in the special general election for U.S. Senate Ohio on November 3, 2026.",
  },
};

// 2026-08-19: 21 of the 23 remaining districts (+ Senate) added below,
// researched via 6 parallel agents cross-checking Ballotpedia's per-district
// general-election pages against FEC candidate records (matched by
// district/office/cycle fields, never by ID substring alone — Florida's
// mid-decade congressional map, signed 2026-05-04, means many candidates'
// FEC IDs carry a stale pre-redistricting district number that looks like a
// mismatch at a glance but isn't; confirmed clean via each candidate's own
// FEC record for every case flagged). FL-11 (Republican primary inside the
// automatic-recount threshold) and FL-21 (Democratic primary a disputed
// 359-vote margin, not called by Ballotpedia/AP) are deliberately NOT
// included — see pendingRaces.ts. Two ballot-vs-FEC party mismatches found
// (a candidate's official ballot line says "No Party Affiliation" but their
// FEC party_full says a major party) — same shape as the TX-27/OH-15 fix
// this same session: FL-05's William Upham and FL-24's Patricia Gonzalez
// both need their `party` field corrected post-build to match the ballot,
// not FEC's registration.
const FLORIDA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H6FL01390", "H4FL01197", "H6FL01549"],
    source_url: "https://ballotpedia.org/Florida%27s_1st_Congressional_District_election,_2026",
    snippet:
      "Incumbent Jimmy Patronis, Gay Valimont, and Tyler Davis are running in the general election for U.S. House Florida District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H6FL02331", "H6FL02299"],
    source_url: "https://ballotpedia.org/Florida%27s_2nd_Congressional_District_election,_2026",
    snippet: "Amanda Green and Austin Rogers are running in the general election for U.S. House Florida District 2 on November 3, 2026. There are no incumbents in this race.",
  },
  "house-03": {
    advancingCandidateIds: ["H0FL03175", "H6FL03099", "H6FL03149"],
    source_url: "https://ballotpedia.org/Florida%27s_3rd_Congressional_District_election,_2026",
    snippet: "Incumbent Kat Cammack, Seth Harp, and Mike Klein are running in the general election for U.S. House Florida District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H2FL04211", "H6FL05193", "H6FL04246", "H4FL04068"],
    source_url: "https://ballotpedia.org/Florida%27s_4th_Congressional_District_election,_2026",
    snippet:
      "Incumbent Aaron Bean, LaShonda Holloway, Mike Sell, and Todd Schaefer are running in the general election for U.S. House Florida District 4 on November 3, 2026.",
  },
  "house-05": {
    advancingCandidateIds: ["H6FL04105", "H6FL05250", "H6FL05292"],
    source_url: "https://ballotpedia.org/Florida%27s_5th_Congressional_District_election,_2026",
    snippet:
      "Incumbent John Rutherford, Rachel Grage, and William Upham are running in the general election for U.S. House Florida District 5 on November 3, 2026. William Upham (No Party Affiliation) (Write-in) — his FEC registration says Republican Party, but his ballot line is No Party Affiliation.",
  },
  "house-06": {
    advancingCandidateIds: ["H6FL06258", "H6FL06340", "H6FL06423"],
    source_url: "https://ballotpedia.org/Florida%27s_6th_Congressional_District_election,_2026",
    snippet:
      "Incumbent Randy Fine, Eric Yonce, Andrew Parrott, Michael Gist, and Alec Pavlik are running in the general election for U.S. House Florida District 6 on November 3, 2026. Parrott (Libertarian, unopposed) and Pavlik (No Party Affiliation, write-in) have no findable FEC registration and are excluded from this pipeline's candidate list on that basis, same as any other unregistered minor candidate.",
  },
  "house-07": {
    advancingCandidateIds: ["H6FL07215", "H6FL07231", "H6FL07249"],
    source_url: "https://ballotpedia.org/Florida%27s_7th_Congressional_District_election,_2026",
    snippet:
      "Bale Dalton, Ryan Elijah, and Christopher Dennison are running in the general election for U.S. House Florida District 7 on November 3, 2026. There are no incumbents in this race. Ryan Elijah defeated incumbent Cory Mills, Sarah Ulrich, and Michael Johnson in the Republican primary — Mills lost his own primary and is not on the general-election ballot.",
  },
  "house-09": {
    advancingCandidateIds: ["H6FL09179", "H6FL09294"],
    source_url: "https://www.wqcs.org/wqcs-news/2026-08-19/indian-river-county-primary-results-congressional-county-and-school-board-races-decided",
    snippet:
      "In the Republican primary for U.S. House District 9, Dan Green won with 25.4% of the vote, edging Ben Butler, who received 24.4%. ... Green will face Democratic incumbent Darren Soto of Kissimmee in the Nov. 4 general election. (Corroborated by Florida Politics' headline \"Dan Green emerges as GOP nominee who will face Darren Soto in CD 9\"; not yet reflected in Ballotpedia's own general-election candidate box as of 2026-08-20, recommend a follow-up check.)",
  },
  "house-08": {
    advancingCandidateIds: ["H4FL08168", "H6FL06399"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Florida,_2026",
    snippet: "This primary was canceled and this candidate advanced: Mike Haridopolos (Incumbent) ✔ ... This primary was canceled and this candidate advanced: Jennifer Jenkins ✔",
  },
  "house-10": {
    advancingCandidateIds: ["H2FL10259"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Florida,_2026",
    snippet: "The Republican Party primary was canceled. No candidates filed for this race.",
  },
  "house-18": {
    advancingCandidateIds: ["H0FL15104", "H6FL18212", "H6FL18204"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Florida,_2026",
    snippet: "This primary was canceled and this candidate advanced: Curtis Gibson ✔ ... This primary was canceled and this candidate advanced: Scott Franklin (Incumbent) ✔",
  },
  "house-26": {
    advancingCandidateIds: ["H2FL25018", "H6FL26058", "H6FL26074"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Florida,_2026",
    snippet: "This primary was canceled and this candidate advanced: Mario Diaz-Balart (Incumbent) ✔ ... This primary was canceled and this candidate advanced: Nicole Locklin ✔",
  },
  "house-28": {
    advancingCandidateIds: ["H0FL26036", "H4FL28042", "H6FL28021"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Florida,_2026",
    snippet: "This primary was canceled and this candidate advanced: Carlos Gimenez (Incumbent) ✔ ... This primary was canceled and this candidate advanced: Phil Ehr ✔",
  },
  "house-12": {
    advancingCandidateIds: ["H6FL09070", "H6FL15200", "H6FL12231"],
    source_url: "https://ballotpedia.org/Florida%27s_12th_Congressional_District_election,_2026",
    snippet:
      "Incumbent Gus M. Bilirakis, Kimberly Overman, and Branden Scrivener are running in the general election for U.S. House Florida District 12 on November 3, 2026.",
  },
  "house-13": {
    advancingCandidateIds: ["H0FL13158", "H6FL13312", "H4FL13234"],
    source_url: "https://ballotpedia.org/Florida%27s_13th_Congressional_District_election,_2026",
    snippet:
      "Incumbent Anna Paulina Luna, Leela Gray, and Tony D'Arrigo are running in the general election for U.S. House Florida District 13 on November 3, 2026.",
  },
  "house-14": {
    advancingCandidateIds: ["H6FL11126", "H6FL14237", "H6FL14245", "H4FL14166"],
    source_url: "https://ballotpedia.org/Florida%27s_14th_Congressional_District_election,_2026",
    snippet:
      "Incumbent Kathy Castor, Mike Beltran, Brian Lambert, Salomon Hernandez, and Keith Varian are running in the general election for U.S. House Florida District 14 on November 3, 2026. Keith Varian has no findable FEC registration and is excluded from this pipeline's candidate list on that basis.",
  },
  "house-15": {
    advancingCandidateIds: ["H2FL15241", "H6FL15168"],
    source_url: "https://ballotpedia.org/Florida%27s_15th_Congressional_District_election,_2026",
    snippet:
      "Incumbent Laurel Lee, Robert People, and Angie Boone are running in the general election for U.S. House Florida District 15 on November 3, 2026. Angie Boone has no findable FEC registration and is excluded from this pipeline's candidate list on that basis.",
  },
  "house-16": {
    advancingCandidateIds: ["H6FL16158", "H6FL16141", "H6FL06365"],
    source_url: "https://ballotpedia.org/Florida%27s_16th_Congressional_District_election,_2026",
    snippet:
      "Kelly Kirschner, Sydney Gruters, and Mark Davis are running in the general election for U.S. House Florida District 16 on November 3, 2026. There are no incumbents in this race.",
  },
  "house-17": {
    advancingCandidateIds: ["H8FL17053", "H4FL17060", "H6FL17081"],
    source_url: "https://ballotpedia.org/Florida%27s_17th_Congressional_District_election,_2026",
    snippet:
      "Incumbent Greg Steube, Matthew Montavon, and Michael Quirk are running in the general election for U.S. House Florida District 17 on November 3, 2026.",
  },
  "house-19": {
    advancingCandidateIds: ["H6FL19277", "H6FL19137", "H6FL19319"],
    source_url: "https://ballotpedia.org/Florida%27s_19th_Congressional_District_election,_2026",
    snippet:
      "Victor Arias, Jim Schwartzel, Seth Haskin, and Alexandra Zakhvatayev are running in the general election for U.S. House Florida District 19 on November 3, 2026. There are no incumbents in this race — Byron Donalds ran for governor instead. Alexandra Zakhvatayev has no findable FEC registration and is excluded from this pipeline's candidate list on that basis.",
  },
  "house-20": {
    advancingCandidateIds: ["H4FL20023", "H6FL20143", "H6FL20119"],
    source_url: "https://ballotpedia.org/Florida%27s_20th_Congressional_District_election,_2026",
    snippet:
      "Incumbent Debbie Wasserman Schultz, Brent Andersen, and Kedner Maxime are running in the general election for U.S. House Florida District 20 on November 3, 2026. Wasserman Schultz previously represented old FL-25 before Florida's mid-decade redistricting; she is running in newly-drawn FL-20 for 2026, not a re-election of a prior FL-20 term.",
  },
  "house-22": {
    advancingCandidateIds: ["H6FL21059", "H6FL22248"],
    source_url: "https://ballotpedia.org/Florida%27s_22nd_Congressional_District_election,_2026",
    snippet: "Pia Dandiya and Casey Askar are running in the general election for U.S. House Florida District 22 on November 3, 2026. There are no incumbents in this race.",
  },
  "house-23": {
    advancingCandidateIds: ["H2FL14053", "H2FL21132"],
    source_url: "https://ballotpedia.org/Florida%27s_23rd_Congressional_District_election,_2026",
    snippet:
      "Incumbent Lois Frankel and Deborah Adeimy are running in the general election for U.S. House Florida District 23 on November 3, 2026. Frankel previously represented old FL-22 before Florida's mid-decade redistricting; she is running in newly-drawn FL-23 for 2026.",
  },
  "house-24": {
    advancingCandidateIds: ["H6FL24095", "H6FL14203", "H6FL24061", "H2FL24052"],
    source_url: "https://ballotpedia.org/Florida%27s_24th_Congressional_District_election,_2026",
    snippet:
      "Oliver Gilbert, Te Brown, Andy Daro, and Patricia Gonzalez are running in the general election for U.S. House Florida District 24 on November 3, 2026. There are no incumbents in this race. Patricia Gonzalez (No Party Affiliation) (Write-in) — her FEC registration says Republican Party, but her ballot line is No Party Affiliation.",
  },
  "house-25": {
    advancingCandidateIds: ["H2FL22171", "H6FL23188", "H6FL25068", "H6FL23105"],
    source_url: "https://ballotpedia.org/Florida%27s_25th_Congressional_District_election,_2026",
    snippet:
      "Incumbent Jared Evan Moskowitz, Scott Singer, Peter Jassenoff, and Michaelangelo Hamilton are running in the general election for U.S. House Florida District 25 on November 3, 2026. Moskowitz previously represented old FL-22 before Florida's mid-decade redistricting.",
  },
  "house-27": {
    advancingCandidateIds: ["H8FL27185", "H6FL27098"],
    source_url: "https://ballotpedia.org/Florida%27s_27th_Congressional_District_election,_2026",
    snippet:
      "Incumbent Maria Elvira Salazar and Eliott Rodriguez are running in the general election for U.S. House Florida District 27 on November 3, 2026. Robin Peguero lost the Democratic primary to Rodriguez (53.5%-46.5%) despite raising more money, and is not on the general-election ballot.",
  },
  senate: {
    advancingCandidateIds: ["S6FL00640", "S6FL00830"],
    source_url: "https://ballotpedia.org/United_States_Senate_special_election_in_Florida,_2026",
    snippet:
      "Incumbent Ashley B. Moody, Angela Nixon, and Neil Gillespie are running in the special general election for U.S. Senate Florida on November 3, 2026. The special election will fill the vacancy left by Marco Rubio (R), who was confirmed as U.S. Secretary of State on January 20, 2025. Neil Gillespie has no findable 2026 FL Senate FEC registration (confirmed not to be P60022993, an unrelated perennial presidential candidate of the same name) and is excluded from this pipeline's candidate list on that basis.",
  },
};

// Alabama ran two primary tracks in 2026 (see electionDates.ts) but both
// feed the same Nov 3 general election field. Districts 1/2/6/7 voted in
// the Aug 11 special primary forced by the mid-decade map change (map
// permitted for 2026 by two SCOTUS interventions — see this project's own
// research notes; the underlying discrimination finding is stayed, not
// reversed, but the Nov 3 field is fixed regardless of how that eventually
// resolves). Districts 3/4/5 and the Senate race weren't affected by the
// redraw and voted on the regular May 19 primary + June 16 runoff.
const ALABAMA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H6AL01094", "H0AL01055"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Alabama,_2026",
    snippet: "Clyde Jones (Democratic Party) Jerry Carl (Republican Party)",
  },
  "house-02": {
    advancingCandidateIds: ["H4AL02170", "H6AL01086"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Alabama,_2026",
    snippet: "Shomari Figures (Incumbent) (Democratic Party) Rhett Marques (Republican Party)",
  },
  "house-03": {
    advancingCandidateIds: ["H2AL03032", "H6AL03199"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Alabama,_2026",
    snippet: "Mike Rogers (Incumbent) (Republican Party) Lee McInnis (Democratic Party)",
  },
  "house-04": {
    advancingCandidateIds: ["H6AL04098", "H6AL05228"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Alabama,_2026",
    snippet: "Robert Aderholt (Incumbent) (Republican Party) Amanda Pusczek (Democratic Party)",
  },
  "house-05": {
    advancingCandidateIds: ["H2AL05102", "H6AL05244"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Alabama,_2026",
    snippet: "Dale Strong (Incumbent) (Republican Party) Andrew Sneed (Democratic Party)",
  },
  "house-06": {
    advancingCandidateIds: ["H4AL06098", "H6AL06184"],
    source_url: "https://ballotpedia.org/Alabama%27s_6th_Congressional_District_election,_2026",
    snippet: "Incumbent Gary Palmer (R) and Maurice Mercer (D) are running in the special general election for U.S. House Alabama District 6 on November 3, 2026.",
  },
  "house-07": {
    advancingCandidateIds: ["H0AL07086", "H6AL07208"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Alabama,_2026",
    snippet: "Terri Sewell (Incumbent) (Democratic Party) Ammie Akin (Republican Party)",
  },
  senate: {
    advancingCandidateIds: ["S6AL00518", "S6AL00476"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Alabama,_2026",
    snippet: "Everett Wess and Barry Moore are running in the general election for U.S. Senate Alabama on November 3, 2026.",
  },
};

// Tennessee redrew its congressional map in a May 2026 special session; a
// three-judge federal panel denied a preliminary injunction against it in
// July 2026, explicitly allowing the map to govern both the Aug 6 primary
// and the Nov 3 general (Sherman v. Hargett merits litigation remains
// pending but nothing currently blocks the map). Several minor independent
// candidates Ballotpedia lists have no confirmed FEC record (below FEC's
// ~$5,000 registration threshold) and are simply omitted here — there's no
// FEC candidate record for advancingCandidateIds to reference either way.
const TENNESSEE_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H0TN01118", "H6TN01537", "H0TN01191"],
    source_url: "https://ballotpedia.org/Tennessee%27s_1st_Congressional_District_election,_2026",
    snippet: "The following candidates are running in the general election for U.S. House Tennessee District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H8TN02119", "H6TN02170", "H6TN02188"],
    source_url: "https://ballotpedia.org/Tennessee%27s_2nd_Congressional_District_election,_2026",
    snippet: "Incumbent Tim Burchett, Michaela Barnett, Bruce Fine, and Adam Heimerman are running in the general election for U.S. House Tennessee District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H0TN03254", "H6TN03228", "H4TN03165", "H6TN03210", "H6TN03244"],
    source_url: "https://ballotpedia.org/Tennessee%27s_3rd_Congressional_District_election,_2026",
    snippet: "The following candidates are running in the general election for U.S. House Tennessee District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H0TN04195", "H4TN04270", "H6TN04242", "H2TN06188"],
    source_url: "https://ballotpedia.org/Tennessee%27s_4th_Congressional_District_election,_2026",
    snippet: "Incumbent Scott DesJarlais, Victoria Broderick, Jacob Anders, and Clay Faircloth are running in the general election for U.S. House Tennessee District 4 on November 3, 2026.",
  },
  "house-05": {
    // No incumbent: Andy Ogles (R) lost the primary to Hatcher.
    advancingCandidateIds: ["H6TN05405", "H6TN05397", "H6TN05447"],
    source_url: "https://ballotpedia.org/Tennessee%27s_5th_Congressional_District_election,_2026",
    snippet: "Chaz Molder, Charlie Hatcher, James Johnson, and Micheal O'Leary are running in the general election for U.S. House Tennessee District 5 on November 3, 2026.",
  },
  "house-06": {
    // Open seat: incumbent John Rose did not seek re-election.
    advancingCandidateIds: ["H6TN06213", "H6TN06171", "H6TN06189"],
    source_url: "https://ballotpedia.org/Tennessee%27s_6th_Congressional_District_election,_2026",
    snippet: "Mike Croley, Johnny Garrett, Christopher Monday, and Angus Purdy are running in the general election for U.S. House Tennessee District 6 on November 3, 2026.",
  },
  "house-07": {
    // FEC also carries a stale "incumbent" record for Mark Green (H8TN07076),
    // who resigned July 20, 2025; Van Epps won the Dec 2025 special election
    // and is the real 2026 incumbent — Green doesn't appear on Ballotpedia's
    // 2026 candidate list at all, so his FEC ID is deliberately excluded.
    advancingCandidateIds: ["H6TN07161", "H6TN07286", "H6TN06288", "H6TN05330"],
    source_url: "https://ballotpedia.org/Tennessee%27s_7th_Congressional_District_election,_2026",
    snippet: "Incumbent Matt Van Epps, Darden Copeland, Andrew Koontz, and Lowell Reynolds are running in the general election for U.S. House Tennessee District 7 on November 3, 2026.",
  },
  "house-08": {
    // Kustoff's FEC ID retains a "07" code from a prior redistricting cycle;
    // FEC's own district_number field confirms his current assignment is 8.
    advancingCandidateIds: ["H2TN07103", "H6TN08367", "H6TN08383", "H6TN08391", "H6TN08342"],
    source_url: "https://ballotpedia.org/Tennessee%27s_8th_Congressional_District_election,_2026",
    snippet: "The following candidates are running in the general election for U.S. House Tennessee District 8 on November 3, 2026.",
  },
  "house-09": {
    // No incumbent: longtime Rep. Steve Cohen lost the Democratic primary to
    // Justin Pearson. This is the Memphis district at the center of the
    // redistricting dispute (majority-Black district split into three).
    advancingCandidateIds: ["H6TN09464", "H6TN09449", "H0TN09111"],
    source_url: "https://ballotpedia.org/Tennessee%27s_9th_Congressional_District_election,_2026",
    snippet: "Justin Pearson, Brent Taylor, Dennis Jeffrey Clark, and Michelle Head are running in the general election for U.S. House Tennessee District 9 on November 3, 2026.",
  },
  senate: {
    // Two FEC-registered candidates (Owen Carlson/UST, Gavin Solomon/REP) do
    // not appear on Ballotpedia's general-election list and are excluded —
    // they filed but didn't qualify for the Nov 3 ballot.
    advancingCandidateIds: ["S0TN00169", "S4TN00542", "S4TN00583", "S6TN00372", "S6TN00364", "S6TN00398", "S6TN00414"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Tennessee,_2026",
    snippet: "The following candidates are running in the general election for U.S. Senate Tennessee on November 3, 2026.",
  },
};

const TEXAS_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H2TX01112", "H6TX01352", "H6TX01345"],
    source_url: "https://ballotpedia.org/Texas%27_1st_Congressional_District_election,_2026",
    snippet: "Incumbent Nathaniel Moran, Yolanda Prince, and Sonia Canchola are running in the general election for U.S. House Texas District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H6TX02251", "H6TX08175"],
    source_url: "https://ballotpedia.org/Texas%27_2nd_Congressional_District_election,_2026",
    snippet: "Shaun Finnie and Steve Toth are running in the general election for U.S. House Texas District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H2TX00064", "H6TX03234"],
    source_url: "https://ballotpedia.org/Texas%27_3rd_Congressional_District_election,_2026",
    snippet: "Incumbent Keith Self and Evan Hunt are running in the general election for U.S. House Texas District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H0TX04219", "H6TX04174"],
    source_url: "https://ballotpedia.org/Texas%27_4th_Congressional_District_election,_2026",
    snippet: "Incumbent Pat Fallon and Jason Pearce are running in the general election for U.S. House Texas District 4 on November 3, 2026.",
  },
  "house-05": {
    advancingCandidateIds: ["H8TX05144", "H6TX05197"],
    source_url: "https://ballotpedia.org/Texas%27_5th_Congressional_District_election,_2026",
    snippet: "Incumbent Lance Gooden and Chelsey Hockett are running in the general election for U.S. House Texas District 5 on November 3, 2026.",
  },
  "house-06": {
    advancingCandidateIds: ["H8TX06266", "H6TX25203"],
    source_url: "https://ballotpedia.org/Texas%27_6th_Congressional_District_election,_2026",
    snippet: "Incumbent Jake Ellzey and Danny Minton are running in the general election for U.S. House Texas District 6 on November 3, 2026.",
  },
  "house-07": {
    advancingCandidateIds: ["H8TX07140", "H6TX07151", "H6TX07177"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Lizzie Pannill Fletcher (Incumbent) (Democratic Party) / Alexander Hale (Republican Party) / Espoir Ngabo (Green Party)",
  },
  "house-08": {
    advancingCandidateIds: ["H0TX08145", "H6TX08209"],
    source_url: "https://ballotpedia.org/Texas%27_8th_Congressional_District_election,_2026",
    snippet: "Laura Jones and Jessica Steinmann are running in the general election for U.S. House Texas District 8 on November 3, 2026.",
  },
  "house-09": {
    advancingCandidateIds: ["H6TX09231", "H6TX09140"],
    source_url: "https://ballotpedia.org/Texas%27_9th_Congressional_District_election,_2026",
    snippet: "Leticia Gutierrez and Alex Mealer are running in the general election for U.S. House Texas District 9 on November 3, 2026.",
  },
  "house-10": {
    advancingCandidateIds: ["H6TX31102", "H6TX10221"],
    source_url: "https://ballotpedia.org/Texas%27_10th_Congressional_District_election,_2026",
    snippet: "Caitlin Rourk and Chris Gober are running in the general election for U.S. House Texas District 10 on November 3, 2026.",
  },
  "house-11": {
    advancingCandidateIds: ["H0TX11230", "H6TX11112"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "August Pfluger (Incumbent) (Republican Party) / Claire Reynolds (Democratic Party)",
  },
  "house-12": {
    advancingCandidateIds: ["H4TX12065"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Craig Goldman (Incumbent) (Republican Party) / Heli Rodriguez Prilliman (Democratic Party)",
  },
  "house-13": {
    advancingCandidateIds: ["H0TX13228", "H6TX13159"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Ronny L. Jackson (Incumbent) (Republican Party) / Mark Nair (Democratic Party)",
  },
  "house-14": {
    advancingCandidateIds: ["H2TX14149", "H6TX14181"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Randy Weber (Incumbent) (Republican Party) / Thurman Bill Bartie (Democratic Party)",
  },
  "house-15": {
    advancingCandidateIds: ["H0TX15124", "H6TX15246"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Monica De La Cruz (Incumbent) (Republican Party) / Bobby Pulido (Democratic Party)",
  },
  "house-16": {
    advancingCandidateIds: ["H8TX16109", "H6TX16152"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Veronica Escobar (Incumbent) (Democratic Party) / Adam Bauman (Republican Party)",
  },
  "house-17": {
    advancingCandidateIds: ["H2TX03126", "H6TX17168"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Pete Sessions (Incumbent) (Republican Party) / Casey Shepard (Democratic Party)",
  },
  "house-18": {
    advancingCandidateIds: ["H6TX18232"],
    source_url: "https://ballotpedia.org/Texas%27_18th_Congressional_District_election,_2026",
    snippet: "Incumbent Christian Menefee and Ronald Whitfield are running in the general election for U.S. House Texas District 18 on November 3, 2026.",
  },
  "house-19": {
    advancingCandidateIds: ["H6TX19198", "H6TX19206"],
    source_url: "https://ballotpedia.org/Texas%27_19th_Congressional_District_election,_2026",
    snippet: "Kyle Rable and Tom Sell are running in the general election for U.S. House Texas District 19 on November 3, 2026.",
  },
  "house-20": {
    advancingCandidateIds: ["H2TX35011", "H6TX20113", "H2TX27273"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Joaquin Castro (Incumbent) (Democratic Party) / Edgardo Baez (Republican Party) / Anthony Tristan (Independent)",
  },
  "house-21": {
    // Dan McQueen (H0TX20124, independent) added 2026-09-01: absent from
    // this entry when first written (matching the source snippet's own
    // 2-name list at the time), but Ballotpedia's page now lists him as a
    // third general-election candidate -- independents qualify via a
    // separate petition process, not a primary, so they can be added to
    // a race's ballot well after this file's source snippet was captured.
    // Confirmed via a live FEC search: real candidate ID, correct
    // district (21), independent -- just never filed enough to have
    // financials on record, same as several already-verified candidates
    // elsewhere in this file.
    advancingCandidateIds: ["H4TX21108", "H6TX21301", "H0TX20124"],
    source_url: "https://ballotpedia.org/Texas%27_21st_Congressional_District_election,_2026",
    snippet:
      "Kristin Hook and Mark Teixeira are running in the general election for U.S. House Texas District 21 on November 3, 2026. ... Kristin Hook (D), Mark Teixeira (R), and Dan McQueen (Independent) are running in the general election for U.S. House Texas District 21 on November 3, 2026.",
  },
  "house-22": {
    advancingCandidateIds: ["H4TX22197", "H6TX22283", "H6TX22259"],
    source_url: "https://ballotpedia.org/Texas%27_22nd_Congressional_District_election,_2026",
    snippet: "Marquette Greene-Scott, Trever Nehls, and Demile James are running in the general election for U.S. House Texas District 22 on November 3, 2026.",
  },
  "house-23": {
    advancingCandidateIds: ["H6TX23273", "H4TX23120"],
    source_url: "https://ballotpedia.org/Texas%27_23rd_Congressional_District_election,_2026",
    snippet: "Katy Padilla Stout, Brandon Herrera, and Ben Mendoza are running in the general election for U.S. House Texas District 23 on November 3, 2026.",
  },
  "house-24": {
    advancingCandidateIds: ["H0TX24209", "H6TX24172"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Beth Van Duyne (Incumbent) (Republican Party) / Kevin Burge (Democratic Party)",
  },
  "house-25": {
    advancingCandidateIds: ["H2TX33040", "H6TX25237"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Roger Williams (Incumbent) (Republican Party) / Dione Sims (Democratic Party)",
  },
  "house-26": {
    advancingCandidateIds: ["H4TX26149", "H6TX26144", "H6TX01261"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Brandon Gill (Incumbent) (Republican Party) / Steven Shook (Democratic Party) / Phil Gray (Libertarian Party)",
  },
  "house-27": {
    advancingCandidateIds: ["H8TX27049", "H4TX27089", "H6TX27068"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Michael Cloud (Incumbent) (Republican Party) / Tanya Lloyd (Democratic Party) / Wayne Raasch (Independent) (Write-in)",
  },
  "house-28": {
    advancingCandidateIds: ["H2TX23082", "H6TX28124", "H6TX28108"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Henry Cuellar (Incumbent) (Democratic Party) / Tano Tijerina (Republican Party) / Marlon Duran (Green Party)",
  },
  "house-29": {
    advancingCandidateIds: ["H8TX29052", "H6TX29122"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Sylvia Garcia (Incumbent) (Democratic Party) / Martha Fierro (Republican Party)",
  },
  "house-30": {
    advancingCandidateIds: ["H6TX30245", "H6TX30211", "H6TX30237"],
    source_url: "https://ballotpedia.org/Texas%27_30th_Congressional_District_election,_2026",
    snippet: "Frederick Haynes, Everett Jackson, and Oxford Nordberg are running in the general election for U.S. House Texas District 30 on November 3, 2026.",
  },
  "house-31": {
    advancingCandidateIds: ["H2TX31044", "H6TX31094", "H6TX31169"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "John Carter (Incumbent) (Republican Party) / Justin Early (Democratic Party) / Greg Stoker (Green Party)",
  },
  "house-32": {
    advancingCandidateIds: ["H6TX32217", "H6TX32225", "H6TX32100"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Dan Barrios (Democratic Party) / Jace Yarbrough (Republican Party) / Charles Harper (Independent)",
  },
  "house-33": {
    advancingCandidateIds: ["H8TX32098", "H2TX33248"],
    source_url: "https://ballotpedia.org/Texas%27_33rd_Congressional_District_election,_2026",
    snippet: "Colin Allred and Patrick Gillespie are running in the general election for U.S. House Texas District 33 on November 3, 2026.",
  },
  "house-34": {
    advancingCandidateIds: ["H6TX15162", "H6TX34080", "H6TX34106"],
    source_url: "https://ballotpedia.org/Texas%27_34th_Congressional_District_election,_2026",
    snippet: "Incumbent Vicente Gonzalez Jr., Eric Flores, Eddie Espinoza, and Chris Royal are running in the general election for U.S. House Texas District 34 on November 3, 2026.",
  },
  "house-35": {
    advancingCandidateIds: ["H6TX35095", "H6TX35087"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Johnny Garcia (Democratic Party) / Carlos De La Cruz (Republican Party)",
  },
  "house-36": {
    advancingCandidateIds: ["H6TX02079", "H4TX14111"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Brian Babin (Incumbent) (Republican Party) / Rhonda Hart (Democratic Party)",
  },
  "house-37": {
    advancingCandidateIds: ["H2TX35144", "H6TX35038"],
    source_url: "https://ballotpedia.org/Texas%27_37th_Congressional_District_election,_2026",
    snippet: "Incumbent Greg Casar and Lauren Peña are running in the general election for U.S. House Texas District 37 on November 3, 2026.",
  },
  "house-38": {
    advancingCandidateIds: ["H4TX38011", "H6TX02244", "H6TX38123"],
    source_url: "https://ballotpedia.org/United_States_House_of_Representatives_elections_in_Texas,_2026",
    snippet: "Melissa McDonough (Democratic Party) / Jon Bonck (Republican Party) / Alex McMenemy (Green Party)",
  },
  senate: {
    advancingCandidateIds: ["S6TX00479", "S6TX00388", "S4TX00888", "S6TX00420", "S6TX00404", "S6TX00487"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Texas,_2026",
    snippet: "James Talarico (D), Ken Paxton (R), and four other candidates are running in the general election for U.S. Senate in Texas on November 3, 2026.",
  },
};

// Louisiana's Senate seat needed an actual runoff (see electionDates.ts) —
// both party primaries fell short of a majority on May 16, and the June 27
// runoff decided both nominations. Bill Cassidy (R, incumbent) lost his own
// party's primary outright and never reached the runoff.
const LOUISIANA_2026_PRIMARY: Record<string, PrimaryResult> = {
  senate: {
    advancingCandidateIds: ["S6LA00664", "S6LA00615"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Louisiana,_2026",
    snippet: "Jamie Davis (D) and Julia Letlow (R) are running in the general election for U.S. Senate Louisiana on November 3, 2026.",
  },
};

// Maine's Senate race needed a live re-check, not just the June 9 primary
// result: Democratic primary winner Graham Platner withdrew July 10, 2026
// (following a serious allegation) and the state party nominated Troy
// Jackson as his replacement at a July 25 convention — Platner's own FEC ID
// (S6ME00373) must NOT be used here, confirmed directly against Maine's
// live Ballotpedia general-election candidate box, not the primary-result
// summary alone.
const MAINE_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H8ME01120", "H4ME01160"],
    source_url: "https://ballotpedia.org/Maine%27s_1st_Congressional_District_election,_2026",
    snippet: "Incumbent Chellie Pingree and Ronald C. Russell are running in the general election for U.S. House Maine District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H6ME02171", "H6ME02148"],
    source_url: "https://ballotpedia.org/Maine%27s_2nd_Congressional_District_election,_2026",
    snippet: "Matthew Dunlap and Paul LePage are running in the general election for U.S. House Maine District 2 on November 3, 2026.",
  },
  senate: {
    advancingCandidateIds: ["S6ME00159", "S6ME00464"],
    source_url: "https://ballotpedia.org/United_States_Senate_election_in_Maine,_2026",
    snippet: "Incumbent Susan Collins (R) and Troy Dale Jackson (D) are running in the general election for U.S. Senate Maine on November 3, 2026.",
  },
};

const CALIFORNIA_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H6CA01285", "H6CA01269"],
    source_url: "https://ballotpedia.org/California%27s_1st_Congressional_District_election,_2026",
    snippet: "Incumbent James Gallagher and Mike McGuire are running in the general election for U.S. House California District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H2CA06259", "H6CA02309"],
    source_url: "https://ballotpedia.org/California%27s_2nd_Congressional_District_election,_2026",
    snippet: "Incumbent Jared Huffman and Robin Littau are running in the general election for U.S. House California District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H0CA03078", "H6CA03174"],
    source_url: "https://ballotpedia.org/California%27s_3rd_Congressional_District_election,_2026",
    snippet: "Incumbent Ami Bera and Robb Tucker are running in the general election for U.S. House California District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H8CA01109", "H6CA04222"],
    source_url: "https://ballotpedia.org/California%27s_4th_Congressional_District_election,_2026",
    snippet: "Incumbent Mike Thompson and Eric Jones are running in the general election for U.S. House California District 4 on November 3, 2026.",
  },
  "house-05": {
    advancingCandidateIds: ["H8CA04152", "H6CA05377"],
    source_url: "https://ballotpedia.org/California%27s_5th_Congressional_District_election,_2026",
    snippet: "Incumbent Tom McClintock and Michael Masuda are running in the general election for U.S. House California District 5 on November 3, 2026.",
  },
  "house-06": {
    advancingCandidateIds: ["H2CA03157", "H6CA03158"],
    source_url: "https://ballotpedia.org/California%27s_6th_Congressional_District_election,_2026",
    snippet: "Incumbent Kevin Kiley and Richard Pan are running in the general election for U.S. House California District 6 on November 3, 2026.",
  },
  "house-07": {
    advancingCandidateIds: ["H6CA05195", "H6CA07175"],
    source_url: "https://ballotpedia.org/California%27s_7th_Congressional_District_election,_2026",
    snippet: "Incumbent Doris Matsui and Mai Vang are running in the general election for U.S. House California District 7 on November 3, 2026.",
  },
  "house-08": {
    advancingCandidateIds: ["H0CA10149", "H2CA00153"],
    source_url: "https://ballotpedia.org/California%27s_8th_Congressional_District_election,_2026",
    snippet: "Incumbent John Garamendi and Rudy Recile are running in the general election for U.S. House California District 8 on November 3, 2026.",
  },
  "house-09": {
    advancingCandidateIds: ["H8CA10126", "H4CA09101"],
    source_url: "https://ballotpedia.org/California%27s_9th_Congressional_District_election,_2026",
    snippet: "Incumbent Josh Harder and John McBride are running in the general election for U.S. House California District 9 on November 3, 2026.",
  },
  "house-10": {
    advancingCandidateIds: ["H0CA10073", "H6CA10187"],
    source_url: "https://ballotpedia.org/California%27s_10th_Congressional_District_election,_2026",
    snippet: "Incumbent Mark DeSaulnier and Jeffrey Frese are running in the general election for U.S. House California District 10 on November 3, 2026.",
  },
  "house-11": {
    advancingCandidateIds: ["H6CA11268", "H8CA11116"],
    source_url: "https://ballotpedia.org/California%27s_11th_Congressional_District_election,_2026",
    snippet: "Connie Chan (D) and Scott Wiener (D) are running in the general election for California's 11th Congressional District on Nov. 3, 2026. Incumbent U.S. Rep. Nancy Pelosi (D), who was first elected in 1987, did not run for re-election.",
  },
  "house-12": {
    advancingCandidateIds: ["H4CA12154", "H6CA12209"],
    source_url: "https://ballotpedia.org/California%27s_12th_Congressional_District_election,_2026",
    snippet: "Incumbent Lateefah Simon and Jamie Joyce are running in the general election for U.S. House California District 12 on November 3, 2026.",
  },
  "house-13": {
    advancingCandidateIds: ["H2CA13115", "H4CA09093"],
    source_url: "https://ballotpedia.org/California%27s_13th_Congressional_District_election,_2026",
    snippet: "Incumbent Adam Gray and Kevin Lincoln II are running in the general election for U.S. House California District 13 on November 3, 2026.",
  },
  "house-14": {
    advancingCandidateIds: ["H6CA14163", "H0CA15213"],
    source_url: "https://ballotpedia.org/California%27s_14th_Congressional_District_election,_2026",
    snippet: "Melissa Hernandez and Aisha Wahab are running in the general election for U.S. House California District 14 on November 3, 2026.",
  },
  "house-15": {
    advancingCandidateIds: ["H2CA14162", "H6CA15194"],
    source_url: "https://ballotpedia.org/California%27s_15th_Congressional_District_election,_2026",
    snippet: "Incumbent Kevin Mullin and Charles Hoelter are running in the general election for U.S. House California District 15 on November 3, 2026.",
  },
  "house-16": {
    advancingCandidateIds: ["H4CA16197", "H6CA16176"],
    source_url: "https://ballotpedia.org/California%27s_16th_Congressional_District_election,_2026",
    snippet: "Incumbent Sam Liccardo and Peter Soule are running in the general election for U.S. House California District 16 on November 3, 2026.",
  },
  "house-17": {
    advancingCandidateIds: ["H4CA12055", "H0CA17193"],
    source_url: "https://ballotpedia.org/California%27s_17th_Congressional_District_election,_2026",
    snippet: "Incumbent Ro Khanna and Ritesh Tandon are running in the general election for U.S. House California District 17 on November 3, 2026.",
  },
  "house-18": {
    advancingCandidateIds: ["H4CA16049", "H6CA18172"],
    source_url: "https://ballotpedia.org/California%27s_18th_Congressional_District_election,_2026",
    snippet: "Incumbent Zoe Lofgren and Shane Lewis are running in the general election for U.S. House California District 18 on November 3, 2026.",
  },
  "house-19": {
    advancingCandidateIds: ["H6CA20152", "H6CA19154"],
    source_url: "https://ballotpedia.org/California%27s_19th_Congressional_District_election,_2026",
    snippet: "Incumbent Jimmy Panetta and Peter Verbica are running in the general election for U.S. House California District 19 on November 3, 2026.",
  },
  "house-20": {
    advancingCandidateIds: ["H4CA20181", "H6CA20228"],
    source_url: "https://ballotpedia.org/California%27s_20th_Congressional_District_election,_2026",
    snippet: "Incumbent Vince Fong and Sandra Van Scotter are running in the general election for U.S. House California District 20 on November 3, 2026.",
  },
  "house-21": {
    advancingCandidateIds: ["H4CA20082", "H6CA13199"],
    source_url: "https://ballotpedia.org/California%27s_21st_Congressional_District_election,_2026",
    snippet: "Incumbent Jim Costa and Kyle Kirkland are running in the general election for U.S. House California District 21 on November 3, 2026.",
  },
  "house-22": {
    advancingCandidateIds: ["H2CA20094", "H6CA22190"],
    source_url: "https://ballotpedia.org/California%27s_22nd_Congressional_District_election,_2026",
    snippet: "Incumbent David Valadao (R) and Randy Villegas (D) are running in the general election for California's 22nd Congressional District on November 3, 2026.",
  },
  "house-23": {
    advancingCandidateIds: ["H0CA08135", "H6CA23230"],
    source_url: "https://ballotpedia.org/California%27s_23rd_Congressional_District_election,_2026",
    snippet: "Incumbent Jay Obernolte and Tessa Lynn Hodge are running in the general election for U.S. House California District 23 on November 3, 2026.",
  },
  "house-24": {
    advancingCandidateIds: ["H6CA24303", "H6CA24345"],
    source_url: "https://ballotpedia.org/California%27s_24th_Congressional_District_election,_2026",
    snippet: "Incumbent Salud Carbajal and Bob Smith are running in the general election for U.S. House California District 24 on November 3, 2026.",
  },
  "house-25": {
    advancingCandidateIds: ["H2CA36439", "H6CA25219"],
    source_url: "https://ballotpedia.org/California%27s_25th_Congressional_District_election,_2026",
    snippet: "Incumbent Raul Ruiz and Joe Males are running in the general election for U.S. House California District 25 on November 3, 2026.",
  },
  "house-26": {
    advancingCandidateIds: ["H6CA26266", "H6CA26241"],
    source_url: "https://ballotpedia.org/California%27s_26th_Congressional_District_election,_2026",
    snippet: "Jacqui Irwin and Samuel Gallucci are running in the general election for U.S. House California District 26 on November 3, 2026.",
  },
  "house-27": {
    advancingCandidateIds: ["H4CA27111", "H6CA27306"],
    source_url: "https://ballotpedia.org/California%27s_27th_Congressional_District_election,_2026",
    snippet: "Incumbent George Whitesides and Jason Gibbs are running in the general election for U.S. House California District 27 on November 3, 2026.",
  },
  "house-28": {
    advancingCandidateIds: ["H0CA32101", "H4CA28127"],
    source_url: "https://ballotpedia.org/California%27s_28th_Congressional_District_election,_2026",
    snippet: "Incumbent Judy Chu and April Verlato are running in the general election for U.S. House California District 28 on November 3, 2026.",
  },
  "house-29": {
    advancingCandidateIds: ["H4CA29141", "H8CA29100"],
    source_url: "https://ballotpedia.org/California%27s_29th_Congressional_District_election,_2026",
    snippet: "Incumbent Luz Maria Rivas and Angélica María Dueñas are running in the general election for U.S. House California District 29 on November 3, 2026.",
  },
  "house-30": {
    advancingCandidateIds: ["H4CA30149", "H6CA30250"],
    source_url: "https://ballotpedia.org/California%27s_30th_Congressional_District_election,_2026",
    snippet: "Incumbent Laura Friedman and Scott Meyers are running in the general election for U.S. House California District 30 on November 3, 2026.",
  },
  "house-31": {
    advancingCandidateIds: ["H8CA39174", "H2CA39151"],
    source_url: "https://ballotpedia.org/California%27s_31st_Congressional_District_election,_2026",
    snippet: "Incumbent Gil Cisneros and Eric Ching are running in the general election for U.S. House California District 31 on November 3, 2026.",
  },
  "house-32": {
    advancingCandidateIds: ["H6CA24113", "H4CA32137"],
    source_url: "https://ballotpedia.org/California%27s_32nd_Congressional_District_election,_2026",
    snippet: "Incumbent Brad Sherman and Larry Thompson are running in the general election for U.S. House California District 32 on November 3, 2026.",
  },
  "house-33": {
    advancingCandidateIds: ["H2CA31125", "H6CA33114"],
    source_url: "https://ballotpedia.org/California%27s_33rd_Congressional_District_election,_2026",
    snippet: "Incumbent Pete Aguilar and Stephanie Vargas are running in the general election for U.S. House California District 33 on November 3, 2026.",
  },
  "house-34": {
    advancingCandidateIds: ["H8CA34266", "H6CA34286"],
    source_url: "https://ballotpedia.org/California%27s_34th_Congressional_District_election,_2026",
    snippet: "Incumbent Jimmy Gomez and Angela Gonzales-Torres are running in the general election for U.S. House California District 34 on November 3, 2026.",
  },
  "house-35": {
    advancingCandidateIds: ["H4CA35031", "H0CA35146"],
    source_url: "https://ballotpedia.org/California%27s_35th_Congressional_District_election,_2026",
    snippet: "Incumbent Norma Torres and Mike Cargile are running in the general election for U.S. House California District 35 on November 3, 2026.",
  },
  "house-36": {
    advancingCandidateIds: ["H4CA33119", "H6CA36208"],
    source_url: "https://ballotpedia.org/California%27s_36th_Congressional_District_election,_2026",
    snippet: "Incumbent Ted Lieu and Houston Brignano are running in the general election for U.S. House California District 36 on November 3, 2026.",
  },
  "house-37": {
    advancingCandidateIds: ["H2CA37304", "H6CA37339"],
    source_url: "https://ballotpedia.org/California%27s_37th_Congressional_District_election,_2026",
    snippet: "Incumbent Sydney Kamlager-Dove and Samantha Mota are running in the general election for U.S. House California District 37 on November 3, 2026.",
  },
  "house-38": {
    advancingCandidateIds: ["H6CA38139", "H4CA31212"],
    source_url: "https://ballotpedia.org/California%27s_38th_Congressional_District_election,_2026",
    snippet: "Hilda Solis and Pedro Casas are running in the general election for U.S. House California District 38 on November 3, 2026.",
  },
  "house-39": {
    advancingCandidateIds: ["H2CA43245", "H6CA39145"],
    source_url: "https://ballotpedia.org/California%27s_39th_Congressional_District_election,_2026",
    snippet: "Incumbent Mark Takano and Steve Manos are running in the general election for U.S. House California District 39 on November 3, 2026.",
  },
  "house-40": {
    advancingCandidateIds: ["H2CA37023", "H8CA39240"],
    source_url: "https://ballotpedia.org/California%27s_40th_Congressional_District_election,_2026",
    snippet: "Incumbent Ken Calvert and incumbent Young Kim are running in the general election for U.S. House California District 40 on November 3, 2026.",
  },
  "house-41": {
    advancingCandidateIds: ["H2CA39078", "H2CA38260"],
    source_url: "https://ballotpedia.org/California%27s_41st_Congressional_District_election,_2026",
    snippet: "Incumbent Linda Sánchez and Mitch Clemmons are running in the general election for U.S. House California District 41 on November 3, 2026.",
  },
  "house-42": {
    advancingCandidateIds: ["H2CA47188", "H0CA48172"],
    source_url: "https://ballotpedia.org/California%27s_42nd_Congressional_District_election,_2026",
    snippet: "Incumbent Robert Garcia and Brian Burley are running in the general election for U.S. House California District 42 on November 3, 2026.",
  },
  "house-43": {
    advancingCandidateIds: ["H4CA23011", "H6CA43188"],
    source_url: "https://ballotpedia.org/California%27s_43rd_Congressional_District_election,_2026",
    snippet: "Incumbent Maxine Waters and Cristian Morales are running in the general election for U.S. House California District 43 on November 3, 2026.",
  },
  "house-44": {
    advancingCandidateIds: ["H6CA44103", "H6CA44210"],
    source_url: "https://ballotpedia.org/California%27s_44th_Congressional_District_election,_2026",
    snippet: "Incumbent Nanette Barragán and Genevieve Angel are running in the general election for U.S. House California District 44 on November 3, 2026.",
  },
  "house-45": {
    advancingCandidateIds: ["H4CA45170", "H6CA45191"],
    source_url: "https://ballotpedia.org/California%27s_45th_Congressional_District_election,_2026",
    snippet: "Incumbent Derek Tran and Chuong Vo are running in the general election for U.S. House California District 45 on November 3, 2026.",
  },
  "house-46": {
    advancingCandidateIds: ["H6CA46116", "H4CA46137"],
    source_url: "https://ballotpedia.org/California%27s_46th_Congressional_District_election,_2026",
    snippet: "Incumbent Lou Correa and David Pan are running in the general election for U.S. House California District 46 on November 3, 2026.",
  },
  "house-47": {
    advancingCandidateIds: ["H4CA47085", "H6CA47114"],
    source_url: "https://ballotpedia.org/California%27s_47th_Congressional_District_election,_2026",
    snippet: "Incumbent Dave Min and Jenny Rae Le Roux are running in the general election for U.S. House California District 47 on November 3, 2026.",
  },
  "house-48": {
    advancingCandidateIds: ["H6CA48310", "H6CA49128"],
    source_url: "https://ballotpedia.org/California%27s_48th_Congressional_District_election,_2026",
    snippet: "Marni von Wilpert and Jim Desmond are running in the general election for U.S. House California District 48 on November 3, 2026.",
  },
  "house-49": {
    advancingCandidateIds: ["H8CA49058", "H6CA49169"],
    source_url: "https://ballotpedia.org/California%27s_49th_Congressional_District_election,_2026",
    snippet: "Incumbent Mike Levin and Armen Kurdian are running in the general election for U.S. House California District 49 on November 3, 2026.",
  },
  "house-50": {
    advancingCandidateIds: ["H2CA52089", "H6CA50324"],
    source_url: "https://ballotpedia.org/California%27s_50th_Congressional_District_election,_2026",
    snippet: "Incumbent Scott Peters and Steve Cohen are running in the general election for U.S. House California District 50 on November 3, 2026.",
  },
  "house-51": {
    advancingCandidateIds: ["H8CA49074"],
    source_url: "https://ballotpedia.org/California%27s_51st_Congressional_District_election,_2026",
    snippet: "Incumbent Sara Jacobs and Ricardo Cabrera are running in the general election for U.S. House California District 51 on November 3, 2026.",
  },
  "house-52": {
    advancingCandidateIds: ["H2CA50026", "H6CA52163"],
    source_url: "https://ballotpedia.org/California%27s_52nd_Congressional_District_election,_2026",
    snippet: "Incumbent Juan Vargas and Jeff Belle are running in the general election for U.S. House California District 52 on November 3, 2026.",
  },
};

// WA-05 and WA-08 deliberately absent: both districts' second-place general
// slot was still uncertified by Ballotpedia as of this research (Aug 15,
// 2026, 11 days post-primary) — WA-08 specifically has a genuinely
// still-tightening race between two Republicans. Held back the same way
// every other pending-result race this project has hit, not filtered to a
// guess. No WA Senate race this cycle (Murray's term runs to 2029,
// Cantwell's to 2031, both confirmed directly).
const WASHINGTON_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-01": {
    advancingCandidateIds: ["H0WA08046", "H4WA01282"],
    source_url: "https://ballotpedia.org/Washington%27s_1st_Congressional_District_election,_2026",
    snippet: "Incumbent Suzan DelBene and Mary Silva are running in the general election for U.S. House Washington District 1 on November 3, 2026.",
  },
  "house-02": {
    advancingCandidateIds: ["H0WA02080", "H6WA02228"],
    source_url: "https://ballotpedia.org/Washington%27s_2nd_Congressional_District_election,_2026",
    snippet: "Incumbent Rick Larsen and Edwin Feller are running in the general election for U.S. House Washington District 2 on November 3, 2026.",
  },
  "house-03": {
    advancingCandidateIds: ["H2WA03217", "H6WA03275"],
    source_url: "https://ballotpedia.org/Washington%27s_3rd_Congressional_District_election,_2026",
    snippet: "Incumbent Marie Gluesenkamp Perez and John Braun are running in the general election for U.S. House Washington District 3 on November 3, 2026.",
  },
  "house-04": {
    advancingCandidateIds: ["H6WA04190", "H6WA04216"],
    source_url: "https://ballotpedia.org/Washington%27s_4th_Congressional_District_election,_2026",
    snippet: "John Duresky and Amanda McKinney are running in the general election for U.S. House Washington District 4 on November 3, 2026.",
  },
  "house-06": {
    advancingCandidateIds: ["H4WA06117", "H6WA06286"],
    source_url: "https://ballotpedia.org/Washington%27s_6th_Congressional_District_election,_2026",
    snippet: "Incumbent Emily Randall and Teresa Fox are running in the general election for U.S. House Washington District 6 on November 3, 2026.",
  },
  "house-07": {
    advancingCandidateIds: ["H6WA07458", "H4WA08147"],
    source_url: "https://ballotpedia.org/Washington%27s_7th_Congressional_District_election,_2026",
    snippet: "Incumbent Pramila Jayapal and Nirav Sheth are running in the general election for U.S. House Washington District 7 on November 3, 2026.",
  },
  "house-09": {
    advancingCandidateIds: ["H6WA09025", "H4WA09061"],
    source_url: "https://ballotpedia.org/Washington%27s_9th_Congressional_District_election,_2026",
    snippet: "Incumbent D. Adam Smith and Douglas Michael Basler are running in the general election for U.S. House Washington District 9 on November 3, 2026.",
  },
  // Chris Chung (R) has no findable FEC candidate ID (checked WA-filtered and
  // nationwide by surname) -- only Strickland's ID goes in advancingCandidateIds,
  // same treatment as every other no-FEC-ID case this project has hit.
  "house-10": {
    advancingCandidateIds: ["H0WA10034"],
    source_url: "https://ballotpedia.org/Washington%27s_10th_Congressional_District_election,_2026",
    snippet: "Incumbent Marilyn Strickland and Chris Chung are running in the general election for U.S. House Washington District 10 on November 3, 2026.",
  },
};

// Utah's map was redrawn for 2026 (League of Women Voters v. Utah State
// Legislature, Third Judicial District Court, Nov 10 2025 — see
// geocode.js's UT entry for the same redistricting), which reshuffled
// three incumbents into DIFFERENT-numbered districts and left the fourth
// (Burgess Owens, old district 4) retiring rather than running anywhere in
// 2026 — confirmed via his own March 4, 2026 announcement, corroborated by
// 6 independent outlets (Deseret News, Fox News, Roll Call, KUER, Utah News
// Dispatch, KSL). Owens's FEC registration (H0UT04076) still shows
// candidate_status "C" and incumbent_challenge_full "Incumbent" with no
// filing after 2024-11-13 — exactly the "stale registration outlives the
// retirement announcement" trap this file exists to catch, same shape as
// Nebraska's Cindy Burbank and Montana's Ryan Zinke.
//
// Utah's SB54 (2014) dual-track qualification system means a candidate can
// reach the ballot via party convention OR primary signatures, sometimes
// producing a convention winner different from the eventual primary winner
// (UT-02: Karianne Lisonbee won the convention, Blake Moore won the
// primary 57.8%-42.2% and is the one who advances). All 4 districts needed
// a filter — 2 for a contested primary, the other 2 because convention
// losers and inactive/disqualified registrations still show as live FEC
// candidates even when the primary itself was uncontested.
//
// Every candidate cross-checked against THREE independent sources:
// Ballotpedia's per-district general-election page, Utah's own official
// Lieutenant Governor candidate-filing tracker (vote.utah.gov/2026-candidate-filings,
// the authoritative state ballot-status record), and the FEC candidate API
// queried by state+district+office+cycle (never by name alone). Two real
// discrepancies resolved in the state tracker's favor over Ballotpedia:
// Bryan Lamont Arrington (UT-02) appears on Ballotpedia's general-election
// list but nowhere at all in the state's official filing tracker, so he's
// excluded pending direct state confirmation; Jacob Paul Gottfredson
// (UT-04) is on Ballotpedia's list but the state tracker explicitly marks
// him "Disqualified." Two ballot-confirmed candidates (Elias Montgomery,
// UT-01 Unaffiliated; Taylor Wright, UT-04 Libertarian) have no findable
// FEC registration under any search — same treatment as every other
// no-FEC-ID case this project has hit (Washington's Chris Chung, Montana's
// Nick Sheedy): they were never in this pipeline's candidate list to begin
// with, independent of this filter, so they don't appear below either.
const UTAH_2026_PRIMARY: Record<string, PrimaryResult> = {
  // Open seat — Owens (old district 4 incumbent) retired rather than run
  // here or anywhere in 2026. Democratic primary was contested (McAdams
  // beat Blouin/Mohamed/Farrell); Republican side settled entirely at
  // convention (Owen beat Fonua/Lopez/Robinson), so the primary was
  // canceled — convention losers still needed excluding from FEC's list.
  "house-01": {
    advancingCandidateIds: ["H8UT04053", "H6UT01244", "H6UT01251"],
    source_url: "https://ballotpedia.org/Utah%27s_1st_Congressional_District_election,_2026",
    snippet:
      "Ben McAdams defeated Katie Blouin, Nabeela Mohamed, and Alex Farrell in the Democratic primary for U.S. House Utah District 1 on June 23, 2026 ... Riley Owen defeated Stoney Fonua, Jonathan Lopez, and David Robinson in the Republican convention ... Jesse West (Libertarian) is also running in the general election.",
  },
  // Republican primary contested: Moore (incumbent, moved here from old
  // district 1 under the new map) beat convention-winner Lisonbee in the
  // primary itself, 57.8%-42.2%. Two candidates excluded beyond the
  // primary loser: John R. Gibb Jr. (R) is a phantom FEC registration with
  // no committee and no appearance on Ballotpedia or the state tracker;
  // Bryan Lamont Arrington (Independent) is on Ballotpedia's list but
  // absent from Utah's own official filing tracker entirely, so excluded
  // pending direct state confirmation rather than trusted on Ballotpedia
  // alone.
  "house-02": {
    advancingCandidateIds: ["H0UT01205", "H6UT01160", "H4UT01165", "H6UT02531", "H6UT02549"],
    source_url: "https://ballotpedia.org/Utah%27s_2nd_Congressional_District_election,_2026",
    snippet:
      "Incumbent Blake Moore defeated Karianne Lisonbee in the Republican primary for U.S. House Utah District 2 on June 23, 2026, 57.8% (44,300) to 42.2% (32,380) ... Democratic primary was canceled. Peter Crosby advanced ... Daniel Cottam (Libertarian), Robert Michael Moesinger (Unaffiliated), and Carlton E. Bowen (Independent American Party) are also running in the general election.",
  },
  // Republican primary contested: Maloy (incumbent, moved here from old
  // district 2) beat Lyman 68.1%-31.9%. Democratic side settled at
  // convention (Udell beat Merrill), primary then canceled.
  "house-03": {
    advancingCandidateIds: ["H4UT02296", "H6UT03182", "H2UT02506", "H6UT03224", "H6UT03174", "H6UT03216"],
    source_url: "https://ballotpedia.org/Utah%27s_3rd_Congressional_District_election,_2026",
    snippet:
      "Incumbent Celeste Maloy defeated Mike Lyman in the Republican primary for U.S. House Utah District 3 on June 23, 2026, 68.1% (55,031) to 31.9% (25,726) ... Kent Udell defeated Steve Merrill in the Democratic convention, and the Democratic primary was canceled ... Cassie Easley (Constitution), Michael Ray Stoddard (Libertarian), Adonis Hooslyn (Unaffiliated), and Ayden Tate Scott (Unaffiliated) are also running in the general election.",
  },
  // Both parties' primaries were uncontested/canceled after convention
  // (Kennedy — moved here from old district 3 — and Larsen each won their
  // respective conventions outright), so no vote-count narrowing was
  // needed here, but two other exclusions were: Burgess Owens's stale
  // "Incumbent" FEC registration (see file header — he retired and isn't
  // on the 2026 ballot in any district) and Jacob Paul Gottfredson
  // (Unaffiliated), whom Utah's own filing tracker marks "Disqualified"
  // even though Ballotpedia still lists him as a general-election
  // candidate.
  "house-04": {
    advancingCandidateIds: ["H4UT03260", "H6UT02424", "H6UT04024"],
    source_url: "https://ballotpedia.org/Utah%27s_4th_Congressional_District_election,_2026",
    snippet:
      "Republican primary was canceled. Incumbent Mike Kennedy advanced ... Jonny Larsen defeated Archie Williams III in the Democratic convention, and the Democratic primary was canceled ... Steven Burt (Unaffiliated) is also running in the general election.",
  },
};

// Wyoming's 2026 primary (Aug 18) — AP results via NPR, 99% reporting as of
// Aug 19 9:03pm. House: Chuck Gray (R) won a crowded 9-way field with a
// 25.4% plurality; Lisa Kinney (D) won 77.9%-22.1% over Elena Del Real (not
// independently confirmed in FEC's data, so not something to add here —
// she lost regardless). Senate: Harriet Hageman (R) won 64.9%-27.8% over
// Sam Mead; James Byrd (D) won 79.3%-20.7% over Billy Benavidez. Hageman's
// House-race FEC registration (H2WY00166) is a stale historical ID from an
// earlier campaign — she did not appear anywhere in the 2026 House primary
// results, only Senate, so she's correctly excluded from house-AL's
// advancing list. Two other pre-narrowing candidates (Owen Nicholas
// Carlson, Daniel Verl Workman) never appeared in the primary results at
// all under either race — same non-finding as Carlson's other multi-state
// filings noted elsewhere in this file, treated as not on the general
// ballot rather than a data gap.
const WYOMING_2026_RESULTS_URL = "https://apps.npr.org/primary-election-results-2026/states/WY.html";
const WYOMING_2026_PRIMARY: Record<string, PrimaryResult> = {
  "house-AL": {
    advancingCandidateIds: ["H6WY00217", "H6WY01173"],
    source_url: WYOMING_2026_RESULTS_URL,
    snippet:
      "U.S. House DISTRICT 1 DEMOCRATIC PRIMARY 99% of results in: Lisa Kinney 77.9% 9,343 — Elena Del Real 22.1% 2,657. REPUBLICAN PRIMARY 99% of results in: Chuck Gray 25.4% 31,222 — Steve Friess 20.4% 25,054 — Kevin Christensen 17.6% 21,632 — Jillian Balow 10.3% 12,590 — Reid Rasner 8.8% 10,807 — David Giralt 8.3% 10,130 — Bo Biteman 5.1% 6,255 — Keith Goodenough 2.7% 3,341 — Richard Dodson 1.4% 1,777.",
  },
  senate: {
    advancingCandidateIds: ["S6WY00209", "S6WY00217"],
    source_url: WYOMING_2026_RESULTS_URL,
    snippet:
      "U.S. Senate REPUBLICAN PRIMARY 99% of results in: Harriet Hageman 64.9% 83,794 — Sam Mead 27.8% 35,875 — Jimmy Skovgard 2.7% 3,525 — Jill Edwards 2.7% 3,431 — John Holtz 2.0% 2,539. DEMOCRATIC PRIMARY 99% of results in: James Byrd 79.3% 9,589 — Billy Benavidez 20.7% 2,497.",
  },
};

export function getPrimaryFilter(state: string, raceSlug: string, cycle: number): PrimaryResult | null {
  if (state === "AL" && cycle === 2026) return ALABAMA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "TN" && cycle === 2026) return TENNESSEE_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "TX" && cycle === 2026) return TEXAS_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "LA" && cycle === 2026) return LOUISIANA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "ME" && cycle === 2026) return MAINE_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "CA" && cycle === 2026) return CALIFORNIA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "WA" && cycle === 2026) return WASHINGTON_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "MT" && cycle === 2026) return MONTANA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "WY" && cycle === 2026) return WYOMING_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "VT" && cycle === 2026) return VERMONT_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "AK" && cycle === 2026) return ALASKA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "ND" && cycle === 2026) return NORTH_DAKOTA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "SD" && cycle === 2026) return SOUTH_DAKOTA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "NY" && cycle === 2026) return NEW_YORK_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "GA" && cycle === 2026) return GEORGIA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "PA" && cycle === 2026) return PENNSYLVANIA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "MI" && cycle === 2026) return MICHIGAN_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "AZ" && cycle === 2026) return ARIZONA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "KY" && cycle === 2026) return KENTUCKY_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "CO" && cycle === 2026) return COLORADO_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "IL" && cycle === 2026) return ILLINOIS_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "AR" && cycle === 2026) return ARKANSAS_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "CT" && cycle === 2026) return CONNECTICUT_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "IN" && cycle === 2026) return INDIANA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "IA" && cycle === 2026) return IOWA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "MN" && cycle === 2026) return MINNESOTA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "NJ" && cycle === 2026) return NEW_JERSEY_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "NE" && cycle === 2026) return NEBRASKA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "OK" && cycle === 2026) return OKLAHOMA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "UT" && cycle === 2026) return UTAH_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "KS" && cycle === 2026) return KANSAS_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "HI" && cycle === 2026) return HAWAII_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "ID" && cycle === 2026) return IDAHO_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "NV" && cycle === 2026) return NEVADA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
if (state === "MD" && cycle === 2026) return MARYLAND_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "MS" && cycle === 2026) return MISSISSIPPI_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "NM" && cycle === 2026) return NEW_MEXICO_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "OR" && cycle === 2026) return OREGON_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "SC" && cycle === 2026) return SOUTH_CAROLINA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "VA" && cycle === 2026) return VIRGINIA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "WV" && cycle === 2026) return WEST_VIRGINIA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "WI" && cycle === 2026) return WISCONSIN_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "NC" && cycle === 2026) return NORTH_CAROLINA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "MO" && cycle === 2026) return MISSOURI_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "OH" && cycle === 2026) return OHIO_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  if (state === "FL" && cycle === 2026) return FLORIDA_2026_PRIMARY[raceSlug] ?? getAutoPrimaryResult(state, raceSlug, cycle);
  return getAutoPrimaryResult(state, raceSlug, cycle);
}
