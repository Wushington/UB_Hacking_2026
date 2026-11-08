import "server-only";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { selfRatingOutcome, type SelfRatingResponse } from "@/contracts/explanations";
import { getDb, schema } from "@/db";

const { explanationFeedback, weakConcepts } = schema;

export type ApplySelfRatingResult =
  | { ok: true; response: SelfRatingResponse }
  | { ok: false; status: 404 | 409; error: string };

/**
 * Records the student's 1–5 rating of a sound explanation and applies it to the weak concepts that
 * attempt mastered: 4–5 removes them, 1–3 marks them resolved (reopened later if they struggle
 * again). One rating per attempt; everything happens in one transaction.
 */
export async function applySelfRating(userId: string, recordingId: string, rating: number): Promise<ApplySelfRatingResult> {
  return getDb().transaction(async (tx) => {
    const [feedback] = await tx
      .select({
        id: explanationFeedback.id,
        lectureId: explanationFeedback.lectureId,
        mastered: explanationFeedback.masteredConcepts,
        selfRating: explanationFeedback.selfRating,
      })
      .from(explanationFeedback)
      .where(and(eq(explanationFeedback.recordingId, recordingId), eq(explanationFeedback.userId, userId)))
      .limit(1)
      .for("update");

    if (!feedback || feedback.mastered.length === 0) {
      return { ok: false, status: 404, error: "Nothing to rate for this attempt" };
    }
    if (feedback.selfRating !== null) {
      return { ok: false, status: 409, error: "You’ve already rated this attempt" };
    }

    // Only if still unrated, so a concurrent request can't apply a second rating.
    const [rated] = await tx
      .update(explanationFeedback)
      .set({ selfRating: rating })
      .where(and(eq(explanationFeedback.id, feedback.id), isNull(explanationFeedback.selfRating)))
      .returning({ id: explanationFeedback.id });
    if (!rated) return { ok: false, status: 409, error: "You’ve already rated this attempt" };

    const outcome = selfRatingOutcome(rating);
    const keys = feedback.mastered.map((m) => m.conceptKey);
    const target = and(
      eq(weakConcepts.userId, userId),
      eq(weakConcepts.lectureId, feedback.lectureId),
      inArray(weakConcepts.conceptKey, keys),
    );
    if (outcome === "removed") {
      // weak_concept_sources rows go with it (on delete cascade).
      await tx.delete(weakConcepts).where(target);
    } else {
      await tx.update(weakConcepts).set({ resolvedAt: new Date() }).where(target);
    }

    return { ok: true, response: { rating, outcome, concepts: feedback.mastered.map((m) => m.label) } };
  });
}
