import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ElevenLabsError, synthesizeSpeech } from "./elevenlabs";

const KEY = "sk_fake_elevenlabs_key";

describe("synthesizeSpeech", () => {
  beforeEach(() => {
    vi.stubEnv("ELEVENLABS_API_KEY", KEY);
    vi.stubEnv("ELEVENLABS_VOICE_ID", "voice123");
    vi.stubEnv("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("streams MP3 from the ElevenLabs text-to-speech endpoint", async () => {
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await synthesizeSpeech("Hello there.");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://api.elevenlabs.io/v1/text-to-speech/voice123/stream?output_format=mp3_44100_128",
    );
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["xi-api-key"]).toBe(KEY);
    expect(JSON.parse(init.body as string)).toEqual({ text: "Hello there.", model_id: "eleven_flash_v2_5" });
  });

  it("uses the default voice and model when not configured", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("ELEVENLABS_API_KEY", KEY);
    const fetchMock = vi.fn(async () => new Response("x", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await synthesizeSpeech("Hi.");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit];
    expect(url.pathname).toBe("/v1/text-to-speech/JBFqnCBsd6RMkjVDRZzb/stream");
    expect(JSON.parse(init.body as string).model_id).toBe("eleven_flash_v2_5");
  });

  it("throws a status-only error that never contains the key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`bad key ${KEY}`, { status: 401 })));
    const error = await synthesizeSpeech("Hi.").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ElevenLabsError);
    expect((error as ElevenLabsError).status).toBe(401);
    expect(String((error as Error).message)).not.toContain(KEY);
  });

  it("fails fast without an API key", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("ELEVENLABS_API_KEY", undefined);
    await expect(synthesizeSpeech("Hi.")).rejects.toThrow(/ELEVENLABS_API_KEY/);
  });
});
