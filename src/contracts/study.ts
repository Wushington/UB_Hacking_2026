import { z } from "zod";
import { isUnique } from "./shared";

export const REVIEW_RESULTS = ["got_it", "missed"] as const;
export const SESSION_STATUSES = ["in_progress", "completed"] as const;
export type ReviewResult = (typeof REVIEW_RESULTS)[number];

/** POST /api/study-sessions/[id]/complete — one result per card; saved in one transaction. */
export const completeSessionSchema = z.object({
  results: z
    .array(z.object({ flashcardId: z.uuid(), result: z.enum(REVIEW_RESULTS) }))
    .min(1)
    .refine((r) => isUnique(r.map((x) => x.flashcardId)), "Each card can be graded only once per session"),
});
export type CompleteSession = z.infer<typeof completeSessionSchema>;
