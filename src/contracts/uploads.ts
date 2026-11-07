import { z } from "zod";
import { AUDIO_MIME_TYPES } from "./audio";
import { IMAGE_MIME_TYPES } from "./images";

const MB = 1024 * 1024;

/** Per-file size limits. Duration limits live in ./audio (MAX_RECORDING_MS). */
export const MAX_UPLOAD_BYTES = {
  lecture_image: 10 * MB,
  lecture_audio: 50 * MB,
  explanation_audio: 10 * MB,
} as const;

const size = (max: number) => z.number().int().positive().max(max);

/** POST /api/uploads/prepare — the server validates intent before issuing a short-lived upload URL. */
export const prepareUploadSchema = z.discriminatedUnion("purpose", [
  z.object({
    purpose: z.literal("lecture_image"),
    mimeType: z.enum(IMAGE_MIME_TYPES),
    byteSize: size(MAX_UPLOAD_BYTES.lecture_image),
  }),
  z.object({
    purpose: z.literal("lecture_audio"),
    mimeType: z.enum(AUDIO_MIME_TYPES),
    byteSize: size(MAX_UPLOAD_BYTES.lecture_audio),
  }),
  z.object({
    purpose: z.literal("explanation_audio"),
    mimeType: z.enum(AUDIO_MIME_TYPES),
    byteSize: size(MAX_UPLOAD_BYTES.explanation_audio),
  }),
]);
export type PrepareUpload = z.infer<typeof prepareUploadSchema>;
export type UploadPurpose = PrepareUpload["purpose"];

export const prepareUploadResponseSchema = z.object({
  uploadId: z.uuid(),
  uploadUrl: z.url(),
  expiresAt: z.iso.datetime(),
});
export type PrepareUploadResponse = z.infer<typeof prepareUploadResponseSchema>;

/** POST /api/uploads/finalize — the server verifies the stored object before recording it. */
export const finalizeUploadSchema = z.object({
  uploadId: z.uuid(),
  lectureId: z.uuid().optional(),
});
export type FinalizeUpload = z.infer<typeof finalizeUploadSchema>;
