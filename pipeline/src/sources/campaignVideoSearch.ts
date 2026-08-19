import { youtubeGet, wordBoundaryMatch, decodeHtmlEntities } from "./campaignVideo.js";

// Tier 2: finds a campaign video by searching YouTube directly, for
// candidates Tier 1 (campaignVideo.ts) couldn't find one for — either they
// have no known campaign site, or their site simply doesn't link video.
//
// Deliberately kept separate from Tier 1, not merged into it: this module
// has a materially weaker trust posture (a search result has no site to
// anchor identity to — Tier 1's whole reason for needing zero identity
// checks doesn't hold here) and a materially higher quota cost
// (search.list is 100 units/call vs ~1-3 for everything Tier 1 uses,
// capping this at roughly 90-100 candidates per day against the free
// 10,000-unit/day quota — see scaleVideoTier2.ts for the pacing that
// enforces that).

// Stricter than Tier 1's passesNameCheck in TWO ways, not one. (1) Requires
// the explicit "for Congress/Senate/House" phrase — a bare last-name match
// alone is NOT accepted, confirmed necessary by Tier 1's own audits
// repeatedly catching third-party news coverage that name-checks a
// candidate without being their own content. (2) Requires the phrase AND
// the candidate's own last name to BOTH appear — not either/or. A bare
// phrase check alone is unsound for the same underlying reason Tier 1's
// old bare state-code check was: it doesn't verify the phrase is actually
// ABOUT this candidate. Caught for real during Tier 2's first live batch —
// Suzanne Seymour (VT) matched a channel called "Corey for Congress" whose
// video was literally titled "Matthew Corey Candidate Forum Opening
// Remarks" — a different candidate's own channel and video, wrongly
// attributed to Seymour because "for congress" appeared in a shared-forum
// context. Requiring both conditions together closes this without
// loosening the phrase requirement itself.
function passesStrictTrustCheck(text: string, candidateName: string): boolean {
  const lastName = (candidateName.split(",")[0] ?? "").trim().toLowerCase();
  const haystack = text.toLowerCase();
  const hasPhrase = /\bfor (?:congress|senate|house)\b/.test(haystack);
  const hasName = lastName.length > 1 && wordBoundaryMatch(haystack, lastName);
  return hasPhrase && hasName;
}

function displayName(fecName: string): string {
  const [last, rest] = fecName.split(",");
  return rest ? `${rest.trim()} ${last.trim()}` : fecName;
}

function buildSearchQuery(candidateName: string, office: "H" | "S", stateName: string): string {
  const officeLabel = office === "S" ? "Senate" : "Congress";
  return `"${displayName(candidateName)}" for ${officeLabel} ${stateName}`;
}

export interface Tier2VideoResult {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  channelTitle: string;
}

export async function searchCampaignVideo(candidateName: string, office: "H" | "S", stateName: string): Promise<Tier2VideoResult | null> {
  const query = buildSearchQuery(candidateName, office, stateName);
  const data = await youtubeGet("search", { part: "snippet", q: query, type: "video", maxResults: "5" });
  // youtubeGet returns null on any non-ok response (quota exhaustion, a
  // transient network error, etc.) — indistinguishable, if silently
  // accepted here, from "the search genuinely ran and found nothing that
  // passed the trust check." That distinction matters a lot to a caller
  // pacing a daily backlog: confirmed for real (2026-08-19, a same-day
  // third manual test run after the daily quota was already spent by two
  // earlier real batches) — every one of 90 candidates hit a 429, and
  // without this throw, scaleVideoTier2.ts would have marked all 90 as
  // "searched, nothing found" and deferred them a full 30 days despite
  // never actually being checked. Throwing here lets the caller tell a
  // real failure apart from a genuine negative result.
  if (data === null) throw new Error("YouTube search API call failed — see the [campaignVideo] warning above for the actual reason (quota, network, etc.)");
  const items: any[] = data.items ?? [];

  for (const item of items) {
    const snippet = item.snippet;
    const videoId = item.id?.videoId;
    if (!snippet || !videoId) continue;
    const haystack = `${snippet.title ?? ""} ${snippet.description ?? ""} ${snippet.channelTitle ?? ""}`;
    if (!passesStrictTrustCheck(haystack, candidateName)) continue;
    return {
      videoId,
      videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
      videoTitle: decodeHtmlEntities(snippet.title ?? ""),
      channelTitle: decodeHtmlEntities(snippet.channelTitle ?? ""),
    };
  }
  return null;
}
