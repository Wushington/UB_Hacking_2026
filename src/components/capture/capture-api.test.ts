import { describe, expect, it, vi } from "vitest";
import { CaptureError, organizeNotes, photoMimeType, photoProblem, processLecture, type QueuedPhoto } from "./capture-api";

const id = (n: number) => `8a3f1d2e-4b5c-4d6e-8f70-${String(n).padStart(12, "0")}`;
const MB = 1024 * 1024;

describe("photoMimeType", () => {
  it("uses the browser's type, or the extension when it's missing (HEIC on Windows)", () => {
    expect(photoMimeType({ name: "a.png", type: "image/png" })).toBe("image/png");
    expect(photoMimeType({ name: "board.HEIC", type: "" })).toBe("image/heic");
    expect(photoMimeType({ name: "board.jpg", type: "image/jpg" })).toBe("image/jpeg");
    expect(photoMimeType({ name: "anim.gif", type: "image/gif" })).toBeNull();
  });
});

describe("photoProblem", () => {
  it("accepts supported photos up to 20 MB", () => {
    expect(photoProblem({ name: "board.heic", type: "", size: 4 * MB })).toBeNull();
    expect(photoProblem({ name: "board.jpg", type: "image/jpeg", size: 20 * MB })).toBeNull();
  });

  it("explains why other files can't be added", () => {
    expect(photoProblem({ name: "lecture.m4a", type: "audio/mp4", size: MB })).toMatch(/coming soon/);
    expect(photoProblem({ name: "notes.pdf", type: "application/pdf", size: MB })).toMatch(/JPG, PNG, WebP or HEIC/);
    expect(photoProblem({ name: "huge.png", type: "image/png", size: 20 * MB + 1 })).toMatch(/20 MB/);
    expect(photoProblem({ name: "empty.png", type: "image/png", size: 0 })).toMatch(/empty/);
  });
});

type Call = { url: string; method: string; body?: unknown };

/** A fake backend: records calls and answers each route. */
function backend(overrides: Record<string, (call: Call) => Response> = {}) {
  const calls: Call[] = [];
  let uploads = 0;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const routes: Record<string, (call: Call) => Response> = {
    "POST /api/lectures": () => json({ id: id(1) }, 201),
    "POST /api/uploads/prepare": () => {
      uploads++;
      return json({ uploadId: id(100 + uploads), uploadUrl: `https://bucket.example/u${uploads}`, expiresAt: new Date().toISOString() });
    },
    PUT: () => new Response(null, { status: 200 }),
    "POST /api/uploads/finalize": (call) => json({ id: id(200 + Number((call.body as { uploadId: string }).uploadId.slice(-3)) - 100) }, 201),
    [`POST /api/lectures/${id(1)}/process`]: () => json({ title: "Notes", sections: [] }),
    ...overrides,
  };
  const fetchImpl = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    const call = { url: String(url), method, body };
    calls.push(call);
    const handler = method === "PUT" ? routes.PUT : routes[`${method} ${String(url)}`];
    if (!handler) throw new Error(`Unexpected ${method} ${String(url)}`);
    return handler(call);
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const photo = (n: number, extra: Partial<QueuedPhoto> = {}): QueuedPhoto => ({
  key: `k${n}`,
  file: new File([new Uint8Array(10)], `board${n}.heic`),
  mimeType: "image/heic",
  status: "ready",
  ...extra,
});

describe("organizeNotes", () => {
  it("creates the class, uploads each photo in order, then processes them", async () => {
    const { calls, fetchImpl } = backend();
    const progress: string[] = [];
    const lectureId = await organizeNotes(
      { photos: [photo(1), photo(2)], category: { name: "Cell Biology" }, lectureId: null },
      (p) => progress.push(p.stage),
      fetchImpl,
    );

    expect(lectureId).toBe(id(1));
    expect(calls[0]).toMatchObject({ url: "/api/lectures", body: { category: { name: "Cell Biology" } } });
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(2);
    expect(calls.find((c) => c.url === "/api/uploads/prepare")?.body).toMatchObject({ purpose: "lecture_image", mimeType: "image/heic" });
    expect(calls.at(-1)).toMatchObject({ url: `/api/lectures/${id(1)}/process`, body: { imageIds: [id(201), id(202)] } });
    expect(progress).toEqual(["creating", "uploading", "uploaded", "uploading", "uploaded", "processing"]);
  });

  it("on retry, reuses the class and skips photos that already uploaded", async () => {
    const { calls, fetchImpl } = backend();
    await organizeNotes({ photos: [photo(1, { imageId: id(301) }), photo(2)], category: null, lectureId: id(1) }, () => {}, fetchImpl);

    expect(calls.some((c) => c.url === "/api/lectures")).toBe(false);
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(1);
    expect(calls.at(-1)?.body).toEqual({ imageIds: [id(301), id(201)] });
  });

  it("marks the failing photo and surfaces the server's message", async () => {
    const { fetchImpl } = backend({
      "POST /api/uploads/finalize": () => new Response(JSON.stringify({ error: "Photo is larger than 20 MB" }), { status: 422 }),
    });
    const progress: string[] = [];
    const error = await organizeNotes({ photos: [photo(1)], category: null, lectureId: null }, (p) => progress.push(p.stage), fetchImpl).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(CaptureError);
    expect(error.message).toBe("Photo is larger than 20 MB");
    expect(progress.at(-1)).toBe("upload-failed");
  });

  it("explains a storage CORS/network failure", async () => {
    const { fetchImpl } = backend({
      PUT: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    await expect(organizeNotes({ photos: [photo(1)], category: null, lectureId: null }, () => {}, fetchImpl)).rejects.toThrow(
      /Couldn’t reach storage/,
    );
  });
});

describe("processLecture", () => {
  const respond = (status: number, error: string) =>
    vi.fn(async () => new Response(JSON.stringify({ error }), { status })) as unknown as typeof fetch;

  it("treats 'already generated' as success (a lost response on a previous try)", async () => {
    await expect(processLecture(id(1), [id(2)], respond(409, "Notes were already generated"))).resolves.toBeUndefined();
  });

  it("shows the service's friendly message on failure", async () => {
    await expect(processLecture(id(1), [id(2)], respond(502, "Couldn't generate notes right now. Please try again."))).rejects.toThrow(
      /right now/,
    );
    await expect(processLecture(id(1), [id(2)], respond(409, "Already processing"))).rejects.toThrow("Already processing");
  });
});
