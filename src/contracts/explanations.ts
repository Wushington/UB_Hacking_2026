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
  /**
   * Keys of the student's open weak concepts (given to Gemini) that this explanation now covers
   * correctly. Never includes a concept flagged as a weak point in the same attempt.
   */
  masteredConceptKeys: z.array(nonEmptyText).default([]),
});
export type ExplanationFeedback = z.infer<typeof explanationFeedbackSchema>;

/** A weak concept an attempt showed understanding of (stored on explanation_feedback). */
export const masteredConceptSchema = z.object({ conceptKey: nonEmptyText, label: nonEmptyText });
export type MasteredConcept = z.infer<typeof masteredConceptSchema>;

/** Self-ratings at or above this remove the weak concept; below it, the concept is marked resolved. */
export const SELF_RATING_REMOVE_THRESHOLD = 4;

/** POST /api/explanations/[recordingId]/self-rating: the student's 1–5 rating of a sound explanation. */
export const selfRatingSchema = z.object({ rating: z.number().int().min(1).max(5) });
export type SelfRating = z.infer<typeof selfRatingSchema>;

export const SELF_RATING_OUTCOMES = ["removed", "resolved"] as const;
export type SelfRatingOutcome = (typeof SELF_RATING_OUTCOMES)[number];

export const selfRatingResponseSchema = z.object({
  rating: z.number().int().min(1).max(5),
  outcome: z.enum(SELF_RATING_OUTCOMES),
  concepts: z.array(z.string()),
});
export type SelfRatingResponse = z.infer<typeof selfRatingResponseSchema>;

export function selfRatingOutcome(rating: number): SelfRatingOutcome {
  return rating >= SELF_RATING_REMOVE_THRESHOLD ? "removed" : "resolved";
}
