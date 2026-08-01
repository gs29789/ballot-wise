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

// House Clerk's public roll-call index page for a year — used only to find the
// current highest roll-call number so a weekly sync knows how far to walk.
export async function getLatestRollNumber(year: number): Promise<number> {
  const res = await fetch(`https://clerk.house.gov/evs/${year}/index.asp`);
  if (!res.ok) throw new Error(`House Clerk EVS index fetch failed: ${res.status}`);
  const html = await res.text();
  const numbers = [...html.matchAll(/rollnumber=(\d+)/g)].map((m) => Number(m[1]));
  return numbers.length ? Math.max(...numbers) : 0;
}

// Fetches one roll-call vote's XML and returns this member's recorded position,
// matched by bioguideId — the House Clerk's per-vote "name-id" attribute uses
// the same ID scheme as Congress.gov's bioguideId.
export async function getMemberVote(bioguideId: string, year: number, rollNumber: number): Promise<RollCallVoteRecord | null> {
  const padded = String(rollNumber).padStart(3, "0");
  const url = `https://clerk.house.gov/evs/${year}/roll${padded}.xml`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const xml = parser.parse(await res.text());

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
