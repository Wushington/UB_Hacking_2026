import { z } from "zod";

/** Where a weakness was identified (rows in weak_concept_sources). */
export const WEAK_CONCEPT_SOURCE_TYPES = ["study_review_event", "explanation_weak_point"] as const;

export const weakConceptViewSchema = z.object({
  id: z.uuid(),
  lectureId: z.uuid(),
  label: z.string(),
  missedCardCount: z.number().int().nonnegative(),
  explanationFeedbackCount: z.number().int().nonnegative(),
  lastSeenAt: z.iso.datetime(),
  relatedCardIds: z.array(z.uuid()),
});
export type WeakConceptView = z.infer<typeof weakConceptViewSchema>;
