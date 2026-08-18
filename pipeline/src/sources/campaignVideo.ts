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

// Before trusting a resolved channel, confirm its own title/description
// (already fetched above, zero extra quota) actually looks like this
// candidate's campaign — a linked channel could be a personal/family
// channel with a generic name rather than a campaign one. Fails closed to
// "no video found" for this candidate, the same honest gap as any other
// missing field elsewhere on the site.
function channelPassesTrustCheck(channel: { title: string; description: string }, candidateName: string, state: string): boolean {
  const lastName = (candidateName.split(",")[0] ?? "").trim().toLowerCase();
  const haystack = `${channel.title} ${channel.description}`.toLowerCase();
  if (lastName.length > 1 && haystack.includes(lastName)) return true;
  if (/\bfor (?:congress|senate|house)\b/.test(haystack)) return true;
  if (state && haystack.includes(state.toLowerCase())) return true;
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

async function getVideoTitle(videoId: string): Promise<string | null> {
  const data = await youtubeGet("videos", { part: "snippet", id: videoId }).catch(() => null);
  return data?.items?.[0]?.snippet?.title ?? null;
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
  state: string,
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
        // A direct video link is the site's own explicit choice — no
        // channel-trust check applies, there's no channel here to check.
        const title = await getVideoTitle(shape.videoId).catch(() => null);
        if (!title) continue;
        return { videoId: shape.videoId, videoUrl: `https://www.youtube.com/watch?v=${shape.videoId}`, videoTitle: title, sourceUrl: page.finalUrl };
      }

      const channel = await resolveChannel(shape).catch(() => null);
      if (!channel || !channel.uploadsPlaylistId) continue;
      if (!channelPassesTrustCheck(channel, candidateName, state)) continue;

      const uploads = await getUploads(channel.uploadsPlaylistId).catch(() => []);
      const picked = pickPlatformVideo(uploads);
      if (!picked) continue;

      return { videoId: picked.videoId, videoUrl: `https://www.youtube.com/watch?v=${picked.videoId}`, videoTitle: picked.title, sourceUrl: page.finalUrl };
    }
  }
  return null;
}
