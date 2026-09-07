import { readFileSync } from "node:fs";
import { join } from "node:path";
import { RACES, buildRace } from "../build.js";

// RACES' outFile is relative to build/ (e.g. "house/MN-6.json"), not the
// repo root -- build.ts resolves it against its own BUILD_ROOT internally
// when writing, but that constant isn't exported, so this reads the same
// path relative to cwd (this script is always run from the pipeline root,
// same convention as every other build/*.json access this session).
function buildJsonPath(outFile: string): string {
  return join("build", outFile);
}

// Rebuilds every race that has a sitting-member incumbent with an empty
// `platform` field. Doesn't call the extraction waterfall directly --
// build.ts's own platform resolution (campaign site -> official .gov site
// -> Ballotpedia, added 2026-09-02) already does that per-candidate as
// part of a normal buildRace() call, with the same resolveWithRefresh
// caching every other field gets. This script's only job is picking which
// races are worth paying to rebuild.

interface Gap {
  outFile: string;
}

function findGaps(): Gap[] {
  const gaps: Gap[] = [];
  for (const opts of RACES) {
    let data: any;
    try {
      data = JSON.parse(readFileSync(buildJsonPath(opts.outFile), "utf8"));
    } catch {
      continue;
    }
    const hasIncumbentGap = (data.candidates ?? []).some(
      (c: any) => c.incumbent && (!c.platform || c.platform.length === 0)
    );
    if (hasIncumbentGap) gaps.push({ outFile: opts.outFile });
  }
  return gaps;
}

async function main() {
  const gapFiles = new Set(findGaps().map((g) => g.outFile));
  const targets = RACES.filter((r) => gapFiles.has(r.outFile));
  console.log(`${targets.length} races to rebuild.`);

  let done = 0;
  const failed: string[] = [];
  for (const opts of targets) {
    try {
      await buildRace(opts);
      done++;
      console.log(`PROGRESS ${done}/${targets.length} ok: ${opts.outFile}`);
    } catch (err: any) {
      failed.push(opts.outFile);
      console.error(`PROGRESS ${done + failed.length}/${targets.length} FAILED: ${opts.outFile} — ${err?.message ?? err}`);
    }
  }
  console.log(`\nDone. ${done}/${targets.length} succeeded.`);
  if (failed.length) console.log(`Failed:\n${failed.map((f) => `- ${f}`).join("\n")}`);
}

main();
