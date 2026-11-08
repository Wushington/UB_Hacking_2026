import { z } from "zod";
import { categoryInputSchema } from "./categories";

/**
 * Which subject (stored as a category) a set of notes belongs to: one of the user's subjects by id,
 * a new or existing one by name (matched by normalized name), or none.
 */
export const subjectChoiceSchema = z.union([z.object({ id: z.uuid() }), categoryInputSchema, z.null()]);
export type SubjectChoice = z.infer<typeof subjectChoiceSchema>;

/** POST /api/lectures — starts a new set of notes from the Capture page. */
export const createLectureSchema = z.object({
  category: subjectChoiceSchema.default(null),
});
export type CreateLecture = z.input<typeof createLectureSchema>;

export const createLectureResponseSchema = z.object({ id: z.uuid() });
export type CreateLectureResponse = z.infer<typeof createLectureResponseSchema>;

/** PATCH /api/lectures/[id] — move notes to another subject (or none). */
export const changeSubjectSchema = z.object({ category: subjectChoiceSchema });
export type ChangeSubject = z.infer<typeof changeSubjectSchema>;

export const changeSubjectResponseSchema = z.object({ subjectName: z.string().nullable() });
export type ChangeSubjectResponse = z.infer<typeof changeSubjectResponseSchema>;
