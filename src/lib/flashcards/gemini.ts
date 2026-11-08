import "server-only";
import { GEMINI_MODEL, getGemini } from "@/lib/gemini";

const TIMEOUT_MS = 45_000;

const text = { type: "string" } as const;
/**
 * Gemini-friendly JSON Schema mirroring generatedCardsSchema; the response is still validated with Zod.
 * No `maxItems`: Gemini rejects it on this schema with 400 INVALID_ARGUMENT. The prompt asks for at
 * most `count` cards, and generatedCardsSchema (max MAX_FLASHCARDS) plus selectValidCards enforce it.
 */
const responseJsonSchema = {
  type: "object",
  properties: {
    cards: {
      type: "array",
      items: {
        type: "object",
        properties: { question: text, answer: text, sourceNoteBlockIds: { type: "array", items: text }, conceptKey: text, conceptLabel: text },
        required: ["question", "answer", "sourceNoteBlockIds", "conceptKey", "conceptLabel"],
      },
    },
  },
  required: ["cards"],
};

/** Server-only Gemini call for flashcard generation. Returns parsed but UNVALIDATED JSON. */
export async function generateFlashcardsWithGemini(prompt: string): Promise<unknown> {
  const response = await getGemini().models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseJsonSchema,
      temperature: 0.2,
      abortSignal: AbortSignal.timeout(TIMEOUT_MS),
    },
  });
  return JSON.parse(response.text ?? "");
}
