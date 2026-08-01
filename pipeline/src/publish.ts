import "dotenv/config";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const BUILD_ROOT = join(import.meta.dirname, "..", "build");

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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
