import Anthropic from "@anthropic-ai/sdk";
import { fetchPageText } from "./llmExtract.js";

// Ballotpedia.org has real, curated candidate profiles (a "Biography"
// section plus structured Elections/Education info), but a direct
// name-based search for a candidate's own page is unreliable: Ballotpedia
// covers every level of government, so a common name collides constantly
// (confirmed on a real candidate, John Peterson of SC-6: a direct search
// burned its whole search budget chasing an unrelated same-named North
// Charleston City Council candidate before running out of tries, and
// separately turned up the RACE's own overview page without ever finding
// the individual candidate link on it).
//
// The fix: search for the RACE's own Ballotpedia page instead of the
// candidate's — "South Carolina's 6th Congressional District, 2026" has
// no name-collision risk at all, unlike a person's name — then
// deterministically parse that page's own results table for the specific
// candidate's link. Confirmed directly: that race page's HTML contains
// exactly `<a href="https://ballotpedia.org/John_Peterson_(South_Carolina)">
// John Peterson</a>` in its own general-election results block.
//
// allowRedirect must be FALSE when fetching a Ballotpedia page
// specifically (see fetchDistrictPage below) -- confirmed this site's
// pages embed some unrelated script/tracking redirect that
// fetchPageText's generic single-hop-follow logic (built for legitimate
// campaign-site landing-page redirects) mistakes for the real navigation
// target, landing on a generic "/Thank_you" interstitial instead of the
// real content. Every other caller of fetchPageText in this pipeline
// wants redirects followed; this one specifically does not.

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const RACE_PAGE_SYSTEM_PROMPT = `You find a specific U.S. congressional race's own Ballotpedia.org page using web search (not a candidate's individual page — the page covering the whole race, listing all its candidates). Follow these rules exactly:

1. Only return a URL on ballotpedia.org for the race's own election page (typically titled like "[State]'s [Nth] Congressional District election, 2026" for House or "United States Senate election in [State], 2026" for Senate).
2. If you cannot confidently find it, return null — do not guess.

Output ONLY valid JSON, no other text:
{"url": "https://ballotpedia.org/..." | null}`;

export async function findRacePage(raceDescription: string): Promise<string | null> {
  let message;
  try {
    message = await getClient().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: RACE_PAGE_SYSTEM_PROMPT,
      tools: [{ type: "web_search_20260318" as any, name: "web_search", max_uses: 4 } as any],
      messages: [{ role: "user", content: `Race: ${raceDescription}` }],
    });
  } catch (err: any) {
    console.warn(`[ballotpedia] race-page search failed for "${raceDescription}": ${err?.message ?? err}`);
    return null;
  }

  const textBlock = [...message.content].reverse().find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  try {
    const jsonText = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const parsed = JSON.parse(jsonText);
    if (typeof parsed.url !== "string" || !parsed.url.includes("ballotpedia.org")) return null;
    return parsed.url;
  } catch {
    return null;
  }
}

export async function fetchDistrictPage(url: string) {
  return fetchPageText(url, false);
}

// Matches an <a href="https://ballotpedia.org/...">Candidate Name</a> link
// whose visible text plausibly matches the given name — loose on purpose
// (first+last token overlap, case-insensitive) since Ballotpedia's own
// link text is always the candidate's real display name, not a guessed
// slug, so there's little collision risk once we're already scoped to
// this one race's own page.
function findCandidateLink(html: string, candidateName: string): string | null {
  const nameTokens = candidateName
    .toLowerCase()
    .split(/[\s,]+/)
    .filter((t) => t.length > 1);
  const linkRegex = /<a\s+href="(https:\/\/ballotpedia\.org\/[^"]+)">([^<]+)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html))) {
    const [, href, linkText] = match;
    const linkLower = linkText.toLowerCase();
    if (nameTokens.every((t) => linkLower.includes(t))) return href;
  }
  return null;
}

// raceDescription: a plain-language description of the race for the
// web-search step, e.g. "South Carolina's 6th Congressional District
// election, 2026" or "United States Senate election in Texas, 2026" —
// callers already have exactly this shape of string on hand (or can build
// one trivially from state/office/district), so it's taken as-is rather
// than reconstructed here from raw state/office/district codes, which
// would need to replicate Ballotpedia's own ordinal/possessive URL
// quirks (a fragile guess this module deliberately avoids — see the
// header comment).
export async function findBallotpediaUrl(candidateName: string, raceDescription: string): Promise<string | null> {
  const racePageUrl = await findRacePage(raceDescription);
  if (!racePageUrl) return null;

  const page = await fetchDistrictPage(racePageUrl).catch(() => null);
  if (!page) return null;

  return findCandidateLink(page.html, candidateName);
}
