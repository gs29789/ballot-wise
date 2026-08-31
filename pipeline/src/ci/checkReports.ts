import "dotenv/config";
import { S3Client, ListObjectsV2Command, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Run daily by the same routine as checkPendingRaces.ts/resolvePendingPrimaries.ts
// -- lists anonymous "report an issue" submissions (web/functions/api/report-issue.js)
// that haven't been emailed about yet, so they can be included in the daily
// digest instead of sitting silently in the private ballot-wise-reports
// bucket forever. Default mode only lists+prints; archiving (moving a
// report out of the "new" set) is a separate, explicit step below, done
// by the routine only AFTER the email actually sends -- so a failed send
// never loses a report's visibility, worst case it's just reported again
// the next day.
function client() {
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_S3_ENDPOINT!,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
}

const BUCKET = "ballot-wise-reports";
const ARCHIVE_PREFIX = "reports/archived/";

async function listNew() {
  const c = client();
  const list = await c.send(new ListObjectsV2Command({ Bucket: BUCKET, Prefix: "reports/" }));
  const newKeys = (list.Contents ?? []).map((o) => o.Key!).filter((k) => k && !k.startsWith(ARCHIVE_PREFIX) && k.endsWith(".json"));

  if (!newKeys.length) {
    console.log("NO_NEW_REPORTS");
    return;
  }

  console.log(`NEW_REPORTS: ${newKeys.length}`);
  for (const key of newKeys) {
    const got = await c.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const body = await got.Body?.transformToString();
    console.log(`--- ${key} ---`);
    console.log(body);
  }
  console.log(`\nREPORT_KEYS_TO_ARCHIVE: ${newKeys.join(",")}`);
  console.log(`After successfully emailing about these, archive them with: npx tsx src/ci/checkReports.ts --archive ${newKeys.join(",")}`);
}

async function archive(keys: string[]) {
  const c = client();
  for (const key of keys) {
    const archivedKey = ARCHIVE_PREFIX + key.replace(/^reports\//, "");
    await c.send(new CopyObjectCommand({ Bucket: BUCKET, CopySource: `${BUCKET}/${key}`, Key: archivedKey }));
    await c.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    console.log(`Archived ${key} -> ${archivedKey}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--archive") {
    const keys = (args[1] ?? "").split(",").filter(Boolean);
    if (!keys.length) throw new Error("No keys given to --archive");
    await archive(keys);
  } else {
    await listNew();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
