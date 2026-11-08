import { describe, expect, it, vi } from "vitest";
import { currentCard, gradeCard, isComplete, revealAnswer, scoreSession, shuffleCards, startSession, type StudyCard } from "./session";

const cards: StudyCard[] = ["a", "b", "c"].map((id) => ({ id, question: `Question ${id}`, answer: `Answer ${id}`, conceptLabel: "Concept" }));

describe("study session", () => {
  it("copies and shuffles with Fisher–Yates and starts with empty results", () => {
    const original = structuredClone(cards);
    const random = vi.fn(() => 0);
    expect(shuffleCards(cards, random).map((c) => c.id)).toEqual(["b", "c", "a"]);
    expect(random).toHaveBeenCalledTimes(2);
    expect(cards).toEqual(original);
    expect(startSession(cards, () => 0)).toEqual({ cards: [cards[1], cards[2], cards[0]], index: 0, revealed: false, results: [] });
    expect(shuffleCards(cards, () => 0.99)).not.toBe(cards);
  });

  it("visits each card once, advances, hides answers and leaves previous state unchanged", () => {
    let session = startSession(cards, () => 0);
    const visited: string[] = [];
    while (!isComplete(session)) {
      visited.push(currentCard(session)!.id);
      const previous = session;
      const revealed = revealAnswer(session);
      expect(revealed).not.toBe(previous);
      expect(previous.revealed).toBe(false);
      expect(revealed.revealed).toBe(true);
      session = gradeCard(revealed, "got_it");
      expect(session.revealed).toBe(false);
      expect(session.index).toBe(previous.index + 1);
      expect(previous.results).toHaveLength(previous.index);
    }
    expect(new Set(visited)).toEqual(new Set(cards.map((c) => c.id)));
    expect(session.results.map((r) => r.flashcardId)).toEqual(visited);
    expect(session.results).toHaveLength(cards.length);
    expect(currentCard(session)).toBeUndefined();
  });

  it("ignores grading before reveal", () => {
    const session = startSession(cards);
    expect(gradeCard(session, "got_it")).toBe(session);
    expect(gradeCard(session, "missed")).toBe(session);
    expect(session.results).toEqual([]);
  });

  it("counts correct and missed independently", () => {
    let session = startSession(cards);
    session = gradeCard(revealAnswer(session), "got_it");
    expect(scoreSession(session.results)).toEqual({ correct: 1, missed: 0, total: 1, percent: 100 });
    session = gradeCard(revealAnswer(session), "missed");
    expect(scoreSession(session.results)).toEqual({ correct: 1, missed: 1, total: 2, percent: 50 });
  });

  it.each([[7, 10, 70], [2, 3, 67], [0, 0, 0]])("scores %i of %i as %i percent", (correct, total, percent) => {
    const results = Array.from({ length: total }, (_, i) => ({ flashcardId: String(i), result: i < correct ? "got_it" as const : "missed" as const }));
    expect(scoreSession(results)).toEqual({ correct, missed: total - correct, total, percent });
  });

  it("ignores repeat grading, previously recorded cards and completed sessions", () => {
    const session = startSession(cards, () => 0.99);
    const graded = gradeCard(revealAnswer(session), "got_it");
    expect(gradeCard(graded, "missed")).toBe(graded);
    const duplicate = { ...revealAnswer(session), results: graded.results };
    expect(gradeCard(duplicate, "missed")).toBe(duplicate);
    const completed = gradeCard(revealAnswer(startSession([cards[0]])), "got_it");
    expect(gradeCard(completed, "missed")).toBe(completed);
    expect(revealAnswer(completed)).toBe(completed);
  });

  it("completes an empty deck without a current card", () => {
    const session = startSession([]);
    expect(isComplete(session)).toBe(true);
    expect(currentCard(session)).toBeUndefined();
    expect(revealAnswer(session)).toBe(session);
    expect(gradeCard(session, "missed")).toBe(session);
  });
});
