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
};
