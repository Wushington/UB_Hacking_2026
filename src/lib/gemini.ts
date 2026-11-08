import "server-only";
import { GoogleGenAI } from "@google/genai";
import { parseEnv } from "@/lib/env";

/** Default model for note/flashcard/feedback generation. Change here, not per call site. */
export const GEMINI_MODEL = "gemini-3.8-flash";

/**
 * Tried in order when the primary model is overloaded, rate-limited or hangs (newest models
 * see demand spikes). Same family and capabilities (audio input, JSON schema output).
 */
export const GEMINI_FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.5-flash"] as const;

let client: GoogleGenAI | undefined;

/** Server-only Gemini client. Validate every response with the matching schema in src/contracts. */
export function getGemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: parseEnv("gemini").GEMINI_API_KEY });
  return client;
}
