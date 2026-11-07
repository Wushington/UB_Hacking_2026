import type { RECORDING_STATUSES } from "@/contracts/audio";

/**
 * What the Explain-aloud screen shows. Every section is nullable: the screen renders a
 * placeholder for anything missing instead of filler content.
 */
export type ExplainAloudState =
  | "loading"
  | "signed-out"
  | "empty"
  | "processing"
  | "failed"
  | "no-feedback"
  | "ready";

export type ExplainAloudGap = { title: string; detail: string };

export type ExplainAloudView = {
  state: ExplainAloudState;
  /** Category name, shown as the course chip. */
  course: string | null;
  concept: {
    title: string;
    breadcrumb: string | null;
    /** The question the student answered. Not stored yet, so always null for now. */
    prompt: string | null;
    attemptLabel: string | null;
  } | null;
  recording: { durationSeconds: number | null; audioSrc: string | null } | null;
  transcript: string | null;
  /** e.g. "Nov 7"; formatted on the server so it can't cause a hydration mismatch. */
  recordedLabel: string | null;
  feedback: {
    /** Not produced by Gemini yet; null until the contract stores them. */
    summary: string | null;
    covered: string[];
    gaps: ExplainAloudGap[];
    nextStep: string | null;
  } | null;
};

export function emptyView(state: ExplainAloudState): ExplainAloudView {
  return { state, course: null, concept: null, recording: null, transcript: null, recordedLabel: null, feedback: null };
}

type RecordingStatus = (typeof RECORDING_STATUSES)[number];

/** Rows read for one explanation attempt (see queries.ts). All already scoped to the owner. */
export type ExplainAloudRows = {
  recording: { status: RecordingStatus; durationMs: number | null; createdAt: Date };
  lecture: { title: string } | null;
  categoryName: string | null;
  attemptNumber: number;
  feedback: { transcriptText: string } | null;
  weakPoints: { label: string; explanation: string }[];
  segments: { text: string }[];
  audioSrc: string | null;
};

function stateFor(rows: ExplainAloudRows): ExplainAloudState {
  if (rows.feedback) return "ready";
  switch (rows.recording.status) {
    case "failed":
      return "failed";
    case "ready":
      return "no-feedback";
    default:
      return "processing";
  }
}

const ATTEMPT_STATUS: Record<ExplainAloudState, string | null> = {
  ready: "Complete",
  "no-feedback": "Complete",
  processing: "Analyzing",
  failed: "Failed",
  empty: null,
  "signed-out": null,
  loading: null,
};

export function toExplainAloudView(rows: ExplainAloudRows): ExplainAloudView {
  const state = stateFor(rows);
  const title = rows.lecture?.title.trim() || "Untitled class";
  const status = ATTEMPT_STATUS[state];

  const transcript =
    rows.feedback?.transcriptText.trim() ||
    rows.segments
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join(" ") ||
    null;

  return {
    state,
    course: rows.categoryName?.trim() || null,
    concept: {
      title,
      breadcrumb: rows.categoryName ? `${rows.categoryName} · ${title}` : null,
      prompt: null,
      attemptLabel: status ? `Attempt ${rows.attemptNumber} · ${status}` : null,
    },
    recording: {
      durationSeconds: rows.recording.durationMs != null ? Math.round(rows.recording.durationMs / 1000) : null,
      audioSrc: rows.audioSrc,
    },
    transcript,
    recordedLabel: rows.recording.createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    feedback: rows.feedback
      ? {
          summary: null,
          covered: [],
          gaps: rows.weakPoints.map((w) => ({ title: w.label, detail: w.explanation })),
          nextStep: null,
        }
      : null,
  };
}
