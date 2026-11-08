import { describe, expect, it, vi } from "vitest";
import { handlePhotoRequest, previewKeyFor, type PhotoDeps } from "./photos";

function deps(overrides: Partial<PhotoDeps> = {}) {
  const d: PhotoDeps = {
    findImage: vi.fn(async () => ({ objectKey: "users/u/lecture_image/abc", mimeType: "image/jpeg" })),
    exists: vi.fn(async () => false),
    getBytes: vi.fn(async () => new Uint8Array([1, 2, 3])),
    makePreview: vi.fn(async () => new Uint8Array([0xff, 0xd8])),
    put: vi.fn(async () => {}),
    presign: vi.fn(async (key: string) => `https://bucket.example/${key}?sig`),
    ...overrides,
  };
  return d;
}

const call = (d: PhotoDeps) => handlePhotoRequest("u", "lecture", "image", d);

describe("handlePhotoRequest", () => {
  it("redirects browser-friendly photos straight to the original", async () => {
    const d = deps();
    const res = await call(d);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://bucket.example/users/u/lecture_image/abc?sig");
    expect(res.headers.get("cache-control")).toBe("private, max-age=240");
    expect(d.makePreview).not.toHaveBeenCalled();
  });

  it("makes and stores a JPEG preview for HEIC on first view, then serves it", async () => {
    const d = deps({ findImage: vi.fn(async () => ({ objectKey: "k", mimeType: "image/heic" })) });
    const res = await call(d);
    expect(d.getBytes).toHaveBeenCalledWith("k");
    expect(d.makePreview).toHaveBeenCalledWith(new Uint8Array([1, 2, 3]), "image/heic");
    expect(d.put).toHaveBeenCalledWith("k.preview.jpg", new Uint8Array([0xff, 0xd8]), "image/jpeg");
    expect(res.headers.get("location")).toBe("https://bucket.example/k.preview.jpg?sig");
  });

  it("reuses an existing preview", async () => {
    const d = deps({ findImage: vi.fn(async () => ({ objectKey: "k", mimeType: "image/heif" })), exists: vi.fn(async () => true) });
    await call(d);
    expect(d.makePreview).not.toHaveBeenCalled();
    expect(d.presign).toHaveBeenCalledWith(previewKeyFor("k"));
  });

  it("answers 503 when the preview can't be made (e.g. the AI service is down)", async () => {
    const d = deps({
      findImage: vi.fn(async () => ({ objectKey: "k", mimeType: "image/heic" })),
      makePreview: vi.fn(async () => {
        throw new Error("AI service unreachable");
      }),
    });
    expect((await call(d)).status).toBe(503);
    expect(d.presign).not.toHaveBeenCalled();
  });

  it("404s for photos that aren't the user's", async () => {
    const d = deps({ findImage: vi.fn(async () => null) });
    expect((await call(d)).status).toBe(404);
    expect(d.presign).not.toHaveBeenCalled();
  });
});
