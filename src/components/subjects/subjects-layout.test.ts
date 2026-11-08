import { describe, expect, it } from "vitest";
import { buildSubjectsLayout, type SubjectLecture } from "./subjects-layout";

const day = (d: number) => new Date(Date.UTC(2026, 10, d));
const lecture = (id: string, categoryId: string | null, d: number): SubjectLecture => ({
  id,
  title: id,
  status: "ready",
  updatedAt: day(d),
  categoryId,
  categoryName: categoryId,
});
const divider = (id: string, position: number) => ({ id, name: id, position, collapsed: false });

describe("buildSubjectsLayout", () => {
  it("puts notes without a subject first, then ungrouped subjects, then dividers in order", () => {
    const layout = buildSubjectsLayout(
      [lecture("n1", "bio", 7), lecture("n2", null, 6), lecture("n3", "calc", 5), lecture("n4", "bio", 4)],
      [
        { id: "bio", name: "Biology", dividerId: "fall" },
        { id: "calc", name: "Calculus", dividerId: null },
        { id: "art", name: "Art", dividerId: "fall" },
        { id: "chem", name: "Chemistry", dividerId: "spring" },
      ],
      [divider("spring", 1), divider("fall", 0)],
    );
    expect(layout.noSubject.map((l) => l.id)).toEqual(["n2"]);
    expect(layout.ungrouped.map((g) => g.name)).toEqual(["Calculus"]);
    expect(layout.dividers.map((d) => [d.divider.id, d.subjects.map((s) => s.name)])).toEqual([
      ["fall", ["Biology", "Art"]], // newest notes first, empty subjects after
      ["spring", ["Chemistry"]],
    ]);
    expect(layout.dividers[0].subjects[0].lectures.map((l) => l.id)).toEqual(["n1", "n4"]);
  });

  it("shows subjects whose divider is gone above the dividers, and keeps empty dividers", () => {
    const layout = buildSubjectsLayout([], [{ id: "a", name: "A", dividerId: "deleted" }], [divider("empty", 0)]);
    expect(layout.ungrouped.map((g) => g.id)).toEqual(["a"]);
    expect(layout.dividers).toEqual([{ divider: divider("empty", 0), subjects: [] }]);
  });
});
