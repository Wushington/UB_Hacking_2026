import { z } from "zod";

/** Dividers group subjects on My subjects (e.g. by semester). */
export const dividerNameSchema = z.string().trim().min(1, "Name your divider").max(60);

/** POST /api/dividers */
export const createDividerSchema = z.object({ name: dividerNameSchema });
export type CreateDivider = z.infer<typeof createDividerSchema>;

export const dividerSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  position: z.number().int(),
  collapsed: z.boolean(),
});
export type Divider = z.infer<typeof dividerSchema>;

/** PATCH /api/dividers/[id] — rename, collapse/expand, or move one step up/down. */
export const updateDividerSchema = z
  .object({
    name: dividerNameSchema.optional(),
    collapsed: z.boolean().optional(),
    move: z.enum(["up", "down"]).optional(),
  })
  .refine((v) => v.name !== undefined || v.collapsed !== undefined || v.move !== undefined, "Nothing to change");
export type UpdateDivider = z.infer<typeof updateDividerSchema>;

/** PATCH /api/subjects/[id] — put a subject under a divider, or back above the dividers (null). */
export const moveSubjectSchema = z.object({ dividerId: z.uuid().nullable() });
export type MoveSubject = z.infer<typeof moveSubjectSchema>;
