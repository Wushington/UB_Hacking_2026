// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AiServiceError, generateNotesFromImages, type NoteImage } from "./notes";

const id = (n: number) => `8a3f1d2e-4b5c-4d6e-8f70-${String(n).padStart(12, "0")}`;
const images: NoteImage[] = [1, 2].map((n) => ({ id: id(n), mimeType: "image/png", bytes: new Uint8Array([n]) }));

const notes = (imageId = id(1)) => ({
  title: "Cell biology",
  suggestedCategoryName: "Biology",
  sections: [{ heading: "Membrane", blocks: [{ kind: "definition", text: "A lipid bilayer", sourceRefs: [{ imageId }] }] }],
});

const respond = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(body), { status }));

beforeEach(() => vi.stubEnv("AI_SERVICE_URL", "http://127.0.0.1:8000"));
afterEach(() => vi.unstubAllEnvs());

describe("generateNotesFromImages", () => {
  it("posts every image with its id, in order, as multipart form data", async () => {
    const fetchImpl = respond(notes());
    await generateNotesFromImages(images, { fetchImpl });

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("http://127.0.0.1:8000/process-notes");
    const form = init!.body as FormData;
    expect(form.getAll("image_ids")).toEqual([id(1), id(2)]);
    const files = form.getAll("files") as File[];
    expect(files.map((f) => f.type)).toEqual(["image/png", "image/png"]);
  });

  it("returns validated notes", async () => {
    const result = await generateNotesFromImages(images, { fetchImpl: respond(notes()) });
    expect(result.sections[0].blocks[0].sourceRefs).toEqual([{ imageId: id(1) }]);
  });

  it("rejects source refs to images outside the batch", async () => {
    await expect(generateNotesFromImages(images, { fetchImpl: respond(notes(id(9))) })).rejects.toThrow(
      /outside this batch/,
    );
  });

  it("rejects output that doesn't match the notes contract", async () => {
    const bad = { ...notes(), sections: [] };
    const error = await generateNotesFromImages(images, { fetchImpl: respond(bad) }).catch((e) => e);
    expect(error).toBeInstanceOf(AiServiceError);
    expect(error.status).toBeUndefined();
  });

  it("surfaces the service's error detail and status", async () => {
    const error = await generateNotesFromImages(images, {
      fetchImpl: respond({ detail: "Could not read image" }, 400),
    }).catch((e) => e);
    expect(error).toBeInstanceOf(AiServiceError);
    expect(error.status).toBe(400);
    expect(error.message).toContain("Could not read image");
  });

  it("reports an unreachable service", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("fetch failed"));
    await expect(generateNotesFromImages(images, { fetchImpl })).rejects.toThrow(/unreachable/);
  });

  it("rejects a malformed AI_SERVICE_URL as unreachable", async () => {
    vi.stubEnv("AI_SERVICE_URL", "not a url");
    await expect(generateNotesFromImages(images, { fetchImpl: respond(notes()) })).rejects.toMatchObject({ reason: "unreachable" });
  });
});

describe("generateNotesFromImages connection failures", () => {
  beforeEach(() => vi.stubEnv("AI_SERVICE_URL", ""));
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to uvicorn's address and marks a refused connection as unreachable", async () => {
    const refused = Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } });
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(refused);
    const error = await generateNotesFromImages(images, { fetchImpl }).catch((e) => e);
    expect(String(fetchImpl.mock.calls[0][0])).toBe("http://127.0.0.1:8000/process-notes");
    expect(error).toMatchObject({ reason: "unreachable" });
    expect(error.message).toContain("ECONNREFUSED");
  });

  it("treats a timeout as a failure, not an outage", async () => {
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    const error = await generateNotesFromImages(images, { fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(timeout) }).catch((e) => e);
    expect(error).toMatchObject({ reason: "failed" });
  });
});
