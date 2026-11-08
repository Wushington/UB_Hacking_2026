import "server-only";
import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { WeakConceptView } from "@/contracts/weak-concepts";
import { missedReviewEvents, recordWeakConceptEvents, toWeakConceptViews, type WeakConceptWriter } from "./core";

const { explanationFeedback, explanationWeakPoints, flashcardDecks, flashcards, lectures, studyReviewEvents, weakConceptSources, weakConcepts } = schema;

type Db = ReturnType<typeof getDb>;
/** A Drizzle transaction; weak-concept updates always run inside the caller's transaction. */
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

function writer(tx: Tx): WeakConceptWriter {
  return {
    async ensureConcept(userId, lectureId, conceptKey, label, seenAt) {
      await tx.insert(weakConcepts).values({ userId, lectureId, conceptKey, label, lastSeenAt: seenAt }).onConflictDoNothing();
      const [row] = await tx
        .select({ id: weakConcepts.id })
        .from(weakConcepts)
        .where(and(eq(weakConcepts.userId, userId), eq(weakConcepts.lectureId, lectureId), eq(weakConcepts.conceptKey, conceptKey)));
      return row.id;
    },
    async addSource(weakConceptId, sourceType, sourceId) {
      const inserted = await tx.insert(weakConceptSources).values({ weakConceptId, sourceType, sourceId }).onConflictDoNothing().returning({ id: weakConceptSources.id });
      return inserted.length > 0;
    },
    async countSource(conceptId, sourceType, label, seenAt) {
      const counter = sourceType === "study_review_event"
        ? { missedCount: sql`${weakConcepts.missedCount} + 1` }
        : { feedbackCount: sql`${weakConcepts.feedbackCount} + 1` };
      await tx
        .update(weakConcepts)
        .set({
          ...counter,
          label,
          lastSeenAt: sql`greatest(${weakConcepts.lastSeenAt}, ${seenAt.toISOString()}::timestamptz)`,
          resolvedAt: null, // a new miss reopens a resolved concept
        })
        .where(eq(weakConcepts.id, conceptId));
    },
  };
}

/**
 * Story #24 ← #20: call inside the transaction that saves a completed study session, after its
 * study_review_events are inserted. Only the user's own events on the user's own decks are read.
 * Safe to call again for the same session: already-recorded events are not counted twice.
 */
export async function recordMissedCardsForSession(tx: Tx, userId: string, sessionId: string) {
  const rows = await tx
    .select({
      reviewEventId: studyReviewEvents.id,
      result: studyReviewEvents.result,
      reviewedAt: studyReviewEvents.reviewedAt,
      lectureId: flashcardDecks.lectureId,
      conceptKey: flashcards.conceptKey,
      conceptLabel: flashcards.conceptLabel,
    })
    .from(studyReviewEvents)
    .innerJoin(flashcards, eq(flashcards.id, studyReviewEvents.flashcardId))
    .innerJoin(flashcardDecks, eq(flashcardDecks.id, flashcards.deckId))
    .where(and(eq(studyReviewEvents.sessionId, sessionId), eq(studyReviewEvents.userId, userId), eq(flashcardDecks.userId, userId)));
  return recordWeakConceptEvents(writer(tx), userId, missedReviewEvents(rows));
}

/** The user's open weak concepts (resolved ones hidden), most recent first, with the flashcards they missed for each. */
export async function listWeakConcepts(userId: string): Promise<WeakConceptView[]> {
  const db = getDb();
  const concepts = await db
    .select({
      id: weakConcepts.id,
      lectureId: weakConcepts.lectureId,
      lectureTitle: lectures.title,
      label: weakConcepts.label,
      missedCount: weakConcepts.missedCount,
      feedbackCount: weakConcepts.feedbackCount,
      lastSeenAt: weakConcepts.lastSeenAt,
    })
    .from(weakConcepts)
    .innerJoin(lectures, and(eq(lectures.id, weakConcepts.lectureId), eq(lectures.userId, userId)))
    .where(and(eq(weakConcepts.userId, userId), isNull(weakConcepts.resolvedAt)))
    .orderBy(desc(weakConcepts.lastSeenAt));
  if (concepts.length === 0) return [];
  const conceptIds = concepts.map((c) => c.id);

  const cards = await db
    .select({ weakConceptId: weakConceptSources.weakConceptId, id: flashcards.id, question: flashcards.question, answer: flashcards.answer })
    .from(weakConceptSources)
    .innerJoin(studyReviewEvents, and(eq(studyReviewEvents.id, weakConceptSources.sourceId), eq(studyReviewEvents.userId, userId)))
    .innerJoin(flashcards, eq(flashcards.id, studyReviewEvents.flashcardId))
    .where(and(eq(weakConceptSources.sourceType, "study_review_event"), inArray(weakConceptSources.weakConceptId, conceptIds)));

  // Recording weaknesses are written by the explanation grader (src/lib/explain-aloud/grade.ts).
  const recordings = await db
    .select({ weakConceptId: weakConceptSources.weakConceptId, recordingId: explanationFeedback.recordingId, createdAt: explanationFeedback.createdAt })
    .from(weakConceptSources)
    .innerJoin(explanationWeakPoints, eq(explanationWeakPoints.id, weakConceptSources.sourceId))
    .innerJoin(explanationFeedback, and(eq(explanationFeedback.id, explanationWeakPoints.feedbackId), eq(explanationFeedback.userId, userId)))
    .where(and(eq(weakConceptSources.sourceType, "explanation_weak_point"), inArray(weakConceptSources.weakConceptId, conceptIds)));
  return toWeakConceptViews(concepts, cards, recordings);
}
