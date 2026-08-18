import { fetchPageText } from "./llmExtract.js";

// Tier 1 only: finds a campaign video exclusively via a link already
// present on the candidate's own campaign site — never a broad YouTube
// search. Because every hit here comes from a page the pipeline already
// trusts as the candidate's own, there's no same-name-collision judgment
// call to make (unlike every sibling extraction module, which all carry
// an expectedContext LLM check for exactly that reason), so this module
// makes zero Anthropic API calls. A broader search-based fallback for
// candidates with no linked channel was explicitly deferred, not built
// here.

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";

function youtubeApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new Error("YOUTUBE_API_KEY not set");
  return key;
}

async function youtubeGet(endpoint: string, params: Record<string, string>): Promise<any | null> {
  const url = new URL(`${YOUTUBE_API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", youtubeApiKey());
  const res = await fetch(url.toString());
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(`[campaignVideo] YouTube API ${endpoint} failed (${res.status}): ${body.slice(0, 200)}`);
    return null;
  }
  return res.json();
}

// A campaign site can link YouTube four different ways, and the Data API
// only resolves two of them by parameter (id, forHandle, forUsername) —
// there's no filter for legacy /c/CustomName vanity URLs at all.
type YouTubeLinkShape =
  | { kind: "video"; videoId: string }
  | { kind: "channelId"; id: string }
  | { kind: "handle"; handle: string }
  | { kind: "username"; username: string }
  | { kind: "customUrl"; url: string };

function classifyYouTubeUrl(url: string): YouTubeLinkShape | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (/^(?:www\.)?youtu\.be$/i.test(u.hostname)) {
    const videoId = u.pathname.slice(1).split("/")[0];
    return videoId ? { kind: "video", videoId } : null;
  }
  const path = u.pathname;
  const watchId = u.searchParams.get("v");
  if (watchId && /\/watch/.test(path)) return { kind: "video", videoId: watchId };
  let m: RegExpMatchArray | null;
  if ((m = path.match(/^\/shorts\/([\w-]{6,})/))) return { kind: "video", videoId: m[1] };
  if ((m = path.match(/^\/embed\/([\w-]{6,})/))) return { kind: "video", videoId: m[1] };
  if ((m = path.match(/^\/channel\/(UC[\w-]{10,})/))) return { kind: "channelId", id: m[1] };
  if ((m = path.match(/^\/@([\w.-]+)/))) return { kind: "handle", handle: m[1] };
  if ((m = path.match(/^\/user\/([\w-]+)/))) return { kind: "username", username: m[1] };
  if ((m = path.match(/^\/c\/([\w-]+)/))) return { kind: "customUrl", url };
  // A bare single-segment path ("/SomeName") is also a legacy vanity URL
  // shape — excludes YouTube's own non-channel top-level pages.
  if ((m = path.match(/^\/([\w.-]+)\/?$/)) && !["watch", "results", "playlist", "feed"].includes(m[1])) {
    return { kind: "customUrl", url };
  }
  return null;
}

interface ChannelInfo {
  title: string;
  description: string;
  uploadsPlaylistId: string | null;
}

async function getChannelByFilter(filter: "id" | "forHandle" | "forUsername", value: string): Promise<ChannelInfo | null> {
  const data = await youtubeGet("channels", { part: "snippet,contentDetails", [filter]: value }).catch(() => null);
  const item = data?.items?.[0];
  if (!item) return null;
  return {
    title: item.snippet?.title ?? "",
    description: item.snippet?.description ?? "",
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads ?? null,
  };
}

// The single most fragile piece of this module — depends on YouTube's own
// page markup rather than a versioned API parameter, since no API filter
// exists for this URL shape. Fails closed (null) rather than trying
// harder, deliberately, to stay clear of anything resembling a search.
async function resolveChannelIdFromCustomUrl(url: string): Promise<string | null> {
  const page = await fetchPageText(url).catch(() => null);
  if (!page) return null;
  const m = page.html.match(/<meta itemprop="channelId" content="([^"]+)"/) ?? page.html.match(/"channelId":"(UC[0-9A-Za-z_-]{10,})"/);
  return m ? m[1] : null;
}

async function resolveChannel(shape: Exclude<YouTubeLinkShape, { kind: "video" }>): Promise<ChannelInfo | null> {
  switch (shape.kind) {
    case "channelId":
      return getChannelByFilter("id", shape.id);
    case "handle":
      return getChannelByFilter("forHandle", `@${shape.handle}`);
    case "username":
      return getChannelByFilter("forUsername", shape.username);
    case "customUrl": {
      const channelId = await resolveChannelIdFromCustomUrl(shape.url);
      return channelId ? getChannelByFilter("id", channelId) : null;
    }
  }
}

// Before trusting a resolved video, confirm SOMETHING in its own record —
// channel title/description, or the video's own title/description — looks
// like this candidate's campaign, not a personal/family channel, a news
// outlet's clip, or an unrelated video that happened to be linked/embedded
// somewhere on the page. Fails closed to "no video found" for this
// candidate, the same honest gap as any other missing field on the site.
//
// Word-boundary matched, not a raw .includes() substring check. Two real,
// confirmed false positives drove this: (1) a bare 2-letter state code is
// unsound even word-boundary-matched against a candidate's LAST NAME
// alone — "ME" (Maine) matched inside the word "America" via a plain
// substring check, so the state check was dropped entirely as its own
// pass condition, it was never more than weak circumstantial evidence;
// (2) a *direct* video link previously skipped this check altogether on
// the theory that the campaign site's own linking choice was authoritative
// by itself — in practice this let through videos with no connection to
// the candidate at all (a WordPress theme's tutorial video, a record
// label's music video, a local TV news clip), almost certainly because
// discoverYouTubeLinks() can pick up an unrelated embed elsewhere on the
// page, not something the campaign deliberately chose to feature.
function wordBoundaryMatch(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
}

function passesNameCheck(text: string, candidateName: string): boolean {
  const lastName = (candidateName.split(",")[0] ?? "").trim().toLowerCase();
  const haystack = text.toLowerCase();
  if (lastName.length > 1 && wordBoundaryMatch(haystack, lastName)) return true;
  if (/\bfor (?:congress|senate|house)\b/.test(haystack)) return true;
  return false;
}

export interface ChannelVideo {
  videoId: string;
  title: string;
  publishedAt: string;
}

async function getUploads(uploadsPlaylistId: string): Promise<ChannelVideo[]> {
  const data = await youtubeGet("playlistItems", { part: "snippet", playlistId: uploadsPlaylistId, maxResults: "50" }).catch(() => null);
  const items = data?.items ?? [];
  return items
    .map((it: any) => ({
      videoId: it.snippet?.resourceId?.videoId,
      title: it.snippet?.title ?? "",
      publishedAt: it.snippet?.publishedAt ?? "",
    }))
    .filter((v: ChannelVideo) => v.videoId);
}

interface VideoSnippet {
  title: string;
  description: string;
  channelTitle: string;
}

async function getVideoSnippet(videoId: string): Promise<VideoSnippet | null> {
  const data = await youtubeGet("videos", { part: "snippet", id: videoId }).catch(() => null);
  const snippet = data?.items?.[0]?.snippet;
  if (!snippet?.title) return null;
  return { title: snippet.title, description: snippet.description ?? "", channelTitle: snippet.channelTitle ?? "" };
}

// Deterministic, local, zero additional API cost: first video (uploads
// come back most-recent-first) whose title looks like stated-positions
// content, mirroring campaignPlatform.ts's own LINK_KEYWORDS approach to
// the same underlying question — falls back to the most recent upload.
// This is a title heuristic, not content verification: nothing confirms
// the video's actual spoken content matches its title, unlike the
// bio/platform pipeline's snippet-must-substantiate-value rule.
const VIDEO_TITLE_KEYWORDS = /platform|\bplan\b|\bissues?\b|priorit|\bposition|agenda|\bpolic|\bstand\b|vision|promise|why (?:i'm|i am) running/i;

export function pickPlatformVideo(videos: ChannelVideo[]): ChannelVideo | null {
  if (!videos.length) return null;
  return videos.find((v) => VIDEO_TITLE_KEYWORDS.test(v.title)) ?? videos[0];
}

// Same idea as campaignPlatform.ts's discoverPlatformLinks, but the
// same-origin restriction that's correct there must be DROPPED here — a
// real hit is always cross-origin (a campaign site linking to
// youtube.com), unlike a platform page living on the campaign's own
// domain. Hostname matched exactly, not with .includes(), which a
// hostname like "evilyoutube.com" would also match.
const YOUTUBE_HOSTS = /^(?:www\.|m\.)?(?:youtube\.com|youtu\.be)$/i;

export function discoverYouTubeLinks(html: string, baseUrl: string): string[] {
  const links = new Set<string>();
  const linkRegex = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html))) {
    try {
      const resolvedUrl = new URL(match[1], baseUrl);
      if (!YOUTUBE_HOSTS.test(resolvedUrl.hostname)) continue;
      resolvedUrl.hash = "";
      links.add(resolvedUrl.toString());
    } catch {
      // malformed/relative-scheme href (mailto:, javascript:, etc.) — skip
    }
  }
  return [...links];
}

export interface CampaignVideoResult {
  videoId: string;
  videoUrl: string;
  videoTitle: string;
  sourceUrl: string;
}

export async function findCampaignVideoFromSite(
  baseUrl: string,
  candidateName: string,
  extraPageUrl?: string | null
): Promise<CampaignVideoResult | null> {
  const pagesToCheck = [baseUrl, ...(extraPageUrl && extraPageUrl !== baseUrl ? [extraPageUrl] : [])];

  for (const pageUrl of pagesToCheck) {
    const page = await fetchPageText(pageUrl).catch(() => null);
    if (!page) continue;

    for (const link of discoverYouTubeLinks(page.html, page.finalUrl)) {
      const shape = classifyYouTubeUrl(link);
      if (!shape) continue;

      if (shape.kind === "video") {
        // Still name-checked, even though the campaign site linked this
        // exact video directly — a real, confirmed failure mode: a video
        // with zero connection to the candidate (a WordPress theme demo, a
        // record label's music video, a local news clip) can be picked up
        // by discoverYouTubeLinks() from elsewhere on the page without
        // being the campaign's own deliberate choice.
        const snippet = await getVideoSnippet(shape.videoId).catch(() => null);
        if (!snippet) continue;
        if (!passesNameCheck(`${snippet.title} ${snippet.description} ${snippet.channelTitle}`, candidateName)) continue;
        return { videoId: shape.videoId, videoUrl: `https://www.youtube.com/watch?v=${shape.videoId}`, videoTitle: snippet.title, sourceUrl: page.finalUrl };
      }

      const channel = await resolveChannel(shape).catch(() => null);
      if (!channel || !channel.uploadsPlaylistId) continue;
      if (!passesNameCheck(`${channel.title} ${channel.description}`, candidateName)) continue;

      const uploads = await getUploads(channel.uploadsPlaylistId).catch(() => []);
      const picked = pickPlatformVideo(uploads);
      if (!picked) continue;

      return { videoId: picked.videoId, videoUrl: `https://www.youtube.com/watch?v=${picked.videoId}`, videoTitle: picked.title, sourceUrl: page.finalUrl };
    }
  }
  return null;
}
