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

// A self-identifying User-Agent ("ballot-wise-pipeline/0.1 (research; ...")
// was the original choice here, but it's a real, confirmed problem: several
// campaign sites sit behind a CDN/WAF that outright 403s any UA that
// doesn't look like a real browser (confirmed on Rep. Lois Frankel's site —
// curl and a real browser both get 200 with 41KB of real content, the old
// UA string got a 52-byte "403 Forbidden" page, every single time,
// including through the redirect chain). Since this UA is shared by bio,
// platform, AND video extraction, that one block silently zeroed out all
// three for any candidate whose site enforces it — not a per-candidate
// gap, a fetch-layer one. Switched to an ordinary browser UA. This isn't
// bypassing an intentional access control (no login, no paywall, no
// CAPTCHA) — it's a public campaign site's own CDN over-applying a generic
// bot filter against content the campaign wants voters to find.
export async function fetchPageText(url: string, allowRedirect = true): Promise<{ text: string; html: string; finalUrl: string } | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
  });
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
    // Numeric HTML entities (decimal &#8217; or hex &#x2019;) used to get
    // blanket-replaced with a plain space instead of decoded — silently
    // eating real characters, not just formatting noise. Confirmed on a
    // real candidate site (johnwilliamsforcongress.com): an apostrophe
    // encoded as &#8217; turned "Alaska's" into "Alaska s", and later
    // affected an unrelated LLM "verbatim" quote-matching check by shifting
    // string offsets. Decode to the real character instead.
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    // Named entities are just as common as numeric ones in real campaign-site
    // markup and were falling through untouched — confirmed on a real
    // candidate (Nick Begich III): "Alaska&rsquo;s way of life" rendered
    // literally, entity and all, since nothing here decoded it.
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&hellip;/g, "…")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
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

async function extractFromPage(
  candidateName: string,
  page: { text: string; finalUrl: string },
  expectedContext?: string
): Promise<ExtractionResult | null> {
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

// sourceUrl on the returned result reflects wherever the text actually came
// from (after following at most one redirect), not necessarily the URL
// passed in — callers should cite that, since that's where the quote is
// actually verifiable.
export async function extractBioFacts(candidateName: string, url: string, expectedContext?: string): Promise<ExtractionResult | null> {
  const page = await fetchPageText(url);
  if (!page) return null;
  return extractFromPage(candidateName, page, expectedContext);
}

// marital_status is excluded here because it's the one field that shows up
// incidentally in ordinary prose ("he lives with his wife Diane") without
// the page being a real bio page at all — confirmed on Bill Hill's own
// homepage, which mentions his wife in passing but whose actual
// biographical content (heritage, career, education) lives on a separate
// discovered page ("Bill's Story"). Treating that incidental mention as
// "good enough, stop here" would block the real bio page from ever being
// tried — every other field only shows up when a page is deliberately
// writing biographical content, so they're a much stronger stopping signal
// on their own.
function hasSubstantiveField(bio: ExtractedBio): boolean {
  return EXTRACTABLE_FIELDS.some((f) => f !== "marital_status" && bio[f] !== null);
}

function fieldCount(result: ExtractionResult | null): number {
  return result ? EXTRACTABLE_FIELDS.filter((f) => result.bio[f] !== null).length : 0;
}

// A campaign homepage is often just a donate/volunteer splash with no real
// bio content — the actual "About" page lives one click away. Tried only
// when the homepage itself yields nothing, and stops at the first path that
// produces any field, so a well-populated homepage never pays this cost.
export const COMMON_BIO_PATHS = ["/about", "/about/", "/about-me", "/bio", "/meet", "/our-story", "/issues"];

// The fixed guesses above miss real sites often enough to matter — the same
// failure mode already confirmed and fixed for platform extraction
// (campaignPlatform.ts's discoverPlatformLinks, 2026-08-16): a real page can
// carry a personalized slug the fixed list can't anticipate. Confirmed here
// on a real candidate (Bill Hill, AK-AL): his actual bio page is "Bill's
// Story" at /bills-story/ — none of COMMON_BIO_PATHS's generic guesses match
// it, so extraction never even looked at the one page with the answer. As
// with platform, read the homepage's own nav links and try whichever look
// bio-related instead of only guessing a fixed slug.
const BIO_LINK_KEYWORDS = /\babout\b|\bbio\b|\bstory\b|\bmeet\b|background|biograph|who\s+is/i;

export function discoverBioLinks(html: string, baseUrl: string): string[] {
  const origin = new URL(baseUrl).origin;
  const links = new Set<string>();
  const linkRegex = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html))) {
    const [, href, innerHtml] = match;
    const anchorText = innerHtml.replace(/<[^>]+>/g, " ").trim();
    if (!BIO_LINK_KEYWORDS.test(href) && !BIO_LINK_KEYWORDS.test(anchorText)) continue;
    try {
      const resolvedUrl = new URL(href, baseUrl);
      if (resolvedUrl.origin !== origin) continue;
      resolvedUrl.hash = ""; // see the identical comment in campaignPlatform.ts's discoverPlatformLinks
      links.add(resolvedUrl.toString());
    } catch {
      // malformed/relative-scheme href (mailto:, javascript:, etc.) — skip
    }
  }
  return [...links];
}

export async function extractBioFactsFromSite(candidateName: string, baseUrl: string, expectedContext?: string): Promise<ExtractionResult | null> {
  const homepagePage = await fetchPageText(baseUrl).catch(() => null);
  if (!homepagePage) return null;

  const homepage = await extractFromPage(candidateName, homepagePage, expectedContext).catch(() => null);
  if (homepage && hasSubstantiveField(homepage.bio)) return homepage;

  // Some FEC-listed sites are legacy/alias domains that redirect to the real
  // one — confirmed on a real candidate: reidrasner.com redirects every path
  // to rasnerforwy.com's bare homepage, not the equivalent sub-page. Building
  // these paths against the original baseUrl would mean every attempt
  // collapses to that same shallow homepage instead of reaching the real
  // sub-page. homepage.sourceUrl is where the fetch actually landed (see
  // fetchPageText's use of res.url), so sub-paths are built from there.
  const resolvedBase = homepage?.sourceUrl ?? homepagePage.finalUrl;

  const candidateUrls = [
    ...new Set([...COMMON_BIO_PATHS.map((p) => new URL(p, resolvedBase).toString()), ...discoverBioLinks(homepagePage.html, resolvedBase)]),
  ];
  let best = homepage;
  for (const url of candidateUrls) {
    const result = await extractBioFacts(candidateName, url, expectedContext).catch(() => null);
    if (result && hasSubstantiveField(result.bio)) return result;
    if (fieldCount(result) > fieldCount(best)) best = result;
  }
  return best; // nothing substantive found anywhere — return the richest weak match (or empty homepage) rather than null so a real fetch isn't mistaken for total failure
}
