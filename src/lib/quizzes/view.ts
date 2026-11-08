/** One row of the Quizzes page: a lecture and how studying its latest flashcard deck has gone. */
export type QuizRow = {
  lectureId: string;
  title: string;
  /** Cards in the latest deck; null when no deck has been generated yet. */
  cardCount: number | null;
  /** Completed sessions on the latest deck. */
  sessionCount: number;
  /** Percent correct in the most recent completed session on the latest deck. */
  lastScore: number | null;
};

type LectureRow = { id: string; title: string; updatedAt: Date };
type DeckRow = { id: string; lectureId: string; createdAt: Date; cardCount: number };
type SessionRow = { deckId: string; correctCount: number; totalCount: number; completedAt: Date | null };

export function toQuizRows(lectures: LectureRow[], decks: DeckRow[], sessions: SessionRow[]): QuizRow[] {
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
        lectureId: lecture.id,
        title: lecture.title,
        cardCount: deck ? deck.cardCount : null,
        sessionCount: done.length,
        lastScore: last && last.totalCount ? Math.round((last.correctCount / last.totalCount) * 100) : null,
      };
    });
}
