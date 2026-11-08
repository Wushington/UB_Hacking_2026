import { z } from "zod";

/** Where a weakness was identified (rows in weak_concept_sources). */
export const WEAK_CONCEPT_SOURCE_TYPES = ["study_review_event", "explanation_weak_point"] as const;
export type WeakConceptSourceType = (typeof WEAK_CONCEPT_SOURCE_TYPES)[number];

/**
 * Shared concept identifier for flashcards (GeneratedCard.conceptKey) and explanation weak points
 * (WeakPoint.conceptKey). Keys are scoped to a lecture: the same key in two lectures is two concepts.
 * "Glycolysis Location", "glycolysis_location" and "glycolysis-location" are the same concept.
 */
export function normalizeConceptKey(key: string): string {
  // Same rules as the explanation grader (src/lib/explain-aloud/grading.ts) so both sources merge.
  return key
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export const weakConceptViewSchema = z.object({
  id: z.uuid(),
  lectureId: z.uuid(),
  lectureTitle: z.string(),
  label: z.string(),
  missedCardCount: z.number().int().nonnegative(),
  explanationFeedbackCount: z.number().int().nonnegative(),
  lastSeenAt: z.iso.datetime(),
  /** Flashcards the student marked Missed for this concept (empty for recording-only weaknesses). */
  relatedCards: z.array(z.object({ id: z.uuid(), question: z.string(), answer: z.string() })),
  /** Latest explanation recording that flagged this concept (opens /explain?recording=…), or null. */
  feedbackRecordingId: z.uuid().nullable(),
});
export type WeakConceptView = z.infer<typeof weakConceptViewSchema>;
