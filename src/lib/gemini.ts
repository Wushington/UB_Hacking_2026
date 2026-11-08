import "server-only";
import { GoogleGenAI } from "@google/genai";
import { parseEnv } from "@/lib/env";

const models = parseEnv("geminiModels");

/**
 * Primary model for every Gemini call, from GEMINI_MODEL (shared with src/ai-service; defaults to
 * the -latest alias). Use this, not a model id per call site.
 */
export const GEMINI_MODEL: string = models.GEMINI_MODEL;

/**
 * Tried in order when the primary model is overloaded, rate-limited or hangs (newest models
 * see demand spikes). Same family and capabilities (audio input, JSON schema output).
 * Override with GEMINI_FALLBACK_MODELS (comma-separated).
 */
export const GEMINI_FALLBACK_MODELS: readonly string[] = models.GEMINI_FALLBACK_MODELS;

let client: GoogleGenAI | undefined;

/** Server-only Gemini client. Validate every response with the matching schema in src/contracts. */
export function getGemini(): GoogleGenAI {
  client ??= new GoogleGenAI({ apiKey: parseEnv("gemini").GEMINI_API_KEY });
  return client;
}
