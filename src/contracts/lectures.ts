import { z } from "zod";
import { categoryInputSchema } from "./categories";

/**
 * POST /api/lectures — starts a new class session from the Capture page.
 * `category` picks one of the user's categories by id, creates one by name
 * (reusing an existing one with the same normalized name), or leaves it uncategorized.
 */
export const createLectureSchema = z.object({
  category: z.union([z.object({ id: z.uuid() }), categoryInputSchema, z.null()]).default(null),
});
export type CreateLecture = z.input<typeof createLectureSchema>;

export const createLectureResponseSchema = z.object({ id: z.uuid() });
export type CreateLectureResponse = z.infer<typeof createLectureResponseSchema>;

/** 200 body of PATCH /api/lectures/[id]: the saved notes and the new revision to edit from next. */
export const notesSavedResponseSchema = z.object({ revision: z.number().int().nonnegative() });
export type NotesSavedResponse = z.infer<typeof notesSavedResponseSchema>;
