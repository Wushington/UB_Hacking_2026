import { randomUUID } from "node:crypto";
import { prepareUploadSchema, type PrepareUploadResponse } from "@/contracts/uploads";
import { jsonError, parseJson, userIdOr401 } from "@/lib/api";
import { objectKeyFor, presignUpload, UPLOAD_URL_TTL_SECONDS } from "@/lib/storage";

/**
 * Step 1 of an upload: validates the declared type/size and returns a short-lived URL the
 * browser PUTs the file to directly (the bucket stays private). Nothing is saved yet; the
 * object only becomes a row after /api/uploads/finalize verifies it.
 */
export async function POST(request: Request) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;

  const input = await parseJson(request, prepareUploadSchema);
  if (input instanceof Response) return input;

  const uploadId = randomUUID();
  let uploadUrl: string;
  try {
    uploadUrl = await presignUpload(objectKeyFor(userId, input.purpose, uploadId), input.mimeType);
  } catch (error) {
    console.error("presignUpload failed:", (error as Error).message);
    return jsonError(503, "Storage is not available");
  }

  const body: PrepareUploadResponse = {
    uploadId,
    uploadUrl,
    expiresAt: new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000).toISOString(),
  };
  return Response.json(body);
}
