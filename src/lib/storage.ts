import "server-only";
import { randomUUID } from "node:crypto";
import type { UploadPurpose } from "@/contracts/uploads";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
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

export const UPLOAD_URL_TTL_SECONDS = URL_TTL_SECONDS;

/** The object key for an upload. `uploadId` is the random, unguessable part. */
export function objectKeyFor(userId: string, purpose: UploadPurpose, uploadId: string): string {
  return `users/${userId}/${purpose}/${uploadId}`;
}

/** Randomized key, namespaced by owner and purpose. Store it on the media row. */
export function newObjectKey(userId: string, purpose: UploadPurpose): string {
  return objectKeyFor(userId, purpose, randomUUID());
}

/** Size and type of a stored object, or null if it doesn't exist. */
export async function headObject(key: string): Promise<{ byteSize: number; contentType: string | null } | null> {
  const { client, bucket } = storage();
  try {
    const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { byteSize: res.ContentLength ?? 0, contentType: res.ContentType ?? null };
  } catch (error) {
    const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || (error as Error).name === "NotFound") return null;
    throw error;
  }
}

export async function deleteObject(key: string): Promise<void> {
  const { client, bucket } = storage();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** Short-lived PUT URL. The browser must send exactly this Content-Type header. */
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

/** Server-side write (e.g. a generated JPEG preview next to the original upload). */
export async function putObject(key: string, body: Uint8Array, contentType: string): Promise<void> {
  const { client, bucket } = storage();
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}
