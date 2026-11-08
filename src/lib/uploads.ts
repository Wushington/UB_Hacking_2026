import { IMAGE_MIME_TYPES } from "@/contracts/images";
import { MAX_RECORDING_MS, RECORDING_PURPOSES } from "@/contracts/audio";
import { MAX_UPLOAD_BYTES, type UploadPurpose } from "@/contracts/uploads";
import { baseAudioMimeType, type AudioMimeType } from "@/lib/recording";

type RecordingPurpose = (typeof RECORDING_PURPOSES)[number];
type ImageMimeType = (typeof IMAGE_MIME_TYPES)[number];

/** Which audio_recordings.purpose an upload becomes; null for non-audio uploads. */
export function recordingPurposeFor(purpose: UploadPurpose): RecordingPurpose | null {
  if (purpose === "lecture_audio") return "lecture";
  if (purpose === "explanation_audio") return "explanation";
  return null;
}

/** Slack for the client's timer overshooting the auto-stop. */
const DURATION_TOLERANCE_MS = 3_000;

export type UploadCheck =
  | { ok: true; mimeType: AudioMimeType; byteSize: number; durationMs: number | null }
  | { ok: false; reason: string };

/**
 * Validates what actually landed in the bucket (not what the client declared at prepare time)
 * and the client-reported duration. Rejected objects should be deleted by the caller.
 */
export function checkUploadedAudio(
  purpose: UploadPurpose,
  stored: { byteSize: number; contentType: string | null },
  durationMs: number | undefined,
): UploadCheck {
  const recordingPurpose = recordingPurposeFor(purpose);
  if (!recordingPurpose) return { ok: false, reason: "Not an audio upload" };

  const mimeType = baseAudioMimeType(stored.contentType);
  if (!mimeType) return { ok: false, reason: "Unsupported audio type" };
  if (stored.byteSize <= 0) return { ok: false, reason: "Empty upload" };
  if (stored.byteSize > MAX_UPLOAD_BYTES[purpose]) return { ok: false, reason: "Upload is too large" };

  const maxMs = MAX_RECORDING_MS[recordingPurpose];
  if (durationMs !== undefined && durationMs > maxMs + DURATION_TOLERANCE_MS) {
    return { ok: false, reason: `Recording is longer than ${maxMs / 60_000} minutes` };
  }
  return {
    ok: true,
    mimeType,
    byteSize: stored.byteSize,
    durationMs: durationMs === undefined ? null : Math.min(durationMs, maxMs),
  };
}

export type ImageCheck = { ok: true; mimeType: ImageMimeType; byteSize: number } | { ok: false; reason: string };

/** Validates a whiteboard photo as actually stored in the bucket. Rejected objects should be deleted by the caller. */
export function checkUploadedImage(stored: { byteSize: number; contentType: string | null }): ImageCheck {
  const mimeType = (stored.contentType ?? "").split(";")[0].trim().toLowerCase();
  if (!(IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return { ok: false, reason: "Photos must be JPG, PNG, WebP or HEIC" };
  }
  if (stored.byteSize <= 0) return { ok: false, reason: "Empty upload" };
  if (stored.byteSize > MAX_UPLOAD_BYTES.lecture_image) return { ok: false, reason: "Photo is larger than 20 MB" };
  return { ok: true, mimeType: mimeType as ImageMimeType, byteSize: stored.byteSize };
}
