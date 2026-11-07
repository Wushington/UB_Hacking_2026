import "server-only";
import { GoogleGenAI } from "@google/genai";
import { parseEnv } from "@/lib/env";

/** Default model for note/flashcard/feedback generation. Change here, not per call site. */
export const GEMINI_MODEL = "gemini-2.5-flash";

let client: GoogleGenAI | undefined;

/** Server-only Gemini client. Validate every response with the matching schema in src/contracts. */
export function getGemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: parseEnv("gemini").GEMINI_API_KEY });
  return client;
}
