import Anthropic from "@anthropic-ai/sdk";
import { fetchPageText } from "./llmExtract.js";

// Extracts a candidate's own stated policy positions/promises from their
// campaign site — e.g. Whalen's site has a "MY PROMISES — What I Will Fight
// For" section with per-issue statements. Deliberately separate from
// llmExtract.ts's bio extraction: this is a different content category
// (stated positions, not personal facts) with its own extraction shape, but
// reuses the same page-fetch (redirect-following included) and the same
// hard-won citation rule — every "value" must be fully supported by its own
// "snippet", nothing summarized in from elsewhere on the page. This is
// presented as a direct quote of what the candidate says about themselves,
// not a characterization or evaluation of their positions — same neutral,
// source-everything posture as the rest of this pipeline.

export interface PlatformPosition {
  topic: string;
  value: string;
  snippet: string;
}

export interface PlatformResult {
  positions: PlatformPosition[];
  sourceUrl: string;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `You extract a political candidate's own stated campaign positions/promises from a single source page's text. Follow these rules exactly:

1. Only extract a position if you can quote the text (verbatim, character-for-character, an exact contiguous substring copied from the provided text) that states it. Never infer, summarize from general knowledge, or paraphrase into a "quote."
2. CRITICAL — "value" must not contain ANY claim that is not explicitly stated in "snippet". Do not summarize the candidate's overall stance on a topic from scattered parts of the page and attach one short snippet — every fact in "value" must be traceable to text physically present in "snippet". A short, fully-supported value is correct; a longer value with any unsupported claim is not.
3. Extract each DISTINCT issue/topic as its own entry (e.g. immigration, economy, healthcare) — do not merge unrelated topics into one entry. Skip generic campaign-trail language ("vote for me", "join our movement") that isn't an actual position or promise.
4. Never use anything from your own training knowledge about this person or this topic — only what is literally present in the provided text.
5. If the page is clearly about a different person than the one named, or states no actual policy positions, return an empty array.
6. If an expected context is given (a specific office and state), and the page is clearly for a same-named person outside that context, treat it as a different person — return an empty array.
7. Extract at most 8 positions — if more are listed, keep the most substantive ones.
8. Output ONLY valid JSON matching this exact shape, no other text:
{
  "matchesExpectedCandidate": true | false,
  "positions": [
    {"topic": "short topic label, e.g. Immigration", "value": "concise statement of their position", "snippet": "verbatim quoted text"}
  ]
}`;

async function attemptExtraction(candidateName: string, url: string, expectedContext?: string): Promise<PlatformResult | null> {
  const page = await fetchPageText(url);
  if (!page) return null;
  const { text: pageText, finalUrl } = page;

  const contextLine = expectedContext ? `Expected context: ${expectedContext}. If the page describes a same-named person outside this context, treat it as a different person per rule 6.\n` : "";

  // See the identical comment in llmExtract.ts's extractBioFacts — every
  // caller here also swallows failures via .catch(() => null), so a failing
  // Anthropic call (bad key, no credit, rate limit) needs to log here or it
  // silently reads as "this candidate stated no platform positions."
  let message;
  try {
    message = await getClient().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Candidate name: ${candidateName}\n${contextLine}Source URL: ${finalUrl}\n\nPage text:\n${pageText}`,
        },
      ],
    });
  } catch (err: any) {
    console.warn(`[campaignPlatform] Anthropic API call failed for "${candidateName}" (${finalUrl}): ${err?.message ?? err}`);
    return null;
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  try {
    const jsonText = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const parsed = JSON.parse(jsonText);
    if (!parsed.matchesExpectedCandidate) return null;
    const positions: PlatformPosition[] = (parsed.positions ?? []).filter(
      (p: any) => p && typeof p.value === "string" && typeof p.snippet === "string" && pageText.includes(p.snippet)
    );
    return { positions, sourceUrl: finalUrl };
  } catch {
    return null;
  }
}

const PLATFORM_PATHS = ["/platform", "/issues", "/priorities", "/where-i-stand", "/agenda", "/policies"];

export async function extractPlatformFromSite(candidateName: string, baseUrl: string, expectedContext?: string): Promise<PlatformResult | null> {
  const homepage = await attemptExtraction(candidateName, baseUrl, expectedContext).catch(() => null);
  if (homepage && homepage.positions.length) return homepage;

  // See the identical comment in llmExtract.ts's extractBioFactsFromSite —
  // confirmed on this exact candidate (Reid Rasner): reidrasner.com/issues
  // redirects to rasnerforwy.com's bare homepage, not rasnerforwy.com/issues,
  // so paths must be built from where the homepage fetch actually landed.
  const resolvedBase = homepage?.sourceUrl ?? baseUrl;
  for (const path of PLATFORM_PATHS) {
    const url = new URL(path, resolvedBase).toString();
    const result = await attemptExtraction(candidateName, url, expectedContext).catch(() => null);
    if (result && result.positions.length) return result;
  }
  return null;
}
