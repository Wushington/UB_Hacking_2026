import { describe, expect, it } from "vitest";
import { toQuizRows } from "./view";

const day = (d: number) => new Date(Date.UTC(2026, 10, d));

describe("toQuizRows", () => {
  it("lists every lecture with its latest deck and last completed score, newest lecture first", () => {
    const rows = toQuizRows(
      [
        { id: "l1", title: "Cells", updatedAt: day(1) },
        { id: "l2", title: "Genetics", updatedAt: day(5) },
      ],
      [
        { id: "d-old", lectureId: "l1", createdAt: day(1), cardCount: 5 },
        { id: "d-new", lectureId: "l1", createdAt: day(3), cardCount: 8 },
      ],
      [
        { deckId: "d-old", correctCount: 5, totalCount: 5, completedAt: day(2) },
        { deckId: "d-new", correctCount: 3, totalCount: 8, completedAt: day(4) },
        { deckId: "d-new", correctCount: 6, totalCount: 8, completedAt: day(6) },
      ],
    );
    expect(rows).toEqual([
      { lectureId: "l2", title: "Genetics", cardCount: null, sessionCount: 0, lastScore: null },
      { lectureId: "l1", title: "Cells", cardCount: 8, sessionCount: 2, lastScore: 75 },
    ]);
  });
});
