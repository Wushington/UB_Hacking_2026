import type { RECORDING_STATUSES } from "@/contracts/audio";
import type { MasteredConcept } from "@/contracts/explanations";

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
  | "ready"
  /** A weak concept is selected (e.g. from the Weak concepts page) and nothing is recorded yet. */
  | "ready-to-record";

export type ExplainAloudGap = { title: string; detail: string };

export type ExplainAloudView = {
  state: ExplainAloudState;
  /** The explanation recording shown; null for placeholder views. */
  recordingId: string | null;
  /** The class that attempt belongs to; new attempts default to it. */
  lectureId: string | null;
  /** The weak concept the attempt is about (or that was selected); new attempts default to it. */
  conceptKey: string | null;
  /** Category name, shown as the course chip. */
  course: string | null;
  concept: {
    title: string;
    breadcrumb: string | null;
    /** The question the student answered. Not stored yet, so always null for now. */
    prompt: string | null;
    /** Shown instead of the prompt when the attempt targets a selected weak concept. */
    instruction: string | null;
    attemptLabel: string | null;
  } | null;
  recording: { durationSeconds: number | null; audioSrc: string | null } | null;
  transcript: string | null;
  /** e.g. "Nov 7"; formatted on the server so it can't cause a hydration mismatch. */
  recordedLabel: string | null;
  feedback: {
    /** Null for feedback saved before these coaching fields existed. */
    summary: string | null;
    covered: string[];
    gaps: ExplainAloudGap[];
    nextStep: string | null;
    /** Open weak concepts this attempt explained soundly; the student rates the attempt to clear them. */
    mastered: MasteredConcept[];
    /** The student's 1–5 rating, once given. */
    selfRating: number | null;
  } | null;
};

export function emptyView(state: ExplainAloudState): ExplainAloudView {
  return {
    state,
    recordingId: null,
    lectureId: null,
    conceptKey: null,
    course: null,
    concept: null,
    recording: null,
    transcript: null,
    recordedLabel: null,
    feedback: null,
  };
}

/** ElevenLabs bills per character; keep a single read-aloud bounded. */
export const MAX_SPEECH_CHARS = 2500;

function sentence(text: string) {
  const t = text.trim();
  return /[.!?…]$/.test(t) ? t : `${t}.`;
}

/**
 * Script read aloud by the feedback "Listen" button. Built on the server from the user's own
 * feedback (the client never sends text). Null when there is nothing to read.
 */
export function feedbackSpeechText(view: ExplainAloudView): string | null {
  const { feedback } = view;
  if (view.state !== "ready" || !feedback) return null;

  const parts: string[] = [];
  if (feedback.summary) parts.push(sentence(feedback.summary));
  if (feedback.covered.length > 0) {
    parts.push("What you covered:", ...feedback.covered.map(sentence));
  }
  if (feedback.gaps.length > 0) {
    parts.push(feedback.gaps.length === 1 ? "One thing is still missing." : `${feedback.gaps.length} things are still missing.`);
    for (const gap of feedback.gaps) parts.push(sentence(gap.title), sentence(gap.detail));
  } else {
    parts.push("No gaps were found in this explanation. Nice work.");
  }
  if (feedback.mastered.length > 0) {
    parts.push(`You now explain ${feedback.mastered.map((m) => m.label).join(" and ")} correctly.`);
  }
  if (feedback.nextStep) parts.push("Try this next.", sentence(feedback.nextStep));

  const intro = view.concept ? `Here’s your feedback on ${sentence(view.concept.title)}` : "Here’s your feedback.";
  const script = [intro, ...parts].join(" ");
  if (script.length <= MAX_SPEECH_CHARS) return script;
  const cut = script.slice(0, MAX_SPEECH_CHARS);
  return `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

type RecordingStatus = (typeof RECORDING_STATUSES)[number];

/** Rows read for one explanation attempt (see queries.ts). All already scoped to the owner. */
export type ExplainAloudRows = {
  recording: {
    id: string;
    lectureId: string | null;
    status: RecordingStatus;
    durationMs: number | null;
    createdAt: Date;
    /** The weak concept the student chose for this attempt, if any. */
    conceptKey?: string | null;
    conceptLabel?: string | null;
  };
  lecture: { title: string } | null;
  categoryName: string | null;
  attemptNumber: number;
  feedback: {
    transcriptText: string;
    summary?: string | null;
    coveredIdeas?: string[] | null;
    nextStep?: string | null;
    masteredConcepts?: MasteredConcept[] | null;
    selfRating?: number | null;
  } | null;
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
  "ready-to-record": null,
};

export const CONCEPT_INSTRUCTION = "Explain this in your own words, then we’ll check it against your notes.";

/** Breadcrumb under a selected concept's title: "Category · Class", or just the class. */
function conceptBreadcrumb(categoryName: string | null, lectureTitle: string) {
  return categoryName ? `${categoryName} · ${lectureTitle}` : lectureTitle;
}

/** An open weak concept the recorder can target (the picker shows those in the chosen class). */
export type ConceptOption = { id: string; conceptKey: string; label: string; lectureId: string };

/** A selected weak concept, before any attempt is recorded for it. */
export type SelectedConcept = {
  conceptKey: string;
  label: string;
  lectureId: string;
  lectureTitle: string;
  categoryName: string | null;
};

export function readyToRecordView(selected: SelectedConcept): ExplainAloudView {
  const lectureTitle = selected.lectureTitle.trim() || "Untitled class";
  return {
    ...emptyView("ready-to-record"),
    lectureId: selected.lectureId,
    conceptKey: selected.conceptKey,
    course: selected.categoryName?.trim() || null,
    concept: {
      title: selected.label,
      breadcrumb: conceptBreadcrumb(selected.categoryName, lectureTitle),
      prompt: null,
      instruction: CONCEPT_INSTRUCTION,
      attemptLabel: null,
    },
  };
}

export function toExplainAloudView(rows: ExplainAloudRows): ExplainAloudView {
  const state = stateFor(rows);
  const title = rows.lecture?.title.trim() || "Untitled class";
  const status = ATTEMPT_STATUS[state];
  const chosenLabel = rows.recording.conceptLabel?.trim() || null;

  const transcript =
    rows.feedback?.transcriptText.trim() ||
    rows.segments
      .map((s) => s.text.trim())
      .filter(Boolean)
      .join(" ") ||
    null;

  return {
    state,
    recordingId: rows.recording.id,
    lectureId: rows.lecture ? rows.recording.lectureId : null,
    conceptKey: rows.recording.conceptKey ?? null,
    course: rows.categoryName?.trim() || null,
    concept: chosenLabel
      ? {
          // Attempt about a selected weak concept: the concept is the title, the class the breadcrumb.
          title: chosenLabel,
          breadcrumb: conceptBreadcrumb(rows.categoryName, title),
          prompt: null,
          instruction: CONCEPT_INSTRUCTION,
          attemptLabel: status ? `Attempt ${rows.attemptNumber} · ${status}` : null,
        }
      : {
          title,
          breadcrumb: rows.categoryName ? `${rows.categoryName} · ${title}` : null,
          prompt: null,
          instruction: null,
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
          summary: rows.feedback.summary?.trim() || null,
          covered: (rows.feedback.coveredIdeas ?? []).map((c) => c.trim()).filter(Boolean),
          gaps: rows.weakPoints.map((w) => ({ title: w.label, detail: w.explanation })),
          nextStep: rows.feedback.nextStep?.trim() || null,
          mastered: rows.feedback.masteredConcepts ?? [],
          selfRating: rows.feedback.selfRating ?? null,
        }
      : null,
  };
}
