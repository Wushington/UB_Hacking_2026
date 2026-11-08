import type { NotesUpdate, SourceRef } from "@/contracts/notes";

export type SectionRow = { id: string; lectureId: string; heading: string; position: number };
export type BlockRow = {
  id: string;
  sectionId: string;
  kind: NotesUpdate["sections"][number]["blocks"][number]["kind"];
  text: string;
  position: number;
  sourceRefs: SourceRef[];
};

/**
 * Turns an editor save (full replacement) into rows to insert after deleting the lecture's notes.
 *
 * Ids come from the browser, so they are only kept when they already belonged to this lecture
 * (flashcards and weak points reference block ids, so keeping them matters); anything else gets a
 * fresh server id. Source refs are kept only for images of this lecture. Positions follow array order.
 */
export function planNotesReplacement(
  lectureId: string,
  sections: NotesUpdate["sections"],
  existing: { sectionIds: Iterable<string>; blockIds: Iterable<string>; imageIds: Iterable<string> },
  newId: () => string,
): { sections: SectionRow[]; blocks: BlockRow[] } {
  const ownedSections = new Set(existing.sectionIds);
  const ownedBlocks = new Set(existing.blockIds);
  const images = new Set(existing.imageIds);
  const used = new Set<string>();
  const pick = (id: string, owned: Set<string>) => {
    const keep = owned.has(id) && !used.has(id) ? id : newId();
    used.add(keep);
    return keep;
  };

  const sectionRows: SectionRow[] = [];
  const blockRows: BlockRow[] = [];
  sections.forEach((section, position) => {
    const sectionId = pick(section.id, ownedSections);
    sectionRows.push({ id: sectionId, lectureId, heading: section.heading, position });
    section.blocks.forEach((block, blockPosition) => {
      const refs = block.sourceRefs.filter((r, i, all) => images.has(r.imageId) && all.findIndex((o) => o.imageId === r.imageId) === i);
      blockRows.push({
        id: pick(block.id, ownedBlocks),
        sectionId,
        kind: block.kind,
        text: block.text,
        position: blockPosition,
        sourceRefs: refs,
      });
    });
  });
  return { sections: sectionRows, blocks: blockRows };
}
