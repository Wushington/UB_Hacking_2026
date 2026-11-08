import "server-only";
import { and, count, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { listLectures } from "@/lib/lectures/store";
import { toQuizRows, type QuizRow } from "./view";

const { flashcardDecks, flashcards, studySessions } = schema;

/** The user's lectures with their latest deck and study results. Every query is scoped to `userId`. */
export async function listQuizzes(userId: string): Promise<QuizRow[]> {
  const db = getDb();
  const [lectureRows, deckRows, sessionRows] = await Promise.all([
    listLectures(userId),
    db
      .select({ id: flashcardDecks.id, lectureId: flashcardDecks.lectureId, createdAt: flashcardDecks.createdAt, cardCount: count(flashcards.id) })
      .from(flashcardDecks)
      .leftJoin(flashcards, eq(flashcards.deckId, flashcardDecks.id))
      .where(eq(flashcardDecks.userId, userId))
      .groupBy(flashcardDecks.id),
    db
      .select({ deckId: studySessions.deckId, correctCount: studySessions.correctCount, totalCount: studySessions.totalCount, completedAt: studySessions.completedAt })
      .from(studySessions)
      .where(and(eq(studySessions.userId, userId), eq(studySessions.status, "completed"))),
  ]);
  return toQuizRows(lectureRows, deckRows, sessionRows);
}
