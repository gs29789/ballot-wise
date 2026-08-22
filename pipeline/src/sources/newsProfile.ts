import Anthropic from "@anthropic-ai/sdk";
import { extractBioFacts, type ExtractionResult } from "./llmExtract.js";

// Pilot source: finds structured bio facts (date_of_birth, birthplace,
// high_school, etc.) via a local-news "meet the candidate" profile, for
// candidates whose own campaign site never states them explicitly. Kept as
// two separate calls rather than one search+extract call: the search step's
// only job is to find a URL, then the EXISTING extractBioFacts() does the
// actual extraction — same verbatim-quote-must-appear-in-fetched-page
// hallucination guard already used for Historian/Wikipedia/campaign-site
// pages. A single combined call would extract straight from web_search's
// own citation text, which is capped at 150 characters per citation — too
// short to independently verify a full quoted fact against.

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SEARCH_SYSTEM_PROMPT = `You find a single news article that profiles a specific political candidate — ideally a "meet the candidate" feature, campaign-announcement story, or biographical piece from a local newspaper, TV station, or similar outlet. Not a debate recap, an opponent's attack piece, or a bare event listing — a piece that actually describes who this person is.

Use the web_search tool to find it. A shared name is not enough — the article must match the candidate's specific office and state given below; if search results turn up a same-named person in a different context, that's a different person, keep looking or return null.

When you're done searching, respond with ONLY this JSON on the last line, no other text before or after it:
{"url": "https://..."} or {"url": null} if nothing suitable was found`;

async function findLocalNewsUrl(candidateName: string, expectedContext: string): Promise<string | null> {
  let message;
  try {
    message = await getClient().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: SEARCH_SYSTEM_PROMPT,
      tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      messages: [{ role: "user", content: `Candidate: ${candidateName}\nContext: ${expectedContext}` }],
    });
  } catch (err: any) {
    console.warn(`[newsProfile] search call failed for "${candidateName}": ${err?.message ?? err}`);
    return null;
  }

  // Claude's response can interleave multiple text blocks around the search
  // tool calls (a "let me search for..." preamble, then the search
  // results, then the final answer) — the requested JSON is only in the
  // LAST text block, not necessarily the first one a naive .find() would hit.
  const textBlocks = message.content.filter((b) => b.type === "text");
  const lastText = textBlocks[textBlocks.length - 1];
  if (!lastText || lastText.type !== "text") return null;

  try {
    const jsonMatch = lastText.text.match(/\{[^{}]*"url"[^{}]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return typeof parsed.url === "string" ? parsed.url : null;
  } catch {
    return null;
  }
}

export interface NewsProfileResult extends ExtractionResult {
  newsUrl: string;
}

export async function findNewsBioFacts(candidateName: string, expectedContext: string): Promise<NewsProfileResult | null> {
  const url = await findLocalNewsUrl(candidateName, expectedContext);
  if (!url) return null;
  const result = await extractBioFacts(candidateName, url, expectedContext).catch(() => null);
  if (!result) return null;
  return { ...result, newsUrl: url };
}
