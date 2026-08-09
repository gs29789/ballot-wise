import { parseCsvLine } from "./csvUtils.js";

// Bridge Grades (bridgegrades.org) scores members of Congress 0-100 on how
// collaboratively vs. divisively they govern relative to their peers — a
// more informative version of "% voted with party": it blends cross-
// partisan bill sponsorship/cosponsorship (from govinfo.gov, a source this
// pipeline already uses), Problem Solvers Caucus membership, district-lean
// context (Cook PVI), ideology (Voteview — also already a source here), and
// bipartisan-rhetoric analysis from the Polarization Research Lab's
// America's Political Pulse. Full methodology published at
// bridgegrades.org/methodology. Data confirmed free to reuse: their GitHub
// repo (github.com/BridgeGrades/119th-Congress) is Apache 2.0 licensed.
// Joins on bioguide_id, same as Voteview — only exists for people who have
// actually served, so this is null for every challenger.

export interface BridgeScore {
  grade: string; // letter grade A/B/C/F
  score: number; // 0-100
  snapshotDate: string;
  profileUrl: string;
}

const CSV_URLS: Record<"H" | "S", string> = {
  H: "https://www.bridgegrades.org/api/data/house.csv",
  S: "https://www.bridgegrades.org/api/data/senate.csv",
};

const cache = new Map<"H" | "S", Promise<Map<string, BridgeScore>>>();

async function loadScores(office: "H" | "S"): Promise<Map<string, BridgeScore>> {
  let cached = cache.get(office);
  if (!cached) {
    cached = (async () => {
      const map = new Map<string, BridgeScore>();
      const res = await fetch(CSV_URLS[office]);
      if (!res.ok) return map;
      const text = await res.text();
      const lines = text.split("\n");
      const header = parseCsvLine(lines[0]);
      const idx = (col: string) => header.indexOf(col);
      const iBioguide = idx("bioguide_id");
      const iGrade = idx("bridge_grade");
      const iScore = idx("bridge_score");
      const iDate = idx("snapshot_date");
      const iProfile = idx("profile_url");

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const cols = parseCsvLine(line);
        const bioguideId = cols[iBioguide]?.trim();
        const score = Number(cols[iScore]);
        if (!bioguideId || !Number.isFinite(score)) continue;
        map.set(bioguideId, {
          grade: cols[iGrade]?.trim(),
          score,
          snapshotDate: cols[iDate]?.trim(),
          profileUrl: cols[iProfile]?.trim(),
        });
      }
      return map;
    })().catch(() => new Map<string, BridgeScore>());
    cache.set(office, cached);
  }
  return cached;
}

export async function getBridgeScore(bioguideId: string, office: "H" | "S"): Promise<BridgeScore | null> {
  const scores = await loadScores(office);
  return scores.get(bioguideId) ?? null;
}
