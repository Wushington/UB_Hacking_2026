import "server-only";
import { and, count, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { CompleteSession } from "@/contracts/study";
import { recordMissedCardsForSession } from "@/lib/weak-concepts/store";
import type { SessionTotals } from "./handler";

const { flashcardDecks, flashcards, studyReviewEvents, studySessions } = schema;

/** Starts an in-progress session on a deck the user owns; null when it isn't theirs. */
export async function createStudySession(userId: string, deckId: string): Promise<{ sessionId: string } | null> {
  const db = getDb();
  const [deck] = await db
    .select({ id: flashcardDecks.id, cardCount: count(flashcards.id) })
    .from(flashcardDecks)
    .leftJoin(flashcards, eq(flashcards.deckId, flashcardDecks.id))
    .where(and(eq(flashcardDecks.id, deckId), eq(flashcardDecks.userId, userId)))
    .groupBy(flashcardDecks.id);
  if (!deck) return null;
  const [session] = await db.insert(studySessions).values({ deckId, userId, totalCount: deck.cardCount }).returning({ id: studySessions.id });
  return { sessionId: session.id };
}

/** The session's deck card ids and, once completed, its saved totals; null when it isn't the user's. */
export async function loadStudySession(userId: string, sessionId: string): Promise<{ cardIds: string[]; completed: SessionTotals | null } | null> {
  const db = getDb();
  const [session] = await db
    .select()
    .from(studySessions)
    .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId)));
  if (!session) return null;
  const cards = await db.select({ id: flashcards.id }).from(flashcards).where(eq(flashcards.deckId, session.deckId));
  const { correctCount, missedCount, totalCount } = session;
  return { cardIds: cards.map((c) => c.id), completed: session.status === "completed" ? { correctCount, missedCount, totalCount } : null };
}

/**
 * Saves every card's result, the session totals and the weak concepts from missed cards in one
 * transaction. Repeating it is harmless: results are unique per (session, card) and a completed
 * session is never re-scored.
 */
export async function completeStudySession(userId: string, sessionId: string, results: CompleteSession["results"], totals: SessionTotals): Promise<void> {
  await getDb().transaction(async (tx) => {
    const updated = await tx
      .update(studySessions)
      .set({ status: "completed", completedAt: new Date(), ...totals })
      .where(and(eq(studySessions.id, sessionId), eq(studySessions.userId, userId), eq(studySessions.status, "in_progress")))
      .returning({ id: studySessions.id });
    if (updated.length === 0) return; // already completed by an earlier request
    await tx
      .insert(studyReviewEvents)
      .values(results.map((r) => ({ sessionId, userId, flashcardId: r.flashcardId, result: r.result })))
      .onConflictDoNothing();
    await recordMissedCardsForSession(tx, userId, sessionId);
  });
}
