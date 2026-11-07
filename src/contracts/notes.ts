import { z } from "zod";
import { nonEmptyText } from "./shared";

export const NOTE_BLOCK_KINDS = ["paragraph", "bullet", "definition", "example", "equation"] as const;
export const LECTURE_STATUSES = ["draft", "processing", "ready", "failed"] as const;

export const sourceRefSchema = z.object({ imageId: z.uuid() });
export type SourceRef = z.infer<typeof sourceRefSchema>;

const blockFields = {
  kind: z.enum(NOTE_BLOCK_KINDS),
  text: nonEmptyText,
  sourceRefs: z.array(sourceRefSchema),
};

/**
 * Gemini output for whiteboard processing. No section/block ids: the server
 * assigns them. The server must also reject sourceRefs that aren't images in this batch.
 */
export const notesGenerationSchema = z.object({
  title: nonEmptyText.max(200),
  sections: z
    .array(z.object({ heading: nonEmptyText, blocks: z.array(z.object(blockFields)).min(1) }))
    .min(1),
  suggestedCategoryName: nonEmptyText.max(60).optional(),
});
export type NotesGeneration = z.infer<typeof notesGenerationSchema>;

export const noteBlockSchema = z.object({ id: z.uuid(), ...blockFields });
export type NoteBlock = z.infer<typeof noteBlockSchema>;

export const noteSectionSchema = z.object({
  id: z.uuid(),
  heading: nonEmptyText,
  position: z.number().int().nonnegative(),
  blocks: z.array(noteBlockSchema),
});
export type NoteSection = z.infer<typeof noteSectionSchema>;

/** Saved notes as returned by GET /api/lectures/[id]. */
export const processedNotesSchema = z.object({
  title: nonEmptyText,
  sections: z.array(noteSectionSchema),
  suggestedCategoryName: z.string().optional(),
});
export type ProcessedNotes = z.infer<typeof processedNotesSchema>;

/** PATCH /api/lectures/[id]: full replacement guarded by the revision the editor started from. */
export const notesUpdateSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  title: nonEmptyText.max(200).optional(),
  sections: z.array(noteSectionSchema),
});
export type NotesUpdate = z.infer<typeof notesUpdateSchema>;
