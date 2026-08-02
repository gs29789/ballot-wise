import { XMLParser } from "fast-xml-parser";

const parser = new XMLParser({ ignoreAttributes: false });

export interface SenateVoteRecord {
  voteNumber: number;
  congress: number;
  session: number;
  question: string;
  title: string;
  date: string;
  result: string;
  position: string; // Yea / Nay / Present / Not Voting
  sourceUrl: string;
}

// Senate LIS vote XML has no bioguideId — members are keyed by an LIS ID
// (e.g. "S428") with no public bioguide crosswalk in this feed. Matching by
// last name + state is reliable enough at pilot scale (one senator per match);
// revisit if a state ever has two same-surname senators.
export async function getLatestVoteNumber(congress: number, session: number): Promise<number> {
  const url = `https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_${congress}_${session}.xml`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Senate vote menu fetch failed: ${res.status}`);
  const xml = parser.parse(await res.text());
  const votes = xml.vote_summary?.votes?.vote;
  const list = Array.isArray(votes) ? votes : votes ? [votes] : [];
  const numbers = list.map((v: any) => Number(v.vote_number));
  return numbers.length ? Math.max(...numbers) : 0;
}

export async function getMemberVote(
  lastName: string,
  state: string,
  congress: number,
  session: number,
  voteNumber: number
): Promise<SenateVoteRecord | null> {
  const padded = String(voteNumber).padStart(5, "0");
  const base = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${congress}${session}/vote_${congress}_${session}_${padded}`;
  const res = await fetch(`${base}.xml`);
  if (!res.ok) return null;
  const xml = parser.parse(await res.text());
  const vote = xml.roll_call_vote;
  if (!vote) return null;

  const members = vote.members?.member;
  const list = Array.isArray(members) ? members : members ? [members] : [];
  const mine = list.find(
    (m: any) => m.last_name?.toLowerCase() === lastName.toLowerCase() && m.state === state
  );
  if (!mine) return null;

  return {
    voteNumber,
    congress,
    session,
    question: vote.question ?? "",
    // vote_title is often just a bill number ("S. Res. 817") — the actual
    // descriptive text lives in vote_document_text, so prefer that.
    title: vote.vote_document_text || vote.vote_title || "",
    date: vote.vote_date ?? "",
    result: vote.vote_result ?? "",
    position: mine.vote_cast,
    // The .xml file has no client-side stylesheet, so it renders as a flat,
    // unstyled data dump in a browser. The .htm version is the same vote,
    // formatted for people rather than parsers.
    sourceUrl: `${base}.htm`,
  };
}

export interface SenateAttendanceStats {
  votesInSession: number;
  votesCast: number;
  attendanceRate: number;
}

export async function getAttendanceStats(
  lastName: string,
  state: string,
  congress: number,
  session: number,
  concurrency = 15
): Promise<SenateAttendanceStats> {
  const latest = await getLatestVoteNumber(congress, session);
  const voteNumbers = Array.from({ length: latest }, (_, i) => i + 1);

  let cast = 0;
  let total = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < voteNumbers.length) {
      const n = voteNumbers[cursor++];
      const record = await getMemberVote(lastName, state, congress, session, n);
      if (record) {
        total++;
        if (record.position !== "Not Voting") cast++;
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));

  return { votesInSession: total, votesCast: cast, attendanceRate: total ? cast / total : 0 };
}

export async function getRecentMemberVotes(
  lastName: string,
  state: string,
  congress: number,
  session: number,
  count: number
): Promise<SenateVoteRecord[]> {
  const latest = await getLatestVoteNumber(congress, session);
  const results: SenateVoteRecord[] = [];
  for (let n = latest; n > 0 && results.length < count; n--) {
    const record = await getMemberVote(lastName, state, congress, session, n);
    if (record) results.push(record);
  }
  return results;
}
