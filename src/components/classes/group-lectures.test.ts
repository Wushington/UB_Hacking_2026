import { describe, expect, it } from "vitest";
import { groupByClass, type ClassLecture } from "./group-lectures";

const lecture = (id: string, categoryId: string | null, categoryName: string | null): ClassLecture => ({
  id,
  title: id,
  status: "ready",
  updatedAt: new Date("2026-11-08T00:00:00Z"),
  categoryId,
  categoryName,
});

describe("groupByClass", () => {
  it("groups by class in order of the newest lecture, with uncategorized last", () => {
    const groups = groupByClass([
      lecture("a", null, null),
      lecture("b", "bio", "Cell Biology"),
      lecture("c", "calc", "Calculus II"),
      lecture("d", "bio", "Cell Biology"),
    ]);
    expect(groups.map((g) => [g.name, g.lectures.map((l) => l.id)])).toEqual([
      ["Cell Biology", ["b", "d"]],
      ["Calculus II", ["c"]],
      ["No class yet", ["a"]],
    ]);
  });

  it("returns nothing for no lectures", () => {
    expect(groupByClass([])).toEqual([]);
  });
});
