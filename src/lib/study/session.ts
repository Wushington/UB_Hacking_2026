import type { ReviewResult } from "@/contracts/study";

export type StudyCard = { id: string; question: string; answer: string; conceptLabel: string };
export type CardResult = { flashcardId: string; result: ReviewResult };
export type StudySession = { cards: StudyCard[]; index: number; revealed: boolean; results: CardResult[] };
export type SessionScore = { correct: number; missed: number; total: number; percent: number };

export function shuffleCards(cards: readonly StudyCard[], random = Math.random): StudyCard[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function startSession(cards: readonly StudyCard[], random?: () => number): StudySession {
  return { cards: shuffleCards(cards, random), index: 0, revealed: false, results: [] };
}

export function currentCard(s: StudySession): StudyCard | undefined {
  return s.cards[s.index];
}

export function isComplete(s: StudySession): boolean {
  return s.index >= s.cards.length;
}

export function revealAnswer(s: StudySession): StudySession {
  return isComplete(s) || s.revealed ? s : { ...s, revealed: true };
}

export function gradeCard(s: StudySession, result: ReviewResult): StudySession {
  const card = currentCard(s);
  if (!s.revealed || isComplete(s) || !card || s.results.some((r) => r.flashcardId === card.id)) return s;
  return {
    ...s,
    index: s.index + 1,
    revealed: false,
    results: [...s.results, { flashcardId: card.id, result }],
  };
}

export function scoreSession(results: readonly CardResult[]): SessionScore {
  const total = results.length;
  const correct = results.filter((r) => r.result === "got_it").length;
  return { correct, missed: total - correct, total, percent: total ? Math.round(correct / total * 100) : 0 };
}
