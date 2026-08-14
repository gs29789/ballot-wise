import { appendFileSync } from "node:fs";
import { buildRace } from "../build.js";
import { planChunks } from "./planMatrix.js";

const chunkId = process.argv[2];
if (!chunkId) {
  console.error("usage: tsx src/ci/buildChunk.ts <chunkId>");
  process.exit(1);
}

const chunk = planChunks().find((c) => c.id === chunkId);
if (!chunk) {
  console.error(`no such chunk: ${chunkId}`);
  process.exit(1);
}

async function main() {
  let done = 0;
  const failed: string[] = [];
  for (const opts of chunk!.races) {
    try {
      await buildRace(opts);
      done++;
      console.log(`PROGRESS ${done}/${chunk!.races.length} ok: ${opts.outFile}`);
    } catch (err: any) {
      failed.push(opts.outFile);
      console.error(`PROGRESS ${done + failed.length}/${chunk!.races.length} FAILED: ${opts.outFile} — ${err?.message ?? err}`);
    }
  }

  const summary =
    `## Chunk ${chunkId}\n\n${done}/${chunk!.races.length} succeeded.\n` +
    (failed.length ? `\nFailed:\n${failed.map((f) => `- ${f}`).join("\n")}\n` : "");
  console.log(summary);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);

  // fail-fast is off at the workflow level specifically so one state's
  // transient error doesn't cancel every other in-flight state — but this
  // cell itself should still exit non-zero so its own Actions step shows red.
  if (failed.length) process.exit(1);
}

main();
