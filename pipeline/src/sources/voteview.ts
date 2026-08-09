// Voteview (voteview.com) publishes DW-NOMINATE ideology scores — the
// political-science standard measure of a member's voting record on a
// liberal↔conservative spectrum, in continuous use since the 1980s (Poole &
// Rosenthal), funded by the Hewlett Foundation, NSF, and UCLA. Free, no key,
// no paywall — a single CSV of every member's score, updated live as votes
// are taken, joinable directly on bioguide_id (which this pipeline already
// has for every matched incumbent). Only exists for people who have actually
// served and cast votes, so this is null for every challenger — same
// coverage shape as attendance/committees/bills elsewhere in this pipeline.
//
// nominate_dim1 is the primary axis: roughly -1 (most liberal) to +1 (most
// conservative). Shown as a raw, unlabeled number with a citation, the same
// neutral treatment as every other metric in this pipeline — this project
// doesn't editorialize on what a score "means," it cites the source and
// lets the number speak for itself.

import { parseCsvLine } from "./csvUtils.js";

const MEMBERS_CSV_URL = "https://voteview.com/static/data/out/members/HSall_members.csv";

export interface IdeologyScore {
  nominateDim1: number;
  nominateDim2: number;
  congress: number;
  sourceUrl: string;
}

let cache: Promise<Map<string, IdeologyScore>> | null = null;

async function loadScores(): Promise<Map<string, IdeologyScore>> {
  if (!cache) {
    cache = (async () => {
      const map = new Map<string, IdeologyScore>();
      const res = await fetch(MEMBERS_CSV_URL);
      if (!res.ok) return map;
      const text = await res.text();
      const lines = text.split("\n");
      const header = parseCsvLine(lines[0]);
      const idx = (col: string) => header.indexOf(col);
      const iCongress = idx("congress");
      const iBioguide = idx("bioguide_id");
      const iDim1 = idx("nominate_dim1");
      const iDim2 = idx("nominate_dim2");

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const cols = parseCsvLine(line);
        const bioguideId = cols[iBioguide]?.trim();
        const congress = Number(cols[iCongress]);
        const dim1 = Number(cols[iDim1]);
        const dim2 = Number(cols[iDim2]);
        if (!bioguideId || !Number.isFinite(congress) || !Number.isFinite(dim1)) continue;
        const key = `${bioguideId}:${congress}`;
        map.set(key, { nominateDim1: dim1, nominateDim2: dim2, congress, sourceUrl: "https://voteview.com/person/" + bioguideId });
      }
      return map;
    })().catch(() => new Map<string, IdeologyScore>());
  }
  return cache;
}

export async function getIdeologyScore(bioguideId: string, congress: number): Promise<IdeologyScore | null> {
  const scores = await loadScores();
  return scores.get(`${bioguideId}:${congress}`) ?? null;
}
