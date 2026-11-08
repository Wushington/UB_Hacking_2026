import { describe, expect, it } from "vitest";
import { MAX_RECORDING_MS, transcriptResultSchema, transcriptSegmentSchema } from "./audio";
import { categoryInputSchema, normalizeCategoryName } from "./categories";
import { explanationFeedbackSchema, selfRatingOutcome, selfRatingSchema } from "./explanations";
import { flashcardCountSchema, generatedCardsSchema } from "./flashcards";
import { imageBatchSchema } from "./images";
import { notesGenerationSchema, notesUpdateSchema } from "./notes";
import { completeSessionSchema } from "./study";
import { prepareUploadSchema } from "./uploads";
import { normalizeConceptKey, weakConceptViewSchema } from "./weak-concepts";

const id = (n: number) => `8a3f1d2e-4b5c-4d6e-8f70-${String(n).padStart(12, "0")}`;

describe("uploads", () => {
  it("accepts JPG/PNG/WebP whiteboard images and rejects other types", () => {
    const base = { purpose: "lecture_image", byteSize: 1024 } as const;
    for (const mimeType of ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]) {
      expect(prepareUploadSchema.safeParse({ ...base, mimeType }).success).toBe(true);
    }
    expect(prepareUploadSchema.safeParse({ ...base, mimeType: "image/gif" }).success).toBe(false);
    expect(prepareUploadSchema.safeParse({ ...base, mimeType: "audio/webm" }).success).toBe(false);
  });

  it("rejects empty and oversize files", () => {
    const base = { purpose: "explanation_audio", mimeType: "audio/webm" } as const;
    expect(prepareUploadSchema.safeParse({ ...base, byteSize: 0 }).success).toBe(false);
    expect(prepareUploadSchema.safeParse({ ...base, byteSize: 1e12 }).success).toBe(false);
  });
});

describe("image batches (#11)", () => {
  it("requires 1–5 distinct images and keeps their order", () => {
    expect(imageBatchSchema.safeParse({ imageIds: [] }).success).toBe(false);
    expect(imageBatchSchema.parse({ imageIds: [id(1)] }).imageIds).toEqual([id(1)]);
    expect(imageBatchSchema.safeParse({ imageIds: [1, 2, 3, 4, 5, 6].map(id) }).success).toBe(false);
    expect(imageBatchSchema.safeParse({ imageIds: [id(1), id(1)] }).success).toBe(false);
    expect(imageBatchSchema.parse({ imageIds: [id(3), id(1), id(2)] }).imageIds).toEqual([id(3), id(1), id(2)]);
  });
});

describe("notes (#14, #16)", () => {
  const generated = {
    title: "Cell biology",
    suggestedCategoryName: "Biology",
    sections: [{ heading: "Membrane", blocks: [{ kind: "definition", text: "A lipid bilayer", sourceRefs: [{ imageId: id(1) }] }] }],
  };

  it("validates Gemini note output without trusting model-generated ids", () => {
    const parsed = notesGenerationSchema.parse({ ...generated, sections: [{ ...generated.sections[0], id: "model-id" }] });
    expect(parsed.sections[0]).not.toHaveProperty("id");
  });

  it("rejects unknown block kinds and empty notes", () => {
    const badKind = { ...generated, sections: [{ heading: "x", blocks: [{ kind: "poem", text: "x", sourceRefs: [] }] }] };
    expect(notesGenerationSchema.safeParse(badKind).success).toBe(false);
    expect(notesGenerationSchema.safeParse({ ...generated, sections: [] }).success).toBe(false);
  });

  it("requires the base revision on edits so conflicting saves can be detected", () => {
    const sections = [{ id: id(1), heading: "H", position: 0, blocks: [] }];
    expect(notesUpdateSchema.safeParse({ sections }).success).toBe(false);
    expect(notesUpdateSchema.parse({ baseRevision: 3, sections }).baseRevision).toBe(3);
  });
});

describe("categories (#13)", () => {
  it("normalizes names so duplicates differ only by case/spacing", () => {
    expect(normalizeCategoryName("  Organic   Chemistry ")).toBe("organic chemistry");
    expect(normalizeCategoryName("ORGANIC chemistry")).toBe(normalizeCategoryName("organic Chemistry"));
  });

  it("rejects blank names", () => {
    expect(categoryInputSchema.safeParse({ name: "   " }).success).toBe(false);
    expect(categoryInputSchema.parse({ name: " Biology " }).name).toBe("Biology");
  });
});

describe("audio (#10)", () => {
  it("rejects segments that end before they start", () => {
    expect(transcriptSegmentSchema.safeParse({ startMs: 500, endMs: 100, text: "hi" }).success).toBe(false);
    expect(transcriptSegmentSchema.safeParse({ startMs: 500, text: "open-ended" }).success).toBe(true);
  });

  it("requires ordered segments and an explicit approximate-timestamps flag", () => {
    const segs = [
      { startMs: 2000, text: "b" },
      { startMs: 1000, text: "a" },
    ];
    expect(transcriptResultSchema.safeParse({ segments: segs, timestampsApproximate: true }).success).toBe(false);
    expect(transcriptResultSchema.safeParse({ segments: segs.slice().reverse() }).success).toBe(false);
    expect(transcriptResultSchema.safeParse({ segments: segs.slice().reverse(), timestampsApproximate: true }).success).toBe(true);
  });

  it("documents the duration limits from the spec", () => {
    expect(MAX_RECORDING_MS).toEqual({ lecture: 10 * 60_000, explanation: 2 * 60_000 });
  });
});

describe("explanation feedback (#12)", () => {
  it("allows an empty weakness list", () => {
    expect(explanationFeedbackSchema.parse({ transcriptText: "I explained it", weakPoints: [] }).weakPoints).toEqual([]);
  });

  it("requires weak points to reference note blocks", () => {
    const wp = { conceptKey: "mitosis", label: "Mitosis", explanation: "Skipped anaphase", referenceNoteBlockIds: [] };
    expect(explanationFeedbackSchema.safeParse({ transcriptText: "x", weakPoints: [wp] }).success).toBe(false);
  });
});

describe("flashcards (#19)", () => {
  it("accepts integer counts 1–50 and defaults to 10", () => {
    expect(flashcardCountSchema.parse(undefined)).toBe(10);
    expect(flashcardCountSchema.parse(50)).toBe(50);
    for (const bad of [0, 51, 2.5, "10"]) expect(flashcardCountSchema.safeParse(bad).success).toBe(false);
  });

  it("validates generated cards and allows fewer than requested", () => {
    const card = { question: "Q?", answer: "A", sourceNoteBlockIds: [id(1)], conceptKey: "k", conceptLabel: "K" };
    expect(generatedCardsSchema.parse({ cards: [card] }).cards).toHaveLength(1);
    expect(generatedCardsSchema.safeParse({ cards: [{ ...card, answer: "" }] }).success).toBe(false);
  });
});

describe("study results (#20)", () => {
  it("accepts got_it / missed once per card", () => {
    const ok = { results: [{ flashcardId: id(1), result: "got_it" }, { flashcardId: id(2), result: "missed" }] };
    expect(completeSessionSchema.parse(ok).results).toHaveLength(2);
    const dup = { results: [{ flashcardId: id(1), result: "got_it" }, { flashcardId: id(1), result: "missed" }] };
    expect(completeSessionSchema.safeParse(dup).success).toBe(false);
    expect(completeSessionSchema.safeParse({ results: [{ flashcardId: id(1), result: "skip" }] }).success).toBe(false);
  });
});

describe("weak concepts (#24)", () => {
  it("validates the dashboard view shape", () => {
    const view = {
      id: id(1),
      lectureId: id(2),
      label: "Mitosis",
      missedCardCount: 2,
      explanationFeedbackCount: 1,
      lastSeenAt: "2026-11-07T20:00:00.000Z",
      lectureTitle: "Cell division",
      relatedCards: [{ id: id(3), question: "What is mitosis?", answer: "Cell division." }],
      feedbackRecordingId: id(4),
    };
    expect(weakConceptViewSchema.parse(view)).toEqual(view);
    expect(weakConceptViewSchema.safeParse({ ...view, missedCardCount: -1 }).success).toBe(false);
    expect(weakConceptViewSchema.parse({ ...view, feedbackRecordingId: null }).feedbackRecordingId).toBeNull();
  });
});

describe("concept keys (#24 shared contract with explanation feedback)", () => {
  it("normalizes flashcard and weak-point keys to one stable identifier", () => {
    expect(normalizeConceptKey("Glycolysis-Location")).toBe("glycolysis-location");
    expect(normalizeConceptKey("  glycolysis   location ")).toBe("glycolysis-location");
    expect(normalizeConceptKey("glycolysis_location")).toBe("glycolysis-location");
    expect(normalizeConceptKey("Krebs: cycle / location!")).toBe("krebs-cycle-location");
  });

  it("matches the explanation grader's keys (accents stripped, at most 80 chars)", () => {
    expect(normalizeConceptKey("Énergie d'activation")).toBe("energie-d-activation");
    expect(normalizeConceptKey("a".repeat(100))).toHaveLength(80);
  });

  it("returns an empty key when nothing usable remains", () => {
    expect(normalizeConceptKey(" -- ")).toBe("");
  });
});

describe("self-rating (clearing weak concepts)", () => {
  it("accepts whole ratings 1–5 only", () => {
    for (const rating of [1, 2, 3, 4, 5]) expect(selfRatingSchema.safeParse({ rating }).success).toBe(true);
    for (const rating of [0, 6, 3.5, "4"]) expect(selfRatingSchema.safeParse({ rating }).success).toBe(false);
  });

  it("removes at 4 or higher and resolves below", () => {
    expect([1, 2, 3].map(selfRatingOutcome)).toEqual(["resolved", "resolved", "resolved"]);
    expect([4, 5].map(selfRatingOutcome)).toEqual(["removed", "removed"]);
  });
});
