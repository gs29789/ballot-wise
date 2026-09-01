// Real, on-the-ballot general-election candidates who are structurally
// invisible to this pipeline's normal candidate sourcing, because that
// sourcing is entirely FEC-filing-based (searchCandidates() in fec.ts) and
// a candidate only has to register with the FEC once they raise or spend
// over $5,000 -- a threshold plenty of genuine minor-party/independent
// candidates never cross, especially state-convention nominees running
// minimal, largely self-funded campaigns. Found via a real case (Bobby
// Wilson, AR-3 Libertarian, missing from our AR-3 data despite running in
// both 2024 and 2026 and having a real campaign site) surfaced by the
// user cross-checking Ballotpedia's own race page against ours.
//
// Every entry here is hand-verified against Ballotpedia's own
// General-election candidate table for that specific race (confirming
// they're on the ballot, not withdrawn/primary-only) AND a real,
// independent FEC search confirming zero results -- never auto-inserted
// from a raw Ballotpedia scrape without that second check, since a
// pending-but-not-yet-indexed FEC filing would otherwise look identical
// to a genuinely FEC-absent candidate.
//
// scanMissingCandidates.ts's LLM-driven scan (2026-09-01, 73 races) was
// tried as a way to find these at scale and turned out to be a weak
// signal even after a prompt fix for its dominant failure mode (reading a
// primary-results table and mistaking a losing primary candidate for a
// general-election one): of 9 flagged names across 6 races, only 1
// (Bruce Fine, TN-2) held up. Worse, it completely missed a real one
// (Angus Purdy, TN-6) that surfaced only from manually re-reading that
// race's page while checking a different, false flag. Net: automated
// flags are a lead to manually verify against Ballotpedia directly, same
// as any other one here -- never a basis for insertion on their own, and
// not something to trust for recall either.
//
// Consumed by build.ts: appended to a race's candidate list AFTER the
// normal FEC-driven build, with every FEC-dependent field (financials,
// recent_votes, performance, bioguide_id) left null/empty rather than
// guessed -- exactly how the frontend already renders sparse data for a
// low-file candidate ("Not on file"), so no frontend change was needed.
export interface MissingCandidate {
  full_name: string; // "LAST, FIRST MIDDLE" -- same convention as FEC-sourced names, so slugify() behaves identically
  party: string; // matches this project's existing party-string convention, e.g. "LIBERTARIAN PARTY"
  incumbent: boolean;
  source_url: string;
  snippet: string;
  campaign_site_url?: string | null;
}

export const MISSING_CANDIDATES: Record<string, Record<string, MissingCandidate[]>> = {
  AR: {
    "house-03": [
      {
        full_name: "WILSON, BOBBY",
        party: "LIBERTARIAN PARTY",
        incumbent: false,
        source_url: "https://ballotpedia.org/Arkansas'_3rd_Congressional_District_election,_2026",
        snippet:
          "Incumbent Steve Womack, Robb Ryerse, and Bobby Wilson are running in the general election for U.S. House Arkansas District 3 on November 3, 2026. ... Bobby Wilson (L) are running in the general election... Bobby Wilson (L) advanced from the Libertarian Party convention for U.S. House Arkansas District 3 on February 22, 2026.",
        campaign_site_url: "https://bobbyforcongress.mydurable.com/",
      },
    ],
  },
  TN: {
    "house-02": [
      {
        full_name: "FINE, BRUCE",
        party: "INDEPENDENT",
        incumbent: false,
        source_url: "https://ballotpedia.org/Bruce_Fine",
        snippet:
          "Incumbent Tim Burchett (R), Michaela Barnett (D), Bruce Fine (Independent), and Adam Heimerman (Independent) are running in the general election for U.S. House Tennessee District 2 on November 3, 2026.",
        campaign_site_url: "https://fineforcongresstn.com/",
      },
    ],
    "house-06": [
      {
        full_name: "PURDY, ANGUS",
        party: "INDEPENDENT",
        incumbent: false,
        source_url: "https://ballotpedia.org/Angus_Purdy",
        snippet:
          "Mike Croley (D), Johnny Garrett (R), Christopher Monday (Independent), and Angus Purdy (Independent) are running in the general election for U.S. House Tennessee District 6 on November 3, 2026.",
        campaign_site_url: null,
      },
    ],
  },
  UT: {
    "house-02": [
      {
        // Has two real FEC filings (H6UT02499, H6UT02481) but neither
        // surfaces via searchCandidates() -- an unusually-structured
        // committee (a combined "Wendover Mayor and Utah House Seat
        // District 2" filing) rather than a stale primaryResults.ts entry
        // like TX-21's Dan McQueen, so treated as a verified-override
        // case rather than a fixable query bug.
        full_name: "ARRINGTON, BRYAN LAMONT",
        party: "INDEPENDENT",
        incumbent: false,
        source_url: "https://ballotpedia.org/Bryan_Lamont_Arrington",
        snippet:
          "Blake Moore (R), Peter Crosby (D), Carlton Bowen (Independent American Party of Utah), Daniel Cottam (L), Robert Moesinger (Unaffiliated), Bryan Lamont Arrington (Independent) -- The following candidates are running in the general election for U.S. House Utah District 2 on November 3, 2026.",
        // Ballotpedia's only listed "Campaign website" for him is a
        // Change.org petition page (change.org/BRYANARRINGTON2028, tied to
        // his separate 2028 presidential candidacy) -- not a real campaign
        // site with his own platform content, so left null rather than
        // forced in.
        campaign_site_url: null,
      },
    ],
  },
};
