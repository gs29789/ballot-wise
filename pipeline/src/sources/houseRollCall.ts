import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export interface RollCallVoteRecord {
  rollNumber: number;
  year: number;
  question: string;
  billTitle: string;
  date: string;
  result: string;
  position: string; // this member's vote: Yea / Nay / Present / Not Voting
  sourceUrl: string;
}

// Process-lifetime caches, keyed by what actually varies. Both exist for one
// reason: a single roll-call XML already contains EVERY member's vote, and the
// index for a given year is a constant, yet both were re-fetched per member.
// A full build asks about ~348 sitting members and the 2026 session has ~204
// roll calls, so attendance alone issued ~71,000 requests where 204 distinct
// documents would do -- each member re-downloading the same files the previous
// one just read. The House Clerk rate-limits well below that: observed
// 2026-09-03, one request succeeded and the next three returned 403. That is
// also the mechanism behind the 12 members whose entire voting records were
// silently zeroed the day before -- self-inflicted load, not an outage.
// Caching the parsed documents makes a build ~350x cheaper against this host
// and removes the throttling that was corrupting the data.
const rollCallCache = new Map<string, any | null>();
const latestRollCache = new Map<number, Promise<number>>();

// Retries a rate-limited fetch with backoff rather than treating 403 as a
// permanent answer -- every caller of this module swallows failures into an
// empty array, so an un-retried throttle reads downstream as "this member
// cast no votes."
async function fetchWithBackoff(url: string, attempts = 4): Promise<Response | null> {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url).catch(() => null);
    if (res && res.ok) return res;
    if (res && res.status !== 403 && res.status !== 429) return res;
    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 1000 * 2 ** i));
  }
  return null;
}

// House Clerk's public roll-call index page for a year — used only to find the
// current highest roll-call number so a weekly sync knows how far to walk.
export async function getLatestRollNumber(year: number): Promise<number> {
  const cached = latestRollCache.get(year);
  if (cached) return cached;
  const promise = (async () => {
    const res = await fetchWithBackoff(`https://clerk.house.gov/evs/${year}/index.asp`);
    if (!res || !res.ok) throw new Error(`House Clerk EVS index fetch failed: ${res?.status ?? "network error"}`);
    const html = await res.text();
    const numbers = [...html.matchAll(/rollnumber=(\d+)/g)].map((m) => Number(m[1]));
    return numbers.length ? Math.max(...numbers) : 0;
  })();
  // Cached as the in-flight PROMISE, not the resolved value, so the concurrent
  // workers below share one request instead of racing to issue their own.
  latestRollCache.set(year, promise);
  promise.catch(() => latestRollCache.delete(year)); // don't cache a failure
  return promise;
}

async function getRollCallDocument(year: number, rollNumber: number): Promise<any | null> {
  const key = `${year}:${rollNumber}`;
  if (rollCallCache.has(key)) return rollCallCache.get(key);
  const padded = String(rollNumber).padStart(3, "0");
  const res = await fetchWithBackoff(`https://clerk.house.gov/evs/${year}/roll${padded}.xml`);
  if (!res || !res.ok) return null; // deliberately NOT cached — a throttled miss must be retryable
  const doc = parser.parse(await res.text());
  rollCallCache.set(key, doc);
  return doc;
}

// Fetches one roll-call vote's XML and returns this member's recorded position,
// matched by bioguideId — the House Clerk's per-vote "name-id" attribute uses
// the same ID scheme as Congress.gov's bioguideId.
export async function getMemberVote(bioguideId: string, year: number, rollNumber: number): Promise<RollCallVoteRecord | null> {
  const padded = String(rollNumber).padStart(3, "0");
  const url = `https://clerk.house.gov/evs/${year}/roll${padded}.xml`;
  const xml = await getRollCallDocument(year, rollNumber);
  if (!xml) return null;

  const meta = xml["rollcall-vote"]?.["vote-metadata"];
  const votes = xml["rollcall-vote"]?.["vote-data"]?.["recorded-vote"];
  const list = Array.isArray(votes) ? votes : votes ? [votes] : [];

  const mine = list.find((v: any) => v.legislator?.["@_name-id"] === bioguideId);
  if (!mine) return null;

  return {
    rollNumber,
    year,
    question: meta?.["vote-question"] ?? "",
    billTitle: meta?.["vote-desc"] ?? meta?.["legis-num"] ?? "",
    date: meta?.["action-date"] ?? "",
    result: meta?.["vote-result"] ?? "",
    position: mine.vote,
    sourceUrl: url,
  };
}

export interface AttendanceStats {
  votesInSession: number;
  votesCast: number;
  attendanceRate: number; // 0-1
}

// Attendance % across every roll call this session, not just the recent
// handful — walks all N votes with bounded concurrency (House sessions run
// into the hundreds of votes; sequential fetches would take minutes).
export async function getAttendanceStats(bioguideId: string, year: number, concurrency = 15): Promise<AttendanceStats> {
  const latest = await getLatestRollNumber(year);
  const rollNumbers = Array.from({ length: latest }, (_, i) => i + 1);

  let cast = 0;
  let total = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < rollNumbers.length) {
      const n = rollNumbers[cursor++];
      const record = await getMemberVote(bioguideId, year, n);
      if (record) {
        total++;
        if (record.position !== "Not Voting") cast++;
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  return { votesInSession: total, votesCast: cast, attendanceRate: total ? cast / total : 0 };
}

export async function getRecentMemberVotes(bioguideId: string, year: number, count: number): Promise<RollCallVoteRecord[]> {
  const latest = await getLatestRollNumber(year);
  const rollNumbers: number[] = [];
  for (let n = latest; n > 0 && rollNumbers.length < count; n--) rollNumbers.push(n);

  const results: RollCallVoteRecord[] = [];
  for (const n of rollNumbers) {
    const record = await getMemberVote(bioguideId, year, n);
    if (record) results.push(record);
  }
  return results;
}
