import { describe, expect, it } from "vitest";
import { emptyView, toExplainAloudView, type ExplainAloudRows } from "./view";

function rows(overrides: Partial<ExplainAloudRows> = {}): ExplainAloudRows {
  return {
    recording: { status: "ready", durationMs: 47_600, createdAt: new Date("2026-11-07T15:00:00Z") },
    lecture: { title: "Cellular respiration" },
    categoryName: "Biology",
    attemptNumber: 2,
    feedback: { transcriptText: "  Electrons move along the chain.  " },
    weakPoints: [{ label: "Role of oxygen", explanation: "Oxygen is the final electron acceptor." }],
    segments: [],
    audioSrc: "https://storage.example/presigned",
    ...overrides,
  };
}

describe("toExplainAloudView", () => {
  it("maps a fully analyzed attempt", () => {
    const view = toExplainAloudView(rows());
    expect(view.state).toBe("ready");
    expect(view.course).toBe("Biology");
    expect(view.concept).toEqual({
      title: "Cellular respiration",
      breadcrumb: "Biology · Cellular respiration",
      prompt: null,
      attemptLabel: "Attempt 2 · Complete",
    });
    expect(view.recording).toEqual({ durationSeconds: 48, audioSrc: "https://storage.example/presigned" });
    expect(view.transcript).toBe("Electrons move along the chain.");
    expect(view.recordedLabel).toBe("Nov 7");
    expect(view.feedback?.gaps).toEqual([{ title: "Role of oxygen", detail: "Oxygen is the final electron acceptor." }]);
    expect(view.feedback?.covered).toEqual([]);
    expect(view.feedback?.summary).toBeNull();
    expect(view.feedback?.nextStep).toBeNull();
  });

  it("keeps feedback with no weak points", () => {
    const view = toExplainAloudView(rows({ weakPoints: [] }));
    expect(view.state).toBe("ready");
    expect(view.feedback?.gaps).toEqual([]);
  });

  it.each([
    ["uploaded", "processing", "Attempt 2 · Analyzing"],
    ["processing", "processing", "Attempt 2 · Analyzing"],
    ["failed", "failed", "Attempt 2 · Failed"],
    ["ready", "no-feedback", "Attempt 2 · Complete"],
  ] as const)("recording status %s without feedback → %s", (status, state, label) => {
    const view = toExplainAloudView(
      rows({ feedback: null, weakPoints: [], recording: { ...rows().recording, status } }),
    );
    expect(view.state).toBe(state);
    expect(view.concept?.attemptLabel).toBe(label);
    expect(view.feedback).toBeNull();
  });

  it("handles a missing category, lecture and duration", () => {
    const view = toExplainAloudView(
      rows({ categoryName: null, lecture: null, recording: { ...rows().recording, durationMs: null } }),
    );
    expect(view.course).toBeNull();
    expect(view.concept?.title).toBe("Untitled class");
    expect(view.concept?.breadcrumb).toBeNull();
    expect(view.recording?.durationSeconds).toBeNull();
  });

  it("falls back to transcript segments, then to null", () => {
    const fromSegments = toExplainAloudView(
      rows({ feedback: null, segments: [{ text: "First part." }, { text: " Second part. " }] }),
    );
    expect(fromSegments.transcript).toBe("First part. Second part.");
    expect(toExplainAloudView(rows({ feedback: null, segments: [] })).transcript).toBeNull();
  });
});

describe("emptyView", () => {
  it("has no content in any section", () => {
    expect(emptyView("empty")).toEqual({
      state: "empty",
      course: null,
      concept: null,
      recording: null,
      transcript: null,
      recordedLabel: null,
      feedback: null,
    });
  });
});
