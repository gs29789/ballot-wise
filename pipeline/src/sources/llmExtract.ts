import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

async function fetchPageText(url: string): Promise<string | null> {
  const res = await fetch(url, { headers: { "User-Agent": "ballot-wise-pipeline/0.1 (research; contact via GitHub repo)" } });
  if (!res.ok) return null;
  const html = await res.text();
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 15000); // keep the prompt bounded; bios live in the lead sections anyway
}

export interface ExtractedField {
  value: string;
  snippet: string;
}

export interface ExtractedBio {
  marital_status: ExtractedField | null;
  employment_record: ExtractedField | null;
  civic_affiliations: ExtractedField | null;
}

const SYSTEM_PROMPT = `You extract biographical facts about a named public figure from a single source page's text, for a voter-information product. Follow these rules exactly:

1. Only extract a fact if you can quote the EXACT sentence (verbatim, character-for-character from the provided text) that states it. If you cannot find a verbatim sentence, the field is null — never infer, summarize from general knowledge, or paraphrase into a "quote."
2. Never use anything from your own training knowledge about this person — only what is literally present in the provided text.
3. If the page is clearly about a different person than the one named (common-name collision), return all fields null.
4. Output ONLY valid JSON matching this exact shape, no other text:
{
  "marital_status": {"value": "...", "snippet": "verbatim quoted sentence"} | null,
  "employment_record": {"value": "...", "snippet": "verbatim quoted sentence"} | null,
  "civic_affiliations": {"value": "...", "snippet": "verbatim quoted sentence"} | null
}
"value" is a short factual summary; "snippet" MUST be an exact substring of the provided text.`;

export async function extractBioFacts(candidateName: string, sourceUrl: string): Promise<ExtractedBio | null> {
  const pageText = await fetchPageText(sourceUrl);
  if (!pageText) return null;

  const message = await getClient().messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Candidate name: ${candidateName}\nSource URL: ${sourceUrl}\n\nPage text:\n${pageText}`,
      },
    ],
  });

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

    return {
      marital_status: verify(parsed.marital_status),
      employment_record: verify(parsed.employment_record),
      civic_affiliations: verify(parsed.civic_affiliations),
    };
  } catch {
    return null;
  }
}
