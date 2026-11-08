import { describe, expect, it } from "vitest";
import { emptyView, feedbackSpeechText, MAX_SPEECH_CHARS, toExplainAloudView, type ExplainAloudRows } from "./view";

function rows(overrides: Partial<ExplainAloudRows> = {}): ExplainAloudRows {
  return {
    recording: { id: "7d1f3c1e-2b8a-4c3e-9f4a-1a2b3c4d5e6f", lectureId: "0b6f5c2a-9d3e-4f1a-8c7b-2e1d0f9a8b7c", status: "ready", durationMs: 47_600, createdAt: new Date("2026-11-07T15:00:00Z") },
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
    expect(view.recordingId).toBe("7d1f3c1e-2b8a-4c3e-9f4a-1a2b3c4d5e6f");
    expect(view.lectureId).toBe("0b6f5c2a-9d3e-4f1a-8c7b-2e1d0f9a8b7c");
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
    expect(view.lectureId).toBeNull();
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
      recordingId: null,
      lectureId: null,
      course: null,
      concept: null,
      recording: null,
      transcript: null,
      recordedLabel: null,
      feedback: null,
    });
  });
});

describe("feedbackSpeechText", () => {
  it("reads the concept and each gap", () => {
    const text = feedbackSpeechText(toExplainAloudView(rows()));
    expect(text).toBe(
      "Here’s your feedback on Cellular respiration. One thing is still missing. Role of oxygen. Oxygen is the final electron acceptor.",
    );
  });

  it("says when no gaps were found", () => {
    expect(feedbackSpeechText(toExplainAloudView(rows({ weakPoints: [] })))).toMatch(/No gaps were found/);
  });

  it("includes summary, covered ideas and the next step when present", () => {
    const view = toExplainAloudView(rows());
    const text = feedbackSpeechText({
      ...view,
      feedback: { ...view.feedback!, summary: "Strong start", covered: ["Electrons feed the chain"], nextStep: "Name both membrane sides" },
    });
    expect(text).toContain("Strong start. What you covered: Electrons feed the chain.");
    expect(text).toMatch(/Try this next\. Name both membrane sides\.$/);
  });

  it("returns null when there is no feedback to read", () => {
    expect(feedbackSpeechText(emptyView("empty"))).toBeNull();
    expect(feedbackSpeechText(toExplainAloudView(rows({ feedback: null })))).toBeNull();
  });

  it("caps the script length", () => {
    const longGap = { label: "Gap", explanation: "word ".repeat(1000) };
    const text = feedbackSpeechText(toExplainAloudView(rows({ weakPoints: [longGap] })))!;
    expect(text.length).toBeLessThanOrEqual(MAX_SPEECH_CHARS + 1);
    expect(text.endsWith("…")).toBe(true);
  });
});
