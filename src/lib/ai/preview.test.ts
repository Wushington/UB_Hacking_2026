// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { jpegPreview } from "./preview";

beforeEach(() => vi.stubEnv("AI_SERVICE_URL", "http://127.0.0.1:8000"));
afterEach(() => vi.unstubAllEnvs());

describe("jpegPreview", () => {
  it("posts the photo to /preview and returns the JPEG bytes", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array([0xff, 0xd8, 1]), { status: 200 }));
    const out = await jpegPreview(new Uint8Array([9]), "image/heic", { fetchImpl });
    expect(String(fetchImpl.mock.calls[0][0])).toBe("http://127.0.0.1:8000/preview");
    const file = (fetchImpl.mock.calls[0][1]!.body as FormData).get("file") as File;
    expect(file.type).toBe("image/heic");
    expect([...out]).toEqual([0xff, 0xd8, 1]);
  });

  it("reports an unreachable service and service errors", async () => {
    const refused = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    await expect(jpegPreview(new Uint8Array([9]), "image/heic", { fetchImpl: refused })).rejects.toMatchObject({ reason: "unreachable" });
    const bad = vi.fn<typeof fetch>().mockResolvedValue(new Response("nope", { status: 400 }));
    await expect(jpegPreview(new Uint8Array([9]), "image/heic", { fetchImpl: bad })).rejects.toMatchObject({ status: 400 });
  });
});
