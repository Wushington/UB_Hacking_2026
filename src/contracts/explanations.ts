import { z } from "zod";
import { nonEmptyText } from "./shared";

/** A weakness supported by the student's explanation and grounded in specific note blocks. */
export const weakPointSchema = z.object({
  conceptKey: nonEmptyText,
  label: nonEmptyText,
  explanation: nonEmptyText,
  referenceNoteBlockIds: z.array(z.uuid()).min(1),
  evidence: z.string().optional(),
});
export type WeakPoint = z.infer<typeof weakPointSchema>;

/** Gemini explanation-evaluation output. An empty weakPoints list is valid. */
export const explanationFeedbackSchema = z.object({
  transcriptText: z.string(),
  weakPoints: z.array(weakPointSchema),
});
export type ExplanationFeedback = z.infer<typeof explanationFeedbackSchema>;
