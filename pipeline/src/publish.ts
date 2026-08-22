import "dotenv/config";
import { readdirSync, readFileSync, statSync, mkdirSync, cpSync, existsSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const BUILD_ROOT = join(import.meta.dirname, "..", "build");

// A separate, reused local clone dedicated to keeping the `data-snapshot`
// branch current -- deliberately NOT the user's actual working directory/
// branch, so this can run unattended without ever touching whatever the
// user has checked out or in progress there.
const SNAPSHOT_CLONE_ROOT = join(import.meta.dirname, "..", ".data-snapshot-clone");
const REPO_URL = "https://github.com/gs29789/ballot-wise.git";
const SNAPSHOT_BRANCH = "data-snapshot";

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8" }).trim();
}

// pipeline/build/ is gitignored on every normal branch (it's regenerated
// output, not source) -- but the cloud daily-backlog routine has no other
// way to get current data at all, since its sandbox's network policy
// blocks the R2 domain outright (confirmed 2026-08-22: every pullFromR2.ts
// request got a 403 at the proxy CONNECT level, not an R2 auth failure).
// GitHub itself is reachable from that sandbox (that's how it clones in the
// first place), so this pushes a plain data snapshot to a dedicated branch
// every time a real publish happens, and the routine reads it with a
// simple `git checkout origin/data-snapshot -- pipeline/build` instead of
// needing any R2 access of its own.
function syncDataSnapshot() {
  try {
    if (!existsSync(SNAPSHOT_CLONE_ROOT)) {
      console.log("Setting up data-snapshot clone (first run)...");
      execFileSync("git", ["clone", REPO_URL, SNAPSHOT_CLONE_ROOT], { encoding: "utf-8" });
      try {
        git(["checkout", SNAPSHOT_BRANCH], SNAPSHOT_CLONE_ROOT);
      } catch {
        git(["checkout", "-b", SNAPSHOT_BRANCH], SNAPSHOT_CLONE_ROOT);
      }
    } else {
      git(["fetch", "origin"], SNAPSHOT_CLONE_ROOT);
      try {
        git(["checkout", SNAPSHOT_BRANCH], SNAPSHOT_CLONE_ROOT);
        git(["reset", "--hard", `origin/${SNAPSHOT_BRANCH}`], SNAPSHOT_CLONE_ROOT);
      } catch {
        // Remote branch doesn't exist yet (first sync ever, or it was
        // deleted) -- branch it fresh from wherever main currently is.
        git(["checkout", "-B", SNAPSHOT_BRANCH, "origin/main"], SNAPSHOT_CLONE_ROOT);
      }
    }

    const targetBuildDir = join(SNAPSHOT_CLONE_ROOT, "pipeline", "build");
    rmSync(targetBuildDir, { recursive: true, force: true });
    mkdirSync(targetBuildDir, { recursive: true });
    cpSync(BUILD_ROOT, targetBuildDir, { recursive: true });

    git(["add", "-f", "pipeline/build"], SNAPSHOT_CLONE_ROOT);
    const status = git(["status", "--short"], SNAPSHOT_CLONE_ROOT);
    if (!status) {
      console.log("Data snapshot: no changes since last publish, skipping commit.");
      return;
    }
    git(["commit", "-m", `Data snapshot: ${new Date().toISOString()}`], SNAPSHOT_CLONE_ROOT);
    git(["push", "-u", "origin", SNAPSHOT_BRANCH], SNAPSHOT_CLONE_ROOT);
    console.log(`Data snapshot pushed to origin/${SNAPSHOT_BRANCH}.`);
  } catch (err: any) {
    // Never let a snapshot-sync failure fail the actual R2 publish this
    // runs after -- the live site's data is already correctly published by
    // that point regardless of whether this secondary copy succeeded.
    console.warn(`[publish] data-snapshot sync failed (R2 publish above is unaffected): ${err?.message ?? err}`);
  }
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} not set in .env`);
  return v;
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

async function main() {
  const client = new S3Client({
    region: "auto",
    endpoint: requireEnv("R2_S3_ENDPOINT"),
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  const bucket = requireEnv("R2_BUCKET_NAME");

  const files = walk(BUILD_ROOT).filter((f) => f.endsWith(".json"));
  for (const file of files) {
    const key = relative(BUILD_ROOT, file);
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: readFileSync(file),
        ContentType: "application/json",
        CacheControl: "public, max-age=3600",
      })
    );
    console.log(`Published ${key} -> r2://${bucket}/${key}`);
  }

  syncDataSnapshot();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
