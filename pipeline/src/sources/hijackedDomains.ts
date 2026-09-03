// Campaign domains that have lapsed and been re-registered by someone else.
//
// This is not a data-quality nicety. A candidate's `campaign_site_url` is
// rendered on their profile as their own official site, so a hijacked
// domain means Ballot-Wise actively sends a voter from a real candidate's
// page to whatever now sits there -- under that candidate's name, with our
// endorsement of it as "their site". Every entry below was confirmed by
// fetching the URL and reading where it actually lands (2026-09-03); all
// four currently serve Indonesian gambling/"togel" spam, and two belong to
// sitting members of Congress.
//
// Deliberately a denylist of specific hosts rather than an automated rule.
// The obvious rule -- "flag any campaign site that redirects off its own
// domain" -- was measured against the live dataset and matched 51 sites, of
// which the overwhelming majority are ordinary campaign rebrands
// (jessforphilly.com -> jessforcongress.com, votejohnrutherford.com ->
// johnrutherfordforcongress.com). Auto-suppressing those would remove far
// more real sites than bad ones. Content-sniffing for spam keywords was
// also considered and rejected: it would put this pipeline in the business
// of judging what a candidate's site is allowed to contain.
//
// Recheck periodically. A hijack can be reversed if a campaign recovers its
// domain, in which case the entry should be removed rather than kept
// forever -- these are claims about a domain's current state, not a
// permanent judgement about the candidate.
export const HIJACKED_DOMAINS = new Set([
  "lukebronin.com", // -> togel-singapore-hongkong-sidney.org (Bronin, CT-1)
  "electjimbaird.com", // -> controldeplagas.pe, "TOGEL ONLINE / OLXTOTO" (Rep. Baird, IN-4)
  "maxinewatersforcongress.com", // -> annabisnatural.mx, "COLOKSGP Situs Toto Slot" (Rep. Waters, CA-43)
  "lipetriforcongress.com", // -> codingtorque.com, "ZALO88 Situs Game" (Lipetri, NY-3)
]);

// True when a URL's host is a known-hijacked campaign domain. Matches
// subdomains too, so a stray "www." or a hijacker's subdomain can't slip a
// denied host through.
export function isHijackedDomain(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    for (const denied of HIJACKED_DOMAINS) {
      if (host === denied || host.endsWith(`.${denied}`)) return true;
    }
    return false;
  } catch {
    return false;
  }
}
