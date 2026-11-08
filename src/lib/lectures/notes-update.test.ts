import { describe, expect, it } from "vitest";
import { planNotesReplacement } from "./notes-update";

const id = (n: number) => `8a3f1d2e-4b5c-4d6e-8f70-${String(n).padStart(12, "0")}`;
const LECTURE = id(100);

function fresh() {
  let n = 900;
  return () => id(n++);
}

const block = (blockId: string, imageIds: string[] = []) => ({
  id: blockId,
  kind: "paragraph" as const,
  text: "Mitochondria make ATP",
  sourceRefs: imageIds.map((imageId) => ({ imageId })),
});

describe("planNotesReplacement", () => {
  it("keeps ids that already belong to this lecture and orders by array position", () => {
    const plan = planNotesReplacement(
      LECTURE,
      [
        { id: id(2), heading: "Second", position: 7, blocks: [block(id(21)), block(id(20))] },
        { id: id(1), heading: "First", position: 0, blocks: [] },
      ],
      { sectionIds: [id(1), id(2)], blockIds: [id(20), id(21)], imageIds: [] },
      fresh(),
    );
    expect(plan.sections).toEqual([
      { id: id(2), lectureId: LECTURE, heading: "Second", position: 0 },
      { id: id(1), lectureId: LECTURE, heading: "First", position: 1 },
    ]);
    expect(plan.blocks.map((b) => [b.id, b.sectionId, b.position])).toEqual([
      [id(21), id(2), 0],
      [id(20), id(2), 1],
    ]);
  });

  it("replaces ids the lecture doesn't own (new rows, or another user's ids) with server ids", () => {
    const plan = planNotesReplacement(
      LECTURE,
      [{ id: id(55), heading: "New", position: 0, blocks: [block(id(66))] }],
      { sectionIds: [id(1)], blockIds: [id(20)], imageIds: [] },
      fresh(),
    );
    expect(plan.sections[0].id).toBe(id(900));
    expect(plan.blocks[0]).toMatchObject({ id: id(901), sectionId: id(900) });
  });

  it("never reuses an id twice in one save", () => {
    const plan = planNotesReplacement(
      LECTURE,
      [{ id: id(1), heading: "H", position: 0, blocks: [block(id(20)), block(id(20))] }],
      { sectionIds: [id(1)], blockIds: [id(20)], imageIds: [] },
      fresh(),
    );
    expect(plan.blocks.map((b) => b.id)).toEqual([id(20), id(900)]);
  });

  it("keeps source refs only for this lecture's images, without duplicates", () => {
    const plan = planNotesReplacement(
      LECTURE,
      [{ id: id(1), heading: "H", position: 0, blocks: [block(id(20), [id(40), id(99), id(40), id(41)])] }],
      { sectionIds: [id(1)], blockIds: [id(20)], imageIds: [id(40), id(41)] },
      fresh(),
    );
    expect(plan.blocks[0].sourceRefs).toEqual([{ imageId: id(40) }, { imageId: id(41) }]);
  });
});
