import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { RACES } from "../build.js";

// Seeds local pipeline/build/ from the currently-published, currently-live
// data -- needed because build/ is gitignored (it's regenerated output, not
// source) and a fresh clone (a cloud routine's sandbox, a new contributor's
// machine) has no local copy of it at all. The scale scripts (scaleVideoOnly,
// scaleVideoTier2, scaleNoSiteBacklog) all read from local build/ to find
// candidates still missing a field -- without this, they silently find zero
// eligible candidates and do nothing, not an error, just no-op (confirmed
// happening for real on the first cloud-routine test run, 2026-08-22).
//
// Reads over the PUBLIC r2.dev URL, not the authenticated S3 API publish.ts
// uses -- no R2 credentials needed at all for this, since it's a pure read
// of already-public data, which sidesteps having to provision R2 secrets
// into an ephemeral cloud sandbox just to make progress on a backlog.

const BUILD_ROOT = join(import.meta.dirname, "..", "..", "build");
const DATA_BASE = "https://pub-2c102fc0a8114f89a7afbe75818e841f.r2.dev";

async function main() {
  let ok = 0, missing = 0, failed = 0;
  for (const opts of RACES) {
    const url = `${DATA_BASE}/${opts.outFile}`;
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (res.status === 404) {
        missing++;
        continue;
      }
      if (!res.ok) {
        failed++;
        console.warn(`[pullFromR2] ${opts.outFile}: HTTP ${res.status}`);
        continue;
      }
      const body = await res.text();
      const localPath = join(BUILD_ROOT, opts.outFile);
      mkdirSync(dirname(localPath), { recursive: true });
      writeFileSync(localPath, body);
      ok++;
    } catch (err: any) {
      failed++;
      console.warn(`[pullFromR2] ${opts.outFile}: ${err?.message ?? err}`);
    }
  }
  console.log(`Done. ${ok} files pulled, ${missing} not yet published, ${failed} failed.`);
}

main();
