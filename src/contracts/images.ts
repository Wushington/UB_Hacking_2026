import { z } from "zod";
import { isUnique } from "./shared";

/** Story #11: JPG/JPEG, PNG and WebP. */
export const IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MIN_IMAGES_PER_BATCH = 2;
export const MAX_IMAGES_PER_BATCH = 5;

/** POST /api/lectures/[id]/process — finalized image ids in the order the student chose. */
export const imageBatchSchema = z.object({
  imageIds: z
    .array(z.uuid())
    .min(MIN_IMAGES_PER_BATCH)
    .max(MAX_IMAGES_PER_BATCH)
    .refine(isUnique, "Each image can appear only once"),
});
export type ImageBatch = z.infer<typeof imageBatchSchema>;

export const lectureImageSchema = z.object({
  id: z.uuid(),
  lectureId: z.uuid(),
  mimeType: z.enum(IMAGE_MIME_TYPES),
  byteSize: z.number().int().positive(),
  position: z.number().int().nonnegative(),
});
export type LectureImage = z.infer<typeof lectureImageSchema>;
