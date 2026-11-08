// Applies the CORS rule that lets the browser upload recordings straight to the private Vultr
// bucket (presigned PUT from /api/uploads/prepare) and play them back (presigned GET).
//
//   npm run storage:cors                       # localhost:3000 + NEXT_PUBLIC_APP_URL
//   npm run storage:cors https://orbit.example  # also allow a deployed origin
//
// CORS only says which web pages may call the bucket. The bucket stays private: every request
// still needs a short-lived presigned URL. Running it again replaces the rule (idempotent).
import { GetBucketCorsCommand, PutBucketCorsCommand, S3Client } from "@aws-sdk/client-s3";

const REQUIRED = ["VULTR_S3_ENDPOINT", "VULTR_S3_REGION", "VULTR_S3_BUCKET", "VULTR_S3_ACCESS_KEY_ID", "VULTR_S3_SECRET_ACCESS_KEY"];
const missing = REQUIRED.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(`Missing ${missing.join(", ")}. Run with --env-file=.env.local (npm run storage:cors).`);
  process.exit(1);
}

/** Normalizes to a bare http(s) origin; rejects wildcards and paths. */
function toOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`Not a URL: ${value}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error(`Origin must be http(s): ${value}`);
  if (url.hostname.includes("*")) throw new Error(`Wildcard origins aren't allowed: ${value}`);
  return url.origin;
}

let origins;
try {
  origins = [
    ...new Set(
      ["http://localhost:3000", process.env.NEXT_PUBLIC_APP_URL, ...process.argv.slice(2)]
        .filter((v) => v && v.trim())
        .map((v) => toOrigin(v.trim())),
    ),
  ];
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const rule = {
  AllowedOrigins: origins,
  AllowedMethods: ["PUT", "GET", "HEAD"],
  AllowedHeaders: ["*"],
  ExposeHeaders: ["ETag"],
  MaxAgeSeconds: 3600,
};

const env = process.env;
const client = new S3Client({
  endpoint: env.VULTR_S3_ENDPOINT,
  region: env.VULTR_S3_REGION,
  credentials: { accessKeyId: env.VULTR_S3_ACCESS_KEY_ID, secretAccessKey: env.VULTR_S3_SECRET_ACCESS_KEY },
});
const Bucket = env.VULTR_S3_BUCKET;

async function currentRules() {
  try {
    return (await client.send(new GetBucketCorsCommand({ Bucket }))).CORSRules ?? [];
  } catch (error) {
    if (error.name === "NoSuchCORSConfiguration") return [];
    throw error;
  }
}

try {
  console.log(`Bucket: ${Bucket}`);
  console.log("Current CORS rules:", JSON.stringify(await currentRules(), null, 2));
  await client.send(new PutBucketCorsCommand({ Bucket, CORSConfiguration: { CORSRules: [rule] } }));
  const applied = await currentRules();
  console.log("Applied CORS rules:", JSON.stringify(applied, null, 2));
  const ok = applied.some((r) => origins.every((o) => r.AllowedOrigins?.includes(o)) && r.AllowedMethods?.includes("PUT"));
  if (!ok) {
    console.error("The bucket did not report the rule back as expected.");
    process.exit(1);
  }
  console.log(`Done. Browser uploads allowed from: ${origins.join(", ")}`);
} catch (error) {
  // Name and status only: S3 errors can include request details.
  console.error(`Failed: ${error.name} (HTTP ${error.$metadata?.httpStatusCode ?? "?"})`);
  process.exit(1);
}
