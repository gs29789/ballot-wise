import Anthropic from "@anthropic-ai/sdk";
import { fetchPageText, discoverBioLinks, COMMON_BIO_PATHS } from "./llmExtract.js";

// A fourth content category alongside bio facts (llmExtract.ts), platform
// (campaignPlatform.ts), and video (campaignVideo.ts) — deliberately
// separate from bio facts rather than added as an 8th EXTRACTABLE_FIELD
// there: bio facts are also extracted from House Historian and Wikipedia
// pages, but this is specifically "in the candidate's own words, from their
// own site" — the same reason platform is its own module rather than a
// bio field. Reuses llmExtract.ts's page-fetch and bio-page-discovery
// (same nav-link + fixed-path approach, same pages a candidate's real bio
// content lives on) rather than duplicating that logic.
//
// Quote-anchored like everything else in this pipeline: the "summary" is
// not an LLM paraphrase, it's the single most representative VERBATIM
// excerpt from the page — the model picks and trims, it doesn't rewrite.
// This keeps the same "presented as-is, not characterized by Ballot-Wise"
// posture as platform positions, and the same hallucination guard (the
// returned text must be a real, checkable substring of the source page).

export interface BioSummaryResult {
  summary: string;
  sourceUrl: string;
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function normalizeSmartPunctuation(s: string): string {
  return s
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ");
}

// The model's "verbatim" reproduction can drift from the source in more
// ways than just quote/dash style (confirmed on a real candidate, John
// Brendan Williams/AK-AL: a whitespace-run difference somewhere mid-excerpt
// shifted everything after it by one character, so a naive
// offset-plus-excerpt-length slice landed one character short and split
// "and" into "a" + " nd" -- a real, silent corruption, not a source typo).
// Trusting the excerpt's own length for the END of the span is exactly what
// breaks whenever length drifts anywhere before that point. Anchoring
// independently on the START and END of the excerpt (each normalized, each
// searched for on its own) is robust to that: the true span only needs
// those two anchors to be locatable, not the entire middle to be identical
// length. Anchor length is capped at the excerpt's own length so a short
// excerpt just anchors on itself, same as before.
function recoverOriginalSpan(pageText: string, excerpt: string): string | null {
  const ANCHOR_LEN = 30;
  const normalizedPage = normalizeSmartPunctuation(pageText);
  const normalizedExcerpt = normalizeSmartPunctuation(excerpt);
  const anchorLen = Math.min(ANCHOR_LEN, normalizedExcerpt.length);

  const startAnchor = normalizedExcerpt.slice(0, anchorLen);
  const startOffset = normalizedPage.indexOf(startAnchor);
  if (startOffset === -1) return null;

  const endAnchor = normalizedExcerpt.slice(-anchorLen);
  const endOffset = normalizedPage.indexOf(endAnchor, startOffset);
  if (endOffset === -1) return null;

  return pageText.slice(startOffset, endOffset + endAnchor.length);
}

const SYSTEM_PROMPT = `You select a single representative excerpt introducing a political candidate, from their own campaign website's text, for a voter-information product. Follow these rules exactly:

1. Find the single most representative, self-contained passage (roughly 5-8 sentences, 500-900 characters — enough to read as a real paragraph, not a tagline) that introduces who this candidate is — background, career, or what drives their candidacy. Prefer an "About"/"Meet [Name]"/biography-style passage over a policy-issues passage if both exist on the page. If the richest matching passage on the page is shorter than this, use what's there rather than padding it — never combine text from different parts of the page to reach the target length (that would violate rule 2 below).
2. The excerpt must be VERBATIM — an exact, contiguous, character-for-character substring copied from the provided text. Do not paraphrase, summarize in your own words, condense, or combine text from different parts of the page into one passage.
3. Never use anything from your own training knowledge about this person — only what is literally present in the provided text.
4. If the page is clearly about a different person than the one named, or contains no biographical/introductory passage at all (e.g., only a donation form or an issues list with no "About" content), return null. A shared name is not enough to confirm identity — when an expected context is given (a specific office and state), the page must be consistent with that context; a same-named person in a different context is a collision, not a match.
5. Output ONLY valid JSON matching this exact shape, no other text:
{
  "matchesExpectedCandidate": true | false,
  "excerpt": "verbatim text, exactly as it appears on the page" | null
}`;

async function extractFromPage(candidateName: string, page: { text: string; finalUrl: string }, expectedContext?: string): Promise<BioSummaryResult | null> {
  const { text: pageText, finalUrl } = page;
  const contextLine = expectedContext ? `Expected context: ${expectedContext}. If the page describes a same-named person outside this context, treat it as a different person per rule 4.\n` : "";

  let message;
  try {
    message = await getClient().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: `Candidate name: ${candidateName}\n${contextLine}Source URL: ${finalUrl}\n\nPage text:\n${pageText}` }],
    });
  } catch (err: any) {
    console.warn(`[campaignBioSummary] Anthropic API call failed for "${candidateName}" (${finalUrl}): ${err?.message ?? err}`);
    return null;
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  try {
    const jsonText = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const parsed = JSON.parse(jsonText);
    if (!parsed.matchesExpectedCandidate || !parsed.excerpt) return null;
    // Guard against a hallucinated "verbatim" excerpt the same way every
    // other extractor in this pipeline does — reject rather than trust.
    // Confirmed on a real candidate (Bill Hill, AK-AL): the model asked for
    // an exact substring still silently normalized a curly apostrophe
    // ("Dena’ina", U+2019) to a straight one ("Dena'ina", U+0027) — the
    // content was entirely real and correctly quoted, this was purely a
    // typographic-normalization reflex, not a fabrication. A byte-exact
    // check would reject perfectly good excerpts on any site using smart
    // punctuation, which is most professionally designed ones. Rather than
    // just loosen the check, recover the actual original span: normalize
    // is a strict 1-char-for-1-char substitution (never changes length), so
    // an offset found in the normalized page text is the same offset in the
    // real one — slice the ORIGINAL page text there instead of trusting the
    // model's possibly-normalized copy, so the stored citation is always a
    // byte-exact match to the source, never a silently rewritten one.
    if (pageText.includes(parsed.excerpt)) return { summary: parsed.excerpt, sourceUrl: finalUrl };
    const recovered = recoverOriginalSpan(pageText, parsed.excerpt);
    if (!recovered) return null;
    return { summary: recovered, sourceUrl: finalUrl };
  } catch {
    return null;
  }
}

export async function extractBioSummaryFromSite(candidateName: string, baseUrl: string, expectedContext?: string): Promise<BioSummaryResult | null> {
  const homepagePage = await fetchPageText(baseUrl).catch(() => null);
  if (!homepagePage) return null;

  const homepage = await extractFromPage(candidateName, homepagePage, expectedContext).catch(() => null);
  if (homepage) return homepage;

  const resolvedBase = homepagePage.finalUrl;
  const candidateUrls = [
    ...new Set([...COMMON_BIO_PATHS.map((p) => new URL(p, resolvedBase).toString()), ...discoverBioLinks(homepagePage.html, resolvedBase)]),
  ];
  for (const url of candidateUrls) {
    const page = await fetchPageText(url).catch(() => null);
    if (!page) continue;
    const result = await extractFromPage(candidateName, page, expectedContext).catch(() => null);
    if (result) return result;
  }
  return null;
}
