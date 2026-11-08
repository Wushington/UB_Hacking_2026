import { IMAGE_MIME_TYPES, MAX_IMAGES_PER_BATCH } from "@/contracts/images";
import { createLectureResponseSchema, type CreateLecture } from "@/contracts/lectures";
import { finalizeUploadResponseSchema, MAX_UPLOAD_BYTES, prepareUploadResponseSchema } from "@/contracts/uploads";

export type PhotoMimeType = (typeof IMAGE_MIME_TYPES)[number];

/** Errors whose message is safe to show the student. */
export class CaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CaptureError";
  }
}

const BY_EXTENSION: Record<string, PhotoMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
};

/**
 * The photo's MIME type, or null if it isn't a supported photo. Falls back to the extension because
 * many browsers (e.g. Chrome on Windows) report HEIC files with an empty type.
 */
export function photoMimeType(file: { name: string; type: string }): PhotoMimeType | null {
  const type = file.type.toLowerCase();
  if ((IMAGE_MIME_TYPES as readonly string[]).includes(type)) return type as PhotoMimeType;
  if (type === "image/jpg") return "image/jpeg";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return BY_EXTENSION[ext] ?? null;
}

export function isAudioFile(file: { name: string; type: string }): boolean {
  return file.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|webm|aac)$/i.test(file.name);
}

/** Why this file can't be added, or null if it can. */
export function photoProblem(file: { name: string; type: string; size: number }): string | null {
  if (isAudioFile(file)) return "Lecture audio is coming soon. For now, add whiteboard photos.";
  if (!photoMimeType(file)) return "Photos must be JPG, PNG, WebP or HEIC.";
  if (file.size <= 0) return "That file is empty.";
  if (file.size > MAX_UPLOAD_BYTES.lecture_image) return "Photos can be up to 20 MB.";
  return null;
}

export const MAX_PHOTOS = MAX_IMAGES_PER_BATCH;

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function serverMessage(res: Response, fallback: string) {
  try {
    const body = (await res.json()) as { error?: unknown };
    return typeof body.error === "string" && res.status < 500 ? body.error : fallback;
  } catch {
    return fallback;
  }
}

const postJson = (fetchImpl: typeof fetch, url: string, body: unknown) =>
  fetchImpl(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export async function createLecture(category: CreateLecture["category"], fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await postJson(fetchImpl, "/api/lectures", { category });
  if (!res.ok) throw new CaptureError(await serverMessage(res, "Couldn’t create your notes. Please try again."));
  return createLectureResponseSchema.parse(await res.json()).id;
}

/** Best-effort cleanup of an abandoned attempt. `unfinished=1`: the server never deletes generated notes here. */
export async function discardLecture(lectureId: string, fetchImpl: typeof fetch = fetch): Promise<void> {
  try {
    await fetchImpl(`/api/lectures/${lectureId}?unfinished=1`, { method: "DELETE" });
  } catch {
    // Leaving an unfinished attempt behind is harmless; it shows as "Needs another try" in My subjects.
  }
}

/** prepare → PUT straight to the private bucket → finalize. Returns the lecture_images id. */
export async function uploadPhoto(
  input: { file: Blob; mimeType: PhotoMimeType; lectureId: string },
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const prepared = await postJson(fetchImpl, "/api/uploads/prepare", {
    purpose: "lecture_image",
    mimeType: input.mimeType,
    byteSize: input.file.size,
  });
  if (!prepared.ok) throw new CaptureError(await serverMessage(prepared, "Couldn’t start the upload. Please try again."));
  const { uploadId, uploadUrl } = prepareUploadResponseSchema.parse(await prepared.json());

  let put: Response;
  try {
    put = await fetchImpl(uploadUrl, { method: "PUT", headers: { "Content-Type": input.mimeType }, body: input.file });
  } catch {
    // A CORS block or network failure both surface as a TypeError here.
    throw new CaptureError("Couldn’t reach storage. Check your connection and try again.");
  }
  if (!put.ok) throw new CaptureError("Storage rejected the upload. Please try again.");

  const finalized = await postJson(fetchImpl, "/api/uploads/finalize", {
    uploadId,
    purpose: "lecture_image",
    lectureId: input.lectureId,
  });
  if (!finalized.ok) throw new CaptureError(await serverMessage(finalized, "Couldn’t save your photo. Please try again."));
  return finalizeUploadResponseSchema.parse(await finalized.json()).id;
}

/** Runs the AI service on the uploaded photos. Resolves once the notes are saved. */
export async function processLecture(lectureId: string, imageIds: string[], fetchImpl: typeof fetch = fetch): Promise<void> {
  const res = await postJson(fetchImpl, `/api/lectures/${lectureId}/process`, { imageIds });
  if (res.ok) return;
  // A retry after the notes were already saved (e.g. the response was lost) counts as success.
  if (res.status === 409) {
    const message = await serverMessage(res, "");
    if (/already generated/i.test(message)) return;
    throw new CaptureError(message || "These notes are already being organized.");
  }
  // This route only returns messages written for students (never raw upstream errors), so show them for 5xx too.
  let message = "";
  try {
    const body = (await res.json()) as { error?: unknown };
    if (typeof body.error === "string") message = body.error;
  } catch {}
  throw new CaptureError(message || "Couldn’t organize your notes right now. Please try again.");
}

export type PhotoStatus = "ready" | "uploading" | "uploaded" | "failed";
export type QueuedPhoto = { key: string; file: File; mimeType: PhotoMimeType; status: PhotoStatus; imageId?: string };

export type OrganizeProgress =
  | { stage: "creating" }
  | { stage: "uploading"; key: string; index: number; total: number }
  | { stage: "uploaded"; key: string; imageId: string }
  | { stage: "upload-failed"; key: string }
  | { stage: "processing" };

/**
 * The whole "Organize notes" flow. Reuses an existing lecture and already-uploaded photos, so a
 * retry after a failure only redoes what failed. Returns the lecture id.
 */
export async function organizeNotes(
  input: { photos: QueuedPhoto[]; category: CreateLecture["category"]; lectureId: string | null },
  onProgress: (p: OrganizeProgress & { lectureId?: string }) => void,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  let lectureId = input.lectureId;
  if (!lectureId) {
    onProgress({ stage: "creating" });
    lectureId = await createLecture(input.category, fetchImpl);
  }

  const imageIds: string[] = [];
  for (const [index, photo] of input.photos.entries()) {
    if (photo.imageId) {
      imageIds.push(photo.imageId);
      continue;
    }
    onProgress({ stage: "uploading", key: photo.key, index, total: input.photos.length, lectureId });
    try {
      const imageId = await uploadPhoto({ file: photo.file, mimeType: photo.mimeType, lectureId }, fetchImpl);
      onProgress({ stage: "uploaded", key: photo.key, imageId, lectureId });
      imageIds.push(imageId);
    } catch (error) {
      onProgress({ stage: "upload-failed", key: photo.key, lectureId });
      throw error;
    }
  }

  onProgress({ stage: "processing", lectureId });
  await processLecture(lectureId, imageIds, fetchImpl);
  return lectureId;
}
