import type { SubjectLecture } from "@/components/subjects/subjects-layout";

/** How studying a lecture's latest flashcard deck has gone. */
type DeckStats = {
  /** Cards in the latest deck; null when no deck has been generated yet. */
  cardCount: number | null;
  /** Completed sessions on the latest deck. */
  sessionCount: number;
  /** Percent correct in the most recent completed session on the latest deck. */
  lastScore: number | null;
};

/** One deck on the Flashcards page: a lecture (with its subject) and its study results. */
export type QuizRow = SubjectLecture & DeckStats;

type DeckRow = { id: string; lectureId: string; createdAt: Date; cardCount: number };
type SessionRow = { deckId: string; correctCount: number; totalCount: number; completedAt: Date | null };

export function toQuizRows<L extends { id: string; updatedAt: Date }>(lectures: L[], decks: DeckRow[], sessions: SessionRow[]): (L & DeckStats)[] {
  const latestDeck = new Map<string, DeckRow>();
  for (const deck of decks) {
    const current = latestDeck.get(deck.lectureId);
    if (!current || deck.createdAt > current.createdAt) latestDeck.set(deck.lectureId, deck);
  }
  return [...lectures]
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())
    .map((lecture) => {
      const deck = latestDeck.get(lecture.id);
      const done = sessions
        .filter((s) => deck && s.deckId === deck.id && s.completedAt)
        .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
      const last = done[0];
      return {
        ...lecture,
        cardCount: deck ? deck.cardCount : null,
        sessionCount: done.length,
        lastScore: last && last.totalCount ? Math.round((last.correctCount / last.totalCount) * 100) : null,
      };
    });
}
