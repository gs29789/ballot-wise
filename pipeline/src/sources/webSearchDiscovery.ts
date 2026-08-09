import Anthropic from "@anthropic-ai/sdk";

// FEC's committee "website" field is optional and often left blank even
// when a candidate has a real, professional campaign site — confirmed by
// hand: John Whalen's FEC filing has no website at all, yet whalende.com is
// a real, actively maintained site with substantial biographical content
// BallotReady and Wikipedia both missed too. Since guessing domain patterns
// risks the same collision problem as ballotReady.ts (a same-named
// unrelated person's site), this uses Claude's server-side web search tool
// instead — real search engine results plus a model that can read the page
// and judge whether it's actually this candidate's own site, not just
// pattern-match a domain name.
//
// This module only does discovery (find the URL); extraction of bio facts
// from whatever it finds reuses extractBioFactsFromSite, same as every
// other source in this pipeline — no separate extraction logic here.

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const SYSTEM_PROMPT = `You find the official campaign website of a specific political candidate using web search. Follow these rules exactly:

1. Only return a URL if you are confident it is the candidate's OWN official campaign website — not a news article about them, not Ballotpedia/Wikipedia/BallotReady, not a donation-processor page, not a social media profile, and not a same-named different person's site.
2. If multiple people share this name, verify the office and state in the expected context match before returning anything. A same-named person running for a different office or in a different state is a different individual — treat it exactly like it's not this candidate at all.
3. If you cannot confidently find their official site, return null — do not guess or return your best partial match.

Output ONLY valid JSON, no other text:
{"url": "https://..." | null}`;

async function attemptSearch(candidateName: string, expectedContext: string): Promise<string | null> {
  const message = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    tools: [{ type: "web_search_20260318" as any, name: "web_search", max_uses: 3 } as any],
    messages: [
      {
        role: "user",
        content: `Candidate: ${candidateName}\nExpected context: ${expectedContext}`,
      },
    ],
  });

  const textBlock = [...message.content].reverse().find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return null;

  try {
    const jsonText = textBlock.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
    const parsed = JSON.parse(jsonText);
    if (typeof parsed.url !== "string") return null;
    return parsed.url;
  } catch {
    return null;
  }
}

// A null result here is genuinely ambiguous — it could mean no site exists,
// or it could just mean this particular search query didn't surface it
// (confirmed by hand: identical calls for the same real candidate returned
// a real URL 2 of 3 times and null once — the model's own search query
// isn't perfectly deterministic). Since null is always the safe outcome
// (never wrong data, just possibly incomplete), one retry meaningfully
// improves recall at negligible risk.
export async function findCampaignWebsite(candidateName: string, expectedContext: string): Promise<string | null> {
  const first = await attemptSearch(candidateName, expectedContext).catch(() => null);
  if (first) return first;
  return attemptSearch(candidateName, expectedContext).catch(() => null);
}
