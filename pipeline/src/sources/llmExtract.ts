import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

// Some campaign sites (often ones built on a landing-page tool) serve a
// near-empty shell that redirects client-side via JS or a meta refresh —
// a plain fetch() never runs that JS, so without following the redirect
// ourselves we'd see zero bio content even though a real page exists one
// hop away. Followed at most once to avoid chasing an infinite loop.
function findRedirectTarget(html: string): string | null {
  const jsRedirect = html.match(/window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/i);
  if (jsRedirect) return jsRedirect[1];
  const metaRefresh = html.match(/<meta[^>]+http-equiv=["']refresh["'][^>]*content=["'][^;]*;\s*url=([^"']+)["']/i);
  if (metaRefresh) return metaRefresh[1];
  return null;
}

export async function fetchPageText(url: string, allowRedirect = true): Promise<{ text: string; html: string; finalUrl: string } | null> {
  const res = await fetch(url, { headers: { "User-Agent": "ballot-wise-pipeline/0.1 (research; contact via GitHub repo)" } });
  if (!res.ok) return null;
  const html = await res.text();
  // fetch() already follows real HTTP redirects transparently (confirmed:
  // FEC lists reidrasner.com for one candidate's committee, which 301s to
  // rasnerforwy.com — res.url reflects that automatically). Citing res.url
  // instead of the originally-requested url matters for accuracy: readers
  // should see the page the quote actually lives on, not a redirecting alias.

  if (allowRedirect) {
    const target = findRedirectTarget(html);
    if (target) {
      const nextUrl = new URL(target, url).toString();
      const followed = await fetchPageText(nextUrl, false).catch(() => null);
      if (followed) return followed;
    }
  }

  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return { text: text.slice(0, 15000), html, finalUrl: res.url || url }; // keep the prompt bounded; bios live in the lead sections anyway
}

export interface ExtractedField {
  value: string;
  snippet: string;
}

export const EXTRACTABLE_FIELDS = [
  "date_of_birth",
  "birthplace",
  "high_school",
  "college",
  "marital_status",
  "employment_record",
  "civic_affiliations",
] as const;

export type ExtractedBio = Record<(typeof EXTRACTABLE_FIELDS)[number], ExtractedField | null>;

const SYSTEM_PROMPT = `You extract biographical facts about a named public figure from a single source page's text, for a voter-information product. Follow these rules exactly:

1. Only extract a fact if you can quote the text (verbatim, character-for-character, an exact contiguous substring copied from the provided text — not reconstructed or paraphrased) that states it. If you cannot find verbatim text stating it, the field is null — never infer, summarize from general knowledge, or paraphrase into a "quote."
2. CRITICAL — "value" must not contain ANY fact that is not explicitly stated in "snippet". This is the most important rule and the most common mistake: do NOT summarize everything the page says about this topic and then attach a short representative snippet. Every single fact in "value" must be traceable to text physically present in "snippet". If the page lists several related facts (e.g. a list of memberships, several jobs) and you want "value" to cover more than one of them, "snippet" must be extended (still an exact contiguous substring of the page text) to literally include the text for each of those facts too. If you can't extend the snippet that far, shrink "value" instead — a short, fully-supported value is correct; a longer value with any unsupported fact is not.
3. Never use anything from your own training knowledge about this person — only what is literally present in the provided text.
4. If the page is clearly about a different person than the one named, return all fields null. A shared name is not enough to confirm identity — when the prompt states an expected context (e.g. a specific office and state the candidate is running for), the page must be consistent with that context. A same-named person running for a different office, in a different state, or otherwise clearly a different individual is a collision, not a match — treat it exactly like a different person and return all fields null, even though the name matches exactly.
5. Output ONLY valid JSON matching this exact shape, no other text:
{
  "date_of_birth": {"value": "YYYY-MM-DD or as precise as stated", "snippet": "verbatim quoted text"} | null,
  "birthplace": {"value": "...", "snippet": "verbatim quoted text"} | null,
  "high_school": {"value": "...", "snippet": "verbatim quoted text"} | null,
  "college": {"value": "...", "snippet": "verbatim quoted text"} | null,
  "marital_status": {"value": "...", "snippet": "verbatim quoted text"} | null,
  "employment_record": {"value": "...", "snippet": "verbatim quoted text"} | null,
  "civic_affiliations": {"value": "...", "snippet": "verbatim quoted text"} | null
}
"snippet" MUST be an exact substring of the provided text, and MUST fully support every fact in "value".`;

export interface ExtractionResult {
  bio: ExtractedBio;
  sourceUrl: string; // the URL the text actually came from — may differ from the requested URL after a redirect hop
}

// sourceUrl on the returned result reflects wherever the text actually came
// from (after following at most one redirect), not necessarily the URL
// passed in — callers should cite that, since that's where the quote is
// actually verifiable.
export async function extractBioFacts(candidateName: string, url: string, expectedContext?: string): Promise<ExtractionResult | null> {
  const page = await fetchPageText(url);
  if (!page) return null;
  const { text: pageText, finalUrl } = page;

  const contextLine = expectedContext ? `Expected context: ${expectedContext}. If the page describes a same-named person outside this context, treat it as a different person per rule 4.\n` : "";

  // Every caller of extractBioFacts wraps it in .catch(() => null) — correct
  // for "this page has no bio content," but that same swallow used to also
  // hide a failing Anthropic call (bad key, no credit, rate limit) with zero
  // signal. Confirmed happening for real: the account ran out of API credit
  // partway through the 2026-08-13 build and every bio/platform extraction
  // from that point on silently returned empty instead of erroring loudly —
  // logged here so the SAME failure mode is impossible to miss next time.
  let message;
  try {
    message = await getClient().messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1536,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Candidate name: ${candidateName}\n${contextLine}Source URL: ${finalUrl}\n\nPage text:\n${pageText}`,
        },
      ],
    });
  } catch (err: any) {
    console.warn(`[llmExtract] Anthropic API call failed for "${candidateName}" (${finalUrl}): ${err?.message ?? err}`);
    return null;
  }

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  try {
    const jsonText = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const parsed = JSON.parse(jsonText);
    // Guard against a hallucinated snippet even after asking nicely — if the
    // model's "verbatim" quote doesn't actually appear in the source text,
    // the field is dropped rather than trusted.
    const verify = (field: ExtractedField | null): ExtractedField | null =>
      field && pageText.includes(field.snippet) ? field : null;

    const bio = {} as ExtractedBio;
    for (const f of EXTRACTABLE_FIELDS) bio[f] = verify(parsed[f] ?? null);
    return { bio, sourceUrl: finalUrl };
  } catch {
    return null;
  }
}

function hasAnyField(bio: ExtractedBio): boolean {
  return EXTRACTABLE_FIELDS.some((f) => bio[f] !== null);
}

// A campaign homepage is often just a donate/volunteer splash with no real
// bio content — the actual "About" page lives one click away. Tried only
// when the homepage itself yields nothing, and stops at the first path that
// produces any field, so a well-populated homepage never pays this cost.
const COMMON_BIO_PATHS = ["/about", "/about/", "/about-me", "/bio", "/meet", "/our-story", "/issues"];

export async function extractBioFactsFromSite(candidateName: string, baseUrl: string, expectedContext?: string): Promise<ExtractionResult | null> {
  const homepage = await extractBioFacts(candidateName, baseUrl, expectedContext).catch(() => null);
  if (homepage && hasAnyField(homepage.bio)) return homepage;

  // Some FEC-listed sites are legacy/alias domains that redirect to the real
  // one — confirmed on a real candidate: reidrasner.com redirects every path
  // to rasnerforwy.com's bare homepage, not the equivalent sub-page. Building
  // these paths against the original baseUrl would mean every attempt
  // collapses to that same shallow homepage instead of reaching the real
  // sub-page. homepage.sourceUrl is where the fetch actually landed (see
  // fetchPageText's use of res.url), so sub-paths are built from there.
  const resolvedBase = homepage?.sourceUrl ?? baseUrl;
  for (const path of COMMON_BIO_PATHS) {
    const url = new URL(path, resolvedBase).toString();
    const result = await extractBioFacts(candidateName, url, expectedContext).catch(() => null);
    if (result && hasAnyField(result.bio)) return result;
  }
  return homepage; // nothing found anywhere — return the (empty) homepage result rather than null so a real fetch isn't mistaken for a total failure
}
