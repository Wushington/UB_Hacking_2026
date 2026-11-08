import { describe, expect, it } from "vitest";
import { groupBySubject, type SubjectLecture } from "./group-lectures";

const lecture = (id: string, categoryId: string | null, categoryName: string | null): SubjectLecture => ({
  id,
  title: id,
  status: "ready",
  updatedAt: new Date("2026-11-08T00:00:00Z"),
  categoryId,
  categoryName,
});

describe("groupBySubject", () => {
  it("groups by subject in order of the newest lecture, with uncategorized last", () => {
    const groups = groupBySubject([
      lecture("a", null, null),
      lecture("b", "bio", "Cell Biology"),
      lecture("c", "calc", "Calculus II"),
      lecture("d", "bio", "Cell Biology"),
    ]);
    expect(groups.map((g) => [g.name, g.lectures.map((l) => l.id)])).toEqual([
      ["Cell Biology", ["b", "d"]],
      ["Calculus II", ["c"]],
      ["No subject", ["a"]],
    ]);
  });

  it("returns nothing for no lectures", () => {
    expect(groupBySubject([])).toEqual([]);
  });
});
