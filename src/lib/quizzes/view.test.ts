import { describe, expect, it } from "vitest";
import { toQuizRows } from "./view";

const day = (d: number) => new Date(Date.UTC(2026, 10, d));
const lecture = (id: string, title: string, d: number, categoryId: string | null) => ({
  id,
  title,
  status: "ready" as const,
  updatedAt: day(d),
  categoryId,
  categoryName: categoryId,
});

describe("toQuizRows", () => {
  it("lists every lecture with its latest deck and last completed score, newest lecture first", () => {
    const rows = toQuizRows(
      [lecture("l1", "Cells", 1, "bio"), lecture("l2", "Genetics", 5, null)],
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
      { ...lecture("l2", "Genetics", 5, null), cardCount: null, sessionCount: 0, lastScore: null },
      { ...lecture("l1", "Cells", 1, "bio"), cardCount: 8, sessionCount: 2, lastScore: 75 },
    ]);
  });
});
