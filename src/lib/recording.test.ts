import { describe, expect, it } from "vitest";
import { baseAudioMimeType, formatClock, pickRecorderMimeType } from "./recording";

describe("baseAudioMimeType", () => {
  it("strips codec parameters from allowed types", () => {
    expect(baseAudioMimeType("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(baseAudioMimeType("Audio/MP4")).toBe("audio/mp4");
  });

  it("rejects types we don't accept", () => {
    expect(baseAudioMimeType("video/webm")).toBeNull();
    expect(baseAudioMimeType("audio/flac")).toBeNull();
    expect(baseAudioMimeType(null)).toBeNull();
  });
});

describe("pickRecorderMimeType", () => {
  it("prefers WebM/Opus (Chrome, Firefox)", () => {
    expect(pickRecorderMimeType(() => true)).toBe("audio/webm;codecs=opus");
  });

  it("falls back to MP4 (Safari)", () => {
    expect(pickRecorderMimeType((t) => t === "audio/mp4")).toBe("audio/mp4");
  });

  it("returns null when nothing usable is supported", () => {
    expect(pickRecorderMimeType(() => false)).toBeNull();
  });
});

describe("formatClock", () => {
  it("formats milliseconds as m:ss", () => {
    expect(formatClock(0)).toBe("0:00");
    expect(formatClock(65_400)).toBe("1:05");
    expect(formatClock(120_000)).toBe("2:00");
  });
});
