// The House Clerk's Office of the Historian publishes one official "Concise
// Biography" paragraph per member — birthplace, exact DOB, high school,
// college, all in a single authoritative government sentence. Richer than
// the Congress.gov API (which only exposes birthYear) and not available
// anywhere else we've found. House members only — the Senate has no
// equivalent single clean page; Senate.gov defers to bioguide.congress.gov,
// which sits behind a live Cloudflare bot-challenge (confirmed via a 403
// with "Cf-Mitigated: challenge") that this project won't try to bypass.
//
// The URL is constructed directly from data already in hand (last name,
// first name, bioguideId) rather than searched — history.house.gov's own
// citation footer reveals the exact slug pattern. Names that don't fit this
// pattern (suffixes, compound surnames, etc.) will 404, which the LLM
// extraction layer already treats as "no data here" like any other optional
// source in this pipeline — no special-casing needed.
export function buildHouseHistorianUrl(congressGovName: string, bioguideId: string): string | null {
  const [lastRaw, restRaw] = congressGovName.split(",").map((s) => s.trim());
  if (!lastRaw || !restRaw) return null;
  const firstName = restRaw.split(/\s+/)[0];
  const lastName = lastRaw.toUpperCase();
  const firstLetter = lastName[0];
  if (!firstLetter) return null;
  return `https://history.house.gov/People/Listing/${firstLetter}/${encodeURIComponent(lastName)},-${encodeURIComponent(firstName)}-(${bioguideId})/`;
}
