import { z } from "zod";
import { nonEmptyText } from "./shared";

/** A weakness supported by the student's explanation and grounded in specific note blocks. */
export const weakPointSchema = z.object({
  conceptKey: nonEmptyText,
  label: nonEmptyText,
  explanation: nonEmptyText,
  referenceNoteBlockIds: z.array(z.uuid()).min(1),
  evidence: z.string().optional(),
});
export type WeakPoint = z.infer<typeof weakPointSchema>;

/** Most ideas listed under "What you covered". */
export const MAX_COVERED_IDEAS = 5;

/**
 * Gemini explanation-evaluation output. An empty weakPoints list is valid.
 * summary / covered / nextStep are the coaching parts shown above and below the gaps; they're
 * optional so feedback saved before they existed (or a sparse answer) still validates.
 */
export const explanationFeedbackSchema = z.object({
  transcriptText: z.string(),
  weakPoints: z.array(weakPointSchema),
  /** One or two encouraging sentences: what landed and what to sharpen. */
  summary: nonEmptyText.optional(),
  /** Ideas from the notes the student explained correctly. */
  covered: z.array(nonEmptyText).max(MAX_COVERED_IDEAS).default([]),
  /** A concrete instruction for the next attempt. */
  nextStep: nonEmptyText.optional(),
});
export type ExplanationFeedback = z.infer<typeof explanationFeedbackSchema>;
