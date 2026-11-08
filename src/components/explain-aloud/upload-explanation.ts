import {
  finalizeUploadResponseSchema,
  prepareUploadResponseSchema,
  type FinalizeUpload,
  type PrepareUpload,
} from "@/contracts/uploads";
import type { AudioMimeType } from "@/lib/recording";

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

async function serverMessage(res: Response, fallback: string) {
  try {
    const body = (await res.json()) as { error?: unknown };
    return typeof body.error === "string" && res.status < 500 ? body.error : fallback;
  } catch {
    return fallback;
  }
}

const postJson = (fetchImpl: typeof fetch, url: string, body: PrepareUpload | FinalizeUpload) =>
  fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

/**
 * prepare → PUT straight to the private bucket via the presigned URL → finalize.
 * Returns the new audio_recordings id. Errors carry a message that's safe to show the student.
 */
export async function uploadExplanation(
  input: {
    blob: Blob;
    mimeType: AudioMimeType;
    lectureId: string;
    durationMs: number;
    /** The open weak concept being explained; omitted for a free explanation of the whole class. */
    conceptKey?: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const prepared = await postJson(fetchImpl, "/api/uploads/prepare", {
    purpose: "explanation_audio",
    mimeType: input.mimeType,
    byteSize: input.blob.size,
  });
  if (!prepared.ok) throw new UploadError(await serverMessage(prepared, "Couldn’t start the upload. Please try again."));
  const { uploadId, uploadUrl } = prepareUploadResponseSchema.parse(await prepared.json());

  let put: Response;
  try {
    put = await fetchImpl(uploadUrl, { method: "PUT", headers: { "Content-Type": input.mimeType }, body: input.blob });
  } catch {
    // A CORS block or network failure both surface as a TypeError here.
    throw new UploadError("Couldn’t reach storage. Check your connection and try again.");
  }
  if (!put.ok) throw new UploadError("Storage rejected the upload. Please try again.");

  const finalized = await postJson(fetchImpl, "/api/uploads/finalize", {
    uploadId,
    purpose: "explanation_audio",
    lectureId: input.lectureId,
    durationMs: Math.max(1, Math.round(input.durationMs)),
    ...(input.conceptKey ? { conceptKey: input.conceptKey } : {}),
  });
  if (!finalized.ok) throw new UploadError(await serverMessage(finalized, "Couldn’t save your recording. Please try again."));
  return finalizeUploadResponseSchema.parse(await finalized.json()).id;
}
