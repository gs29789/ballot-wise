import "dotenv/config";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { RACES } from "../build.js";
import { getCommitteeWebsite, FecRateLimitError } from "../sources/fec.js";

// One-time backfill: 904 of 1108 candidates (2026-08-30 count) have never
// had campaign_site_url resolved at all -- not null, the KEY IS ABSENT --
// because their records predate that field existing in buildRace()'s output
// (confirmed: buildRace() unconditionally writes this key on every real run,
// see build.ts line ~768). Those candidates have accumulated updates only
// from targeted field-specific scripts (this one's own pattern) that never
// touch campaign_site_url, so they've silently never gotten a shot at Tier-1
// video / platform / campaign-site bio_summary -- all of which require this
// field first. Root cause: full buildRace() rebuilds are expensive (FEC
// totals, Congress.gov history, LLM extraction) so fixes have been scoped
// rather than sitewide since early in the project.
//
// Deliberately narrow, matching how this was proposed to the user: ONLY the
// free FEC lookup (getCommitteeWebsite -- one API call, no LLM cost), plus a
// real HTTP reachability check on whatever URL that turns up (also free).
// No extraction of any kind here -- that's an explicit, separately-costed
// follow-up once this reports back what fraction of discovered sites are
// even fetchable. Skips candidates that already have the key (even if
// null) -- those were already checked by a real buildRace() pass, including
// its FEC-empty web-search fallback, which this script does not replicate.
//
// Persists `campaign_site_url: null` (not leaving the key absent) when FEC
// genuinely has nothing on file, matching buildRace()'s own convention at
// line 768 -- and harmless either way, since buildRace() always re-runs
// getCommitteeWebsite() fresh on a real rebuild regardless of what's already
// stored here (it doesn't gate the lookup on prevCand, only the fallback-to-
// previous-value happens if THIS run's lookup comes up empty). So this
// script can never block a future proper rebuild from re-checking.
const BUILD_ROOT = join(import.meta.dirname, "..", "..", "build");

// Persistent, git-tracked (not build/, which is gitignored) list of
// candidates confirmed behind a genuine Cloudflare bot challenge -- not a
// fixable User-Agent block, a hard wall this pipeline cannot bypass (see
// electjon.com/Ossoff, the case that established this distinction).
// Updated by every run of this script, whoever runs it (this session, the
// weekly-free-refresh routine) -- accumulates over time as more of the
// backlog gets checked, so it stays a complete, current list rather than a
// one-off snapshot that goes stale the moment more discovery happens.
// These candidates need a human to manually curate content (same override
// mechanism as Clyburn/Andrews) -- no further automated pass will ever
// resolve them.
const NEEDS_REVIEW_PATH = join(import.meta.dirname, "needsHumanReview.json");

interface ReviewEntry {
  name: string;
  race: string;
  url?: string;
  incumbent: boolean;
  first_detected_at: string;
}

interface ReviewFile {
  last_updated: string;
  cloudflare_challenge: ReviewEntry[];
  // Candidates with a real, valid FEC candidate ID (every candidate in this
  // dataset has one -- this is NOT "unregistered with FEC") whose FEC
  // committee filing simply doesn't list a website. Common and NOT on its
  // own a signal the candidate is unserious or fake -- website is an
  // optional field on FEC's own Form 1/2. Tracked by name (not just
  // counted) starting 2026-08-31 specifically so this can be reviewed by a
  // human as a real list, not just a number.
  no_site_on_fec: ReviewEntry[];
  still_unchecked_count: number;
}

function loadReviewFile(): ReviewFile {
  if (!existsSync(NEEDS_REVIEW_PATH)) return { last_updated: "", cloudflare_challenge: [], no_site_on_fec: [], still_unchecked_count: 0 };
  try {
    const parsed = JSON.parse(readFileSync(NEEDS_REVIEW_PATH, "utf-8"));
    if (!Array.isArray(parsed.no_site_on_fec)) parsed.no_site_on_fec = [];
    return parsed;
  } catch {
    return { last_updated: "", cloudflare_challenge: [], no_site_on_fec: [], still_unchecked_count: 0 };
  }
}

const REALISTIC_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type Classification = "reachable" | "cloudflare_challenge" | "blocked_other" | "dead" | "no_site_on_fec";

// Same header-based distinction proven earlier this session on electjon.com
// (Ossoff): cf-mitigated: challenge is a genuine JS/behavioral Cloudflare
// challenge, not a simple User-Agent block -- not something this pipeline
// can or should try to bypass. Any other non-ok response (a plain 403, a
// 404, a redirect loop) is bucketed separately since those may be legitimately
// fixable (typo'd URL, path issue) rather than a hard wall.
export async function classifySite(url: string): Promise<Classification> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { headers: { "User-Agent": REALISTIC_UA }, signal: controller.signal, redirect: "follow" }).finally(() =>
      clearTimeout(timeout)
    );
    if (res.ok) return "reachable";
    if (res.headers.get("cf-mitigated") === "challenge") return "cloudflare_challenge";
    return "blocked_other";
  } catch {
    return "dead";
  }
}

// Throws FecRateLimitError specifically (never swallows it) so the caller
// can tell "genuinely checked, FEC has nothing" apart from "couldn't check
// at all" -- confirmed necessary the hard way: a first version of this
// script swallowed a 429 the same as a real empty result and silently
// mislabeled ~750 candidates as having no campaign site on file, when in
// truth roughly 3 in 4 of the sampled results in that window were rate-
// limit artifacts, not real checks (see the per-minute null-rate jump from
// ~30% to ~85% right when this started, 2026-08-30). Any OTHER error
// (network blip, timeout) is swallowed and skipped -- left fully untouched
// so it stays naturally eligible for a future run, same reasoning as the
// already-processed check above, just for a different cause.
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processCandidate(c: any): Promise<Classification | null> {
  if (c.campaign_site_url !== undefined) return null; // already checked by a real buildRace() pass -- not this script's job
  if (!c.fec_candidate_id) return null;

  // One retry after a short pause for a non-rate-limit failure -- confirmed
  // necessary on a real run (2026-08-30): a full 753-candidate resume left
  // ~95% of candidates completely untouched (safe -- nothing false was
  // written -- but a fresh single call for one of those exact candidates
  // succeeded seconds later), pointing at a transient/burst issue rather
  // than genuine unavailability. Still fails closed to "leave untouched" if
  // the retry also fails, same as before.
  let site: string | null;
  try {
    site = await getCommitteeWebsite(c.fec_candidate_id);
  } catch (err) {
    if (err instanceof FecRateLimitError) throw err;
    await sleep(2000);
    try {
      site = await getCommitteeWebsite(c.fec_candidate_id);
    } catch (err2) {
      if (err2 instanceof FecRateLimitError) throw err2;
      return null; // transient error survived a retry -- not a verified result, leave candidate untouched
    }
  }

  c.campaign_site_url = site;
  c._campaign_site_discovered_at = new Date().toISOString();
  if (!site) return "no_site_on_fec";

  const classification = await classifySite(site);
  c._campaign_site_reachability = classification;
  return classification;
}

async function processRace(
  opts: (typeof RACES)[number]
): Promise<{
  checked: number;
  results: Record<Classification, number>;
  rateLimited: boolean;
  newCloudflareEntries: ReviewEntry[];
  newNoSiteEntries: ReviewEntry[];
}> {
  const localPath = join(BUILD_ROOT, opts.outFile);
  const empty = {
    checked: 0,
    results: { reachable: 0, cloudflare_challenge: 0, blocked_other: 0, dead: 0, no_site_on_fec: 0 },
    rateLimited: false,
    newCloudflareEntries: [] as ReviewEntry[],
    newNoSiteEntries: [] as ReviewEntry[],
  };
  if (!existsSync(localPath)) return empty;
  const data = JSON.parse(readFileSync(localPath, "utf-8"));
  if (!Array.isArray(data.candidates)) return empty;

  const eligible = data.candidates.filter((c: any) => c.campaign_site_url === undefined);
  if (!eligible.length) return empty;

  // allSettled, not all: a rate limit hitting ONE candidate in this race's
  // batch must not discard the real, already-resolved results for its
  // siblings in the same Promise.all -- those mutations already landed on
  // the candidate objects and are worth keeping (and writing) as-is.
  const settled: PromiseSettledResult<Classification | null>[] = await Promise.allSettled(eligible.map((c: any) => processCandidate(c)));
  const results: Record<Classification, number> = { reachable: 0, cloudflare_challenge: 0, blocked_other: 0, dead: 0, no_site_on_fec: 0 };
  let checked = 0;
  let rateLimited = false;
  for (const s of settled) {
    if (s.status === "fulfilled") {
      checked++;
      if (s.value !== null) results[s.value]++;
    } else if (s.reason instanceof FecRateLimitError) {
      rateLimited = true;
    }
  }

  const newCloudflareEntries: ReviewEntry[] = eligible
    .filter((c: any) => c._campaign_site_reachability === "cloudflare_challenge")
    .map((c: any) => ({ name: c.full_name, race: opts.outFile, url: c.campaign_site_url, incumbent: Boolean(c.incumbent), first_detected_at: new Date().toISOString() }));

  const newNoSiteEntries: ReviewEntry[] = eligible
    .filter((c: any) => c.campaign_site_url === null)
    .map((c: any) => ({ name: c.full_name, race: opts.outFile, incumbent: Boolean(c.incumbent), first_detected_at: new Date().toISOString() }));

  if (checked > 0) writeFileSync(localPath, JSON.stringify(data, null, 2));
  return { checked, results, rateLimited, newCloudflareEntries, newNoSiteEntries };
}

async function main() {
  const totals = { reachable: 0, cloudflare_challenge: 0, blocked_other: 0, dead: 0, no_site_on_fec: 0 };
  let totalChecked = 0;

  // Opt-in cap for a smoke test against a handful of races before committing
  // to a full ~450-file, ~900-candidate run against live third-party sites.
  const limit = process.env.DISCOVERY_LIMIT ? Number(process.env.DISCOVERY_LIMIT) : RACES.length;
  const races = RACES.slice(0, limit);

  const reviewFile = loadReviewFile();
  const knownKeys = new Set(reviewFile.cloudflare_challenge.map((e) => `${e.race}|${e.name}`));
  const knownNoSiteKeys = new Set(reviewFile.no_site_on_fec.map((e) => `${e.race}|${e.name}`));

  for (const opts of races) {
    const { checked, results, rateLimited, newCloudflareEntries, newNoSiteEntries } = await processRace(opts);
    totalChecked += checked;
    for (const k of Object.keys(totals) as Classification[]) totals[k] += results[k];
    if (checked > 0) {
      console.log(`${opts.outFile}: ${checked} checked -> reachable ${results.reachable}, cf-challenge ${results.cloudflare_challenge}, blocked ${results.blocked_other}, dead ${results.dead}, no-site ${results.no_site_on_fec}`);
    }
    for (const entry of newCloudflareEntries) {
      const key = `${entry.race}|${entry.name}`;
      if (!knownKeys.has(key)) {
        reviewFile.cloudflare_challenge.push(entry);
        knownKeys.add(key);
      }
    }
    for (const entry of newNoSiteEntries) {
      const key = `${entry.race}|${entry.name}`;
      if (!knownNoSiteKeys.has(key)) {
        reviewFile.no_site_on_fec.push(entry);
        knownNoSiteKeys.add(key);
      }
    }
    if (rateLimited) {
      console.log(`\nFEC_API_KEY hit its rate limit at ${opts.outFile} -- stopping here rather than mislabeling the rest.`);
      console.log(`Everything processed above this line is a real, verified result. Everything below was never reached and is still eligible for a future run.`);
      break;
    }
  }

  // "Remaining search" count -- how many candidates across the WHOLE
  // dataset (not just this run's slice) still have campaign_site_url
  // absent entirely. Scanned fresh every run so it reflects reality even
  // when a run stops early on a rate limit.
  let stillUnchecked = 0;
  for (const opts of RACES) {
    const localPath = join(BUILD_ROOT, opts.outFile);
    if (!existsSync(localPath)) continue;
    const data = JSON.parse(readFileSync(localPath, "utf-8"));
    if (!Array.isArray(data.candidates)) continue;
    stillUnchecked += data.candidates.filter((c: any) => c.campaign_site_url === undefined).length;
  }
  reviewFile.still_unchecked_count = stillUnchecked;
  reviewFile.last_updated = new Date().toISOString();
  writeFileSync(NEEDS_REVIEW_PATH, JSON.stringify(reviewFile, null, 2));

  console.log(`\nDone. ${totalChecked} candidates checked.`);
  console.log(`  Reachable (real content available):     ${totals.reachable}`);
  console.log(`  Cloudflare JS challenge (not bypassable): ${totals.cloudflare_challenge}`);
  console.log(`  Blocked, other (may be fixable):         ${totals.blocked_other}`);
  console.log(`  Dead / no DNS / timeout:                 ${totals.dead}`);
  console.log(`  No site on file with FEC at all:         ${totals.no_site_on_fec}`);
  console.log(`\n${reviewFile.cloudflare_challenge.length} candidates total on the needs-human-review list (Cloudflare-blocked, never fixable by automation).`);
  console.log(`${reviewFile.no_site_on_fec.length} candidates total have a valid FEC candidate ID but no website on their FEC committee filing (NOT "unregistered" -- website is an optional FEC field).`);
  console.log(`${stillUnchecked} candidates across the whole dataset still never checked at all -- this count shrinks toward 0 as more runs complete.`);
  console.log(`See pipeline/src/ci/needsHumanReview.json for the full, current, persistent list.`);
  console.log(`\nRun "npm run publish" to push the updated files to R2.`);
}

// Explicit exit: fetch()'s keep-alive connections to dozens of distinct
// third-party hosts otherwise leave the event loop alive well past the
// point all real work is done (confirmed: a smoke-test run hung for 2+
// minutes after printing its final summary).
main().then(() => process.exit(0));
