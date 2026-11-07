import "server-only";
import { randomUUID } from "node:crypto";
import type { UploadPurpose } from "@/contracts/uploads";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { parseEnv } from "@/lib/env";

/**
 * Private Vultr Object Storage (S3-compatible). The bucket is never public:
 * browsers get short-lived presigned URLs; the database stores only the object key.
 */
const URL_TTL_SECONDS = 300;

let cached: { client: S3Client; bucket: string } | undefined;

function storage() {
  if (!cached) {
    const env = parseEnv("storage");
    cached = {
      bucket: env.VULTR_S3_BUCKET,
      client: new S3Client({
        endpoint: env.VULTR_S3_ENDPOINT,
        region: env.VULTR_S3_REGION,
        credentials: { accessKeyId: env.VULTR_S3_ACCESS_KEY_ID, secretAccessKey: env.VULTR_S3_SECRET_ACCESS_KEY },
      }),
    };
  }
  return cached;
}

/** Randomized key, namespaced by owner and purpose. Store it on the media row. */
export function newObjectKey(userId: string, purpose: UploadPurpose): string {
  return `users/${userId}/${purpose}/${randomUUID()}`;
}

export async function presignUpload(key: string, contentType: string): Promise<string> {
  const { client, bucket } = storage();
  return getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), {
    expiresIn: URL_TTL_SECONDS,
  });
}

export async function presignDownload(key: string): Promise<string> {
  const { client, bucket } = storage();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: URL_TTL_SECONDS });
}

/** Server-side read (e.g. to send an image or audio file to Gemini). */
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const { client, bucket } = storage();
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!res.Body) throw new Error(`Empty object: ${key}`);
  return res.Body.transformToByteArray();
}
