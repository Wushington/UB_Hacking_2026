import { z } from "zod";

/** Used for the unique (user_id, normalized_name) constraint. */
export function normalizeCategoryName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
});
export type CategoryInput = z.infer<typeof categoryInputSchema>;

export const categorySchema = z.object({
  id: z.uuid(),
  name: z.string(),
});
export type Category = z.infer<typeof categorySchema>;

/** Student-approved assignment (null = uncategorized). AI suggestions are never applied automatically. */
export const categoryAssignmentSchema = z.object({
  categoryId: z.uuid().nullable(),
});
export type CategoryAssignment = z.infer<typeof categoryAssignmentSchema>;
