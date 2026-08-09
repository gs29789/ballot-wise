import { extractBioFacts, EXTRACTABLE_FIELDS, type ExtractionResult } from "./llmExtract.js";

// BallotReady (ballotready.org) is a voter-guide aggregator with real,
// server-rendered, structured candidate profiles — a "Degrees" section and
// dated "Professional Experience" entries — and crucially it covers minor,
// underfunded candidates who have no Wikipedia page and no FEC-listed
// campaign website (confirmed for several DE 2026 candidates who otherwise
// have zero automated bio coverage). No public API; there's no reliable way
// to look up a person's profile URL other than guessing the slug from their
// name and checking what comes back.
//
// That guessing is genuinely risky: BallotReady covers every race
// nationwide (city council up to Congress), so a common name collides
// constantly — "owen-carlson" resolves to a 2023 Texas city council
// candidate, not our Delaware U.S. House candidate of the same name;
// "john-whalen" (no suffix) resolves to a 2022 Oregon city council
// candidate, not "John J. Whalen III" of Delaware. A same-named different
// person is a real, confirmed failure mode here, not a theoretical one.
//
// The mitigation is NOT picking "the first URL that returns 200" — it's
// running every candidate URL through extractBioFacts's identity check with
// an explicit expected office/state context, and only accepting a URL whose
// content the model actually confirms matches. A 200 with content about the
// wrong person correctly yields zero extracted fields and this moves on to
// the next guess.

const SUFFIXES = new Set(["II", "III", "IV", "JR", "SR"]);

function parseFecName(fecName: string): { first: string; middle: string; last: string; suffix: string } {
  const [lastPart, restPart] = fecName.split(",").map((s) => s.trim());
  const lastTokens = (lastPart ?? "").split(/\s+/).filter(Boolean);
  let suffix = "";
  const maybeSuffix = lastTokens[lastTokens.length - 1]?.toUpperCase().replace(/\.$/, "");
  if (lastTokens.length > 1 && maybeSuffix && SUFFIXES.has(maybeSuffix)) {
    suffix = lastTokens.pop()!;
  }
  const last = lastTokens.join(" ");

  const restTokens = (restPart ?? "").split(/\s+/).filter(Boolean);
  const first = restTokens[0] ?? "";
  const middle = restTokens.slice(1).join(" ");

  return { first, middle, last, suffix };
}

function slugPart(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Multiple guesses in priority order — BallotReady's own slug convention
// isn't consistent (sometimes keeps a middle initial and suffix, sometimes
// drops the middle name entirely), so several plausible forms are tried.
export function guessBallotReadyUrls(fecName: string): string[] {
  const { first, middle, last, suffix } = parseFecName(fecName);
  if (!first || !last) return [];
  const middleInitial = middle ? middle[0] : "";

  const slugs: string[] = [];
  const add = (parts: string[]) => {
    const slug = parts.filter(Boolean).map(slugPart).join("-");
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  };
  add([first, last]);
  add([first, last, suffix]);
  add([first, middleInitial, last, suffix]);
  add([first, middleInitial, last]);
  add([first, middle, last, suffix]);

  return slugs.map((slug) => `https://www.ballotready.org/people/${slug}`);
}

function hasAnyField(result: ExtractionResult): boolean {
  return EXTRACTABLE_FIELDS.some((f) => result.bio[f] !== null);
}

export async function findBallotReadyBio(candidateName: string, fecName: string, expectedContext: string): Promise<ExtractionResult | null> {
  for (const url of guessBallotReadyUrls(fecName)) {
    const result = await extractBioFacts(candidateName, url, expectedContext).catch(() => null);
    if (result && hasAnyField(result)) return result;
  }
  return null;
}
