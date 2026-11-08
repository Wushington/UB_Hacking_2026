import { describe, expect, it } from "vitest";
import { finalizeUploadSchema } from "@/contracts/uploads";
import { objectKeyFor } from "@/lib/storage";
import { checkUploadedAudio, checkUploadedImage, recordingPurposeFor } from "./uploads";

const MB = 1024 * 1024;

describe("recordingPurposeFor", () => {
  it("maps audio uploads to recording purposes", () => {
    expect(recordingPurposeFor("explanation_audio")).toBe("explanation");
    expect(recordingPurposeFor("lecture_audio")).toBe("lecture");
    expect(recordingPurposeFor("lecture_image")).toBeNull();
  });
});

describe("checkUploadedAudio", () => {
  const stored = { byteSize: 400_000, contentType: "audio/webm" };

  it("accepts a valid explanation and keeps the client duration", () => {
    expect(checkUploadedAudio("explanation_audio", stored, 47_000)).toEqual({
      ok: true,
      mimeType: "audio/webm",
      byteSize: 400_000,
      durationMs: 47_000,
    });
  });

  it("validates the stored object, not the declared type", () => {
    expect(checkUploadedAudio("explanation_audio", { ...stored, contentType: "text/html" }, 1000)).toMatchObject({
      ok: false,
    });
    expect(checkUploadedAudio("explanation_audio", { ...stored, contentType: null }, 1000)).toMatchObject({ ok: false });
  });

  it("enforces the per-purpose size limit", () => {
    expect(checkUploadedAudio("explanation_audio", { ...stored, byteSize: 11 * MB }, 1000)).toEqual({
      ok: false,
      reason: "Upload is too large",
    });
    expect(checkUploadedAudio("lecture_audio", { ...stored, byteSize: 11 * MB }, 1000).ok).toBe(true);
    expect(checkUploadedAudio("explanation_audio", { ...stored, byteSize: 0 }, 1000).ok).toBe(false);
  });

  it("caps small timer overshoot and rejects recordings past the limit", () => {
    expect(checkUploadedAudio("explanation_audio", stored, 121_500)).toMatchObject({ ok: true, durationMs: 120_000 });
    expect(checkUploadedAudio("explanation_audio", stored, 200_000)).toMatchObject({ ok: false });
    expect(checkUploadedAudio("explanation_audio", stored, undefined)).toMatchObject({ ok: true, durationMs: null });
  });

  it("rejects non-audio purposes", () => {
    expect(checkUploadedAudio("lecture_image", { byteSize: 10, contentType: "image/png" }, undefined).ok).toBe(false);
  });
});

describe("upload keys and finalize contract", () => {
  it("rebuilds the object key from owner, purpose and upload id", () => {
    expect(objectKeyFor("user_1", "explanation_audio", "abc")).toBe("users/user_1/explanation_audio/abc");
  });

  it("requires a purpose and a uuid upload id", () => {
    const uploadId = "7d1f3c1e-2b8a-4c3e-9f4a-1a2b3c4d5e6f";
    expect(finalizeUploadSchema.safeParse({ uploadId, purpose: "explanation_audio" }).success).toBe(true);
    expect(finalizeUploadSchema.safeParse({ uploadId }).success).toBe(false);
    expect(finalizeUploadSchema.safeParse({ uploadId: "../other-user", purpose: "explanation_audio" }).success).toBe(false);
    // Optional chosen weak concept.
    expect(finalizeUploadSchema.parse({ uploadId, purpose: "explanation_audio", conceptKey: "atp-synthase" }).conceptKey).toBe("atp-synthase");
    expect(finalizeUploadSchema.safeParse({ uploadId, purpose: "explanation_audio", conceptKey: "  " }).success).toBe(false);
  });
});

describe("checkUploadedImage", () => {
  it("accepts the stored whiteboard photo types, including iPhone HEIC", () => {
    for (const contentType of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "IMAGE/JPEG; q=1"]) {
      expect(checkUploadedImage({ byteSize: 1024, contentType }).ok).toBe(true);
    }
  });

  it("rejects other types, empty files and files over 20 MB", () => {
    expect(checkUploadedImage({ byteSize: 1024, contentType: "image/gif" })).toMatchObject({ ok: false });
    expect(checkUploadedImage({ byteSize: 1024, contentType: null })).toMatchObject({ ok: false });
    expect(checkUploadedImage({ byteSize: 0, contentType: "image/png" })).toMatchObject({ ok: false, reason: "Empty upload" });
    expect(checkUploadedImage({ byteSize: 20 * 1024 * 1024 + 1, contentType: "image/png" })).toMatchObject({ ok: false });
  });
});
