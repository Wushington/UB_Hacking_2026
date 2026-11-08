import { describe, expect, it, vi } from "vitest";
import { uploadExplanation, UploadError } from "./upload-explanation";

const uploadId = "7d1f3c1e-2b8a-4c3e-9f4a-1a2b3c4d5e6f";
const lectureId = "0b6f5c2a-9d3e-4f1a-8c7b-2e1d0f9a8b7c";
const recordingId = "3a2b1c0d-9e8f-4a7b-8c6d-5e4f3a2b1c0d";
const uploadUrl = "https://ewr1.vultrobjects.com/bucket/users/u/explanation_audio/x?X-Amz-Signature=abc";

function fakeFetch(overrides: Partial<Record<"prepare" | "put" | "finalize", Response | Error>> = {}) {
  return vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const key = String(url).includes("/prepare") ? "prepare" : String(url).includes("/finalize") ? "finalize" : "put";
    const override = overrides[key];
    if (override instanceof Error) throw override;
    if (override) return override;
    if (key === "prepare") return Response.json({ uploadId, uploadUrl, expiresAt: new Date().toISOString() });
    if (key === "finalize") return Response.json({ id: recordingId }, { status: 201 });
    void init;
    return new Response(null, { status: 200 });
  });
}

const input = () => ({ blob: new Blob(["abc"], { type: "audio/webm" }), mimeType: "audio/webm" as const, lectureId, durationMs: 4321.6 });

describe("uploadExplanation", () => {
  it("prepares, uploads directly to storage, then finalizes", async () => {
    const fetchImpl = fakeFetch();
    await expect(uploadExplanation(input(), fetchImpl)).resolves.toBe(recordingId);

    const calls = fetchImpl.mock.calls.map(([url, init]) => [String(url), init?.method, init?.body]);
    expect(calls[0][0]).toBe("/api/uploads/prepare");
    expect(JSON.parse(calls[0][2] as string)).toEqual({ purpose: "explanation_audio", mimeType: "audio/webm", byteSize: 3 });
    expect(calls[1][0]).toBe(uploadUrl);
    expect(calls[1][1]).toBe("PUT");
    expect((fetchImpl.mock.calls[1][1]!.headers as Record<string, string>)["Content-Type"]).toBe("audio/webm");
    expect(JSON.parse(calls[2][2] as string)).toEqual({
      uploadId,
      purpose: "explanation_audio",
      lectureId,
      durationMs: 4322,
    });
  });

  it("sends the chosen weak concept with finalize", async () => {
    const fetchImpl = fakeFetch();
    await uploadExplanation({ ...input(), conceptKey: "atp-synthase" }, fetchImpl);
    expect(JSON.parse(fetchImpl.mock.calls[2][1]!.body as string)).toMatchObject({ conceptKey: "atp-synthase" });
  });

  it("surfaces the server's message for client errors", async () => {
    const fetchImpl = fakeFetch({ finalize: Response.json({ error: "Class not found" }, { status: 404 }) });
    await expect(uploadExplanation(input(), fetchImpl)).rejects.toThrow("Class not found");
  });

  it("hides server-side failure details", async () => {
    const fetchImpl = fakeFetch({ prepare: Response.json({ error: "internal detail" }, { status: 503 }) });
    const error = await uploadExplanation(input(), fetchImpl).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UploadError);
    expect((error as Error).message).not.toContain("internal detail");
  });

  it("explains a blocked storage request without finalizing", async () => {
    const fetchImpl = fakeFetch({ put: new TypeError("Failed to fetch") });
    await expect(uploadExplanation(input(), fetchImpl)).rejects.toThrow(/couldn’t reach storage/i);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
