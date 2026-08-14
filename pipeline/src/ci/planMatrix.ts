import { RACES, type BuildRaceOptions } from "../build.js";

// Keeps each matrix cell comfortably under its 30-minute timeout — the
// bottleneck isn't the Anthropic-gated bio/platform work (that's what the
// 90-day refresh cache is for), it's uncached per-candidate calls that fire
// on every build regardless, especially getAttendanceStats's per-incumbent
// roll-call walk.
const MAX_PER_CHUNK = 10;

export interface Chunk {
  id: string; // stable + deterministic — this is the only thing that crosses
  // the CI matrix boundary; each cell recomputes its own race list from it.
  races: BuildRaceOptions[];
}

// Same RACES array in, same chunks out, always — so CI's setup job (which
// emits the matrix `include` list) and each cell's build job (which only
// gets a chunk id and re-derives its own slice) can never drift apart.
// Chunked by state, capped at MAX_PER_CHUNK; states over the cap split into
// roughly-equal parts instead of scaling the cap up, so no single cell ends
// up carrying a big state's full weight alone. Intentionally not a hardcoded
// list of "the big states" — FL alone goes from 5 races to ~28 once its
// pending primary resolves, and a hardcoded list would silently stop
// splitting it.
export function planChunks(races: BuildRaceOptions[] = RACES): Chunk[] {
  const byState = new Map<string, BuildRaceOptions[]>();
  for (const race of races) {
    const list = byState.get(race.state) ?? [];
    list.push(race);
    byState.set(race.state, list);
  }

  const chunks: Chunk[] = [];
  for (const [state, stateRaces] of [...byState.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const numParts = Math.ceil(stateRaces.length / MAX_PER_CHUNK);
    if (numParts <= 1) {
      chunks.push({ id: state, races: stateRaces });
      continue;
    }
    const partSize = Math.ceil(stateRaces.length / numParts);
    for (let i = 0; i < numParts; i++) {
      const slice = stateRaces.slice(i * partSize, (i + 1) * partSize);
      if (slice.length) chunks.push({ id: `${state}-${i + 1}`, races: slice });
    }
  }
  return chunks;
}

// Run standalone in CI's setup job: emit the matrix `include` list as JSON.
// Only chunk ids cross the wire — no race data — so each cell's build step
// calls planChunks() itself and filters to its own id.
if (import.meta.url === `file://${process.argv[1]}`) {
  const chunks = planChunks();
  console.log(JSON.stringify({ include: chunks.map((c) => ({ chunkId: c.id })) }));
}
