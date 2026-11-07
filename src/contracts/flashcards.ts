import { z } from "zod";
import { nonEmptyText } from "./shared";

export const MIN_FLASHCARDS = 1;
export const MAX_FLASHCARDS = 50;
export const DEFAULT_FLASHCARDS = 10;

/** Story #19: integers 1–50, default 10. */
export const flashcardCountSchema = z.number().int().min(MIN_FLASHCARDS).max(MAX_FLASHCARDS).default(DEFAULT_FLASHCARDS);

export const generatedCardSchema = z.object({
  question: nonEmptyText,
  answer: nonEmptyText,
  sourceNoteBlockIds: z.array(z.uuid()),
  conceptKey: nonEmptyText,
  conceptLabel: nonEmptyText,
});
export type GeneratedCard = z.infer<typeof generatedCardSchema>;

/** Gemini flashcard output. May contain fewer cards than requested. */
export const generatedCardsSchema = z.object({
  cards: z.array(generatedCardSchema).max(MAX_FLASHCARDS),
});
export type GeneratedCards = z.infer<typeof generatedCardsSchema>;
