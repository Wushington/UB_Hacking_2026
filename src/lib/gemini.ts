import "server-only";
import { GoogleGenAI } from "@google/genai";
import { parseEnv } from "@/lib/env";

/**
 * Model for flashcard/audio/feedback generation, from GEMINI_MODEL (shared with src/ai-service).
 * Use this, not a model id per call site.
 */
export function geminiModel(): string {
  return parseEnv("gemini").GEMINI_MODEL;
}

let client: GoogleGenAI | undefined;

/** Server-only Gemini client. Validate every response with the matching schema in src/contracts. */
export function getGemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: parseEnv("gemini").GEMINI_API_KEY });
  return client;
}
