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
  sourceType: "campaign_site" | "wikipedia";
}

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

function escapeRegexChar(ch: string): string {
  return /[.*+?^${}()|[\]\\]/.test(ch) ? "\\" + ch : ch;
}

// Builds a regex that matches an anchor against the REAL page text while
// tolerating the specific typographic drift the model's "verbatim"
// reproduction is prone to — three distinct patterns confirmed on three
// real Wikipedia articles: Colin Allred (TX-33 candidate), where the real
// text reads "...Attorneys . Allred..." with a stray space BEFORE a
// trailing period; Terri Sewell (AL-7 candidate), where a nickname renders
// as '" Terri "' with stray spaces INSIDE the quote marks on BOTH sides;
// and Sara Jacobs (CA candidate), where an inline citation marker is
// interspersed mid-sentence -- "Sara Josephine Jacobs [ 2 ] (born
// February 1, 1989) is..." -- that the model's clean quote correctly
// omits entirely (it's a footnote reference, not part of the actual
// biographical prose), but which the old plain-substring check required
// byte-for-byte. None of these are one-off — they're structural patterns
// in how Wikipedia's own rendering works (a link/citation ending
// mid-sentence; a quoted nickname or parenthetical; a citation reference
// that can appear after nearly any factual claim), likely to recur across
// many articles, sometimes more than one per excerpt. A single BOUNDARY
// pattern placed everywhere a whitespace run could occur handles all
// three at once: zero or more of {a whitespace character, OR one complete
// bracketed citation marker like "[ 12 ]"} — so it swallows plain
// whitespace drift AND any number of interspersed citation markers in the
// same spot. Quote/bracket/sentence-punctuation characters get this
// boundary inserted on BOTH sides regardless of whether the anchor itself
// has a space there, since the drift can appear on either side. Matching
// this way, directly against the untouched pageText, also sidesteps the
// previous approach's real bug: normalizing both sides then slicing the
// ORIGINAL text using offsets found in the NORMALIZED one is only safe if
// normalization never changes length, but collapsing a whitespace RUN
// does exactly that -- there's no separate normalized copy here to drift
// out of sync with.
const FUZZY_PUNCTUATION = ",.;:!?()[]\"'";
const BOUNDARY = "(?:\\s|\\[\\s*\\d+\\s*\\])*";
// A parenthetical the model kept part of (usually "(born DATE)") can have
// EXTRA content Wikipedia inserted right after the opening paren that the
// model's clean quote drops entirely — confirmed on Sharice Davids (KS
// candidate): the real text is "Davids ( / ʃəˈriːs / ; [ 1 ] born May 22,
// 1980) is..." with a full IPA pronunciation guide and a citation marker
// squeezed between "(" and "born", while the model quoted just "(born
// May 22, 1980)". Unlike a citation marker, this content is arbitrary
// (phonetic symbols, alternate spellings) — not describable by a fixed
// character class — so instead of trying to enumerate it, allow a
// non-greedy skip of anything up to the next closing paren right after an
// opening one. Non-greedy means it only consumes what it must: an anchor
// with no extra content to skip still matches with zero extra characters.
function buildFuzzyPattern(anchor: string): string {
  const normalized = anchor.replace(/[‘’‛]/g, "'").replace(/[“”‟]/g, '"').replace(/[–—]/g, "-");
  let pattern = "";
  for (const ch of normalized) {
    if (/\s/.test(ch)) {
      if (!pattern.endsWith(BOUNDARY)) pattern += BOUNDARY;
    } else if (ch === "(") {
      if (!pattern.endsWith(BOUNDARY)) pattern += BOUNDARY;
      pattern += "\\(" + BOUNDARY + "(?:[^)]*?)";
    } else if (FUZZY_PUNCTUATION.includes(ch)) {
      if (!pattern.endsWith(BOUNDARY)) pattern += BOUNDARY;
      pattern += escapeRegexChar(ch) + BOUNDARY;
    } else {
      pattern += escapeRegexChar(ch);
    }
  }
  return pattern;
}

// Anchoring independently on the START and END of the excerpt (each
// fuzzy-matched per buildFuzzyPattern above) is robust to drift anywhere
// in the MIDDLE: the true span only needs those two anchors to be
// locatable in the real text, not the entire passage to be byte-identical
// to what the model quoted. But a person's own name -- exactly what a
// START anchor usually consists of -- legitimately appears more than once
// on a real Wikipedia page: confirmed on Sara Jacobs (CA candidate),
// where "Sara Josephine Jacobs" appears first inside a raw, leaked
// TemplateData/module JSON blob, second in the infobox's compact
// "Name ( ISO-date ) display-date (age N)" rendering, and only THIRD in
// the actual flowing lead-paragraph prose the model quoted from ("...
// (born February 1, 1989) is an American politician..."). Taking just the
// FIRST occurrence of the start anchor (the old behavior) locks onto the
// wrong one -- neither the JSON blob nor the infobox extends into the
// following ~600+ characters of real biographical prose, so the end
// anchor search from there correctly finds nothing and the whole
// extraction was wrongly discarded. Fix: try every occurrence of the
// start anchor in order, and for each one, look for the end anchor within
// a bounded window after it (capped generously relative to the excerpt's
// own length, so stray-whitespace inflation is absorbed without letting a
// short decoy match force scanning arbitrarily far into the rest of the
// page) -- the first occurrence where both anchors actually line up wins.
function recoverOriginalSpan(pageText: string, excerpt: string): string | null {
  const ANCHOR_LEN = 30;
  const anchorLen = Math.min(ANCHOR_LEN, excerpt.length);
  const maxSpan = Math.max(excerpt.length * 3, 200);

  const startRe = new RegExp(buildFuzzyPattern(excerpt.slice(0, anchorLen)), "g");
  const endPattern = buildFuzzyPattern(excerpt.slice(-anchorLen));

  let startMatch: RegExpExecArray | null;
  while ((startMatch = startRe.exec(pageText))) {
    const window = pageText.slice(startMatch.index, Math.min(pageText.length, startMatch.index + maxSpan));
    const endMatch = new RegExp(endPattern).exec(window);
    if (endMatch) return window.slice(0, endMatch.index + endMatch[0].length);
    if (startRe.lastIndex === startMatch.index) startRe.lastIndex++; // guard against a zero-length match looping forever
  }
  return null;
}

// Parameterized by source rather than duplicated wholesale for Wikipedia:
// the selection/verbatim/identity rules are identical either way, only the
// opening sentence's description of where the text comes from (and, for
// Wikipedia specifically, a reminder that the article is third-person, not
// self-description) needs to differ.
const SOURCE_PROMPT_INFO: Record<BioSummaryResult["sourceType"], { description: string; extraRule: string }> = {
  campaign_site: { description: "their own campaign website's text", extraRule: "" },
  wikipedia: {
    description: "their Wikipedia article's text",
    extraRule: " The article is written in third person, not by the candidate — select a passage that introduces their background/career, the same as you would from a first-person source.",
  },
};

function buildSystemPrompt(sourceType: BioSummaryResult["sourceType"]): string {
  const { description, extraRule } = SOURCE_PROMPT_INFO[sourceType];
  return `You select a single representative excerpt introducing a political candidate, from ${description}, for a voter-information product. Follow these rules exactly:

1. Find the single most representative, self-contained passage (roughly 5-8 sentences, 500-900 characters — enough to read as a real paragraph, not a tagline) that introduces who this candidate is — background, career, or what drives their candidacy. Prefer an "About"/"Meet [Name]"/biography-style passage over a policy-issues passage if both exist on the page.${extraRule} If the richest matching passage on the page is shorter than this, use what's there rather than padding it — never combine text from different parts of the page to reach the target length (that would violate rule 2 below).
2. The excerpt must be VERBATIM — an exact, contiguous, character-for-character substring copied from the provided text. Do not paraphrase, summarize in your own words, condense, or combine text from different parts of the page into one passage.
3. Never use anything from your own training knowledge about this person — only what is literally present in the provided text.
4. If the page is clearly about a different person than the one named, or contains no biographical/introductory passage at all (e.g., only a donation form or an issues list with no "About" content), return null. A shared name is not enough to confirm identity — when an expected context is given (a specific office and state), the page must be consistent with that context; a same-named person in a different context is a collision, not a match.
5. Output ONLY valid JSON matching this exact shape, no other text:
{
  "matchesExpectedCandidate": true | false,
  "excerpt": "verbatim text, exactly as it appears on the page" | null
}`;
}

async function extractFromPage(
  candidateName: string,
  page: { text: string; finalUrl: string },
  sourceType: BioSummaryResult["sourceType"],
  expectedContext?: string
): Promise<BioSummaryResult | null> {
  const { text: pageText, finalUrl } = page;
  const contextLine = expectedContext ? `Expected context: ${expectedContext}. If the page describes a same-named person outside this context, treat it as a different person per rule 4.\n` : "";

  let message;
  try {
    message = await getClient().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: buildSystemPrompt(sourceType),
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
    if (pageText.includes(parsed.excerpt)) return { summary: parsed.excerpt, sourceUrl: finalUrl, sourceType };
    const recovered = recoverOriginalSpan(pageText, parsed.excerpt);
    if (!recovered) return null;
    return { summary: recovered, sourceUrl: finalUrl, sourceType };
  } catch {
    return null;
  }
}

export async function extractBioSummaryFromSite(candidateName: string, baseUrl: string, expectedContext?: string): Promise<BioSummaryResult | null> {
  const homepagePage = await fetchPageText(baseUrl).catch(() => null);
  if (!homepagePage) return null;

  const homepage = await extractFromPage(candidateName, homepagePage, "campaign_site", expectedContext).catch(() => null);
  if (homepage) return homepage;

  const resolvedBase = homepagePage.finalUrl;
  const candidateUrls = [
    ...new Set([...COMMON_BIO_PATHS.map((p) => new URL(p, resolvedBase).toString()), ...discoverBioLinks(homepagePage.html, resolvedBase)]),
  ];
  for (const url of candidateUrls) {
    const page = await fetchPageText(url).catch(() => null);
    if (!page) continue;
    const result = await extractFromPage(candidateName, page, "campaign_site", expectedContext).catch(() => null);
    if (result) return result;
  }
  return null;
}

// Fallback for a candidate with no personal campaign site (or no site with
// any extractable bio content) but a confirmed Wikipedia article — reuses
// the exact same verbatim-excerpt/identity-check machinery above, just
// pointed at the article instead. wikipediaUrl is expected to already be
// identity-confirmed by the caller (resolved off a Wikidata entity that
// passed looksLikeAPolitician(), same as every other Wikipedia use in this
// pipeline) — this still runs its own expectedContext check regardless,
// same discipline as every other source here, never a bare name match.
export async function extractBioSummaryFromWikipedia(candidateName: string, wikipediaUrl: string, expectedContext?: string): Promise<BioSummaryResult | null> {
  const page = await fetchPageText(wikipediaUrl).catch(() => null);
  if (!page) return null;
  return extractFromPage(candidateName, page, "wikipedia", expectedContext);
}
