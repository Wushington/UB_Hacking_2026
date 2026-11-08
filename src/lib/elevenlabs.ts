import "server-only";
import { parseEnv } from "@/lib/env";

const API_BASE = "https://api.elevenlabs.io";
export const TTS_OUTPUT_FORMAT = "mp3_44100_128";

export class ElevenLabsError extends Error {
  constructor(readonly status: number) {
    // Status only: never include the API key or the response body (which may echo request details).
    super(`ElevenLabs text-to-speech failed with status ${status}`);
    this.name = "ElevenLabsError";
  }
}

/**
 * Streams MP3 speech for `text` from ElevenLabs. Returns the upstream Response so callers can pipe
 * `response.body` straight to the browser without buffering.
 */
export async function synthesizeSpeech(text: string, init?: { signal?: AbortSignal }): Promise<Response> {
  const env = parseEnv("elevenlabs");
  const url = new URL(`/v1/text-to-speech/${encodeURIComponent(env.ELEVENLABS_VOICE_ID)}/stream`, API_BASE);
  url.searchParams.set("output_format", TTS_OUTPUT_FORMAT);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": env.ELEVENLABS_API_KEY,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({ text, model_id: env.ELEVENLABS_MODEL_ID }),
    signal: init?.signal,
  });

  if (!response.ok || !response.body) {
    await response.body?.cancel();
    throw new ElevenLabsError(response.status);
  }
  return response;
}
