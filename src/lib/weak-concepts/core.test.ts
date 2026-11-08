import { describe, expect, it } from "vitest";
import { missedReviewEvents, recordWeakConceptEvents, toWeakConceptViews } from "./core";
import { LECTURE_A, LECTURE_B, memoryWriter, OTHER_USER, REVIEW_1, REVIEW_2, REVIEW_3, USER } from "./test-fixtures";

const T1 = new Date("2026-11-07T10:00:00Z");
const T2 = new Date("2026-11-07T11:00:00Z");

const review = (reviewEventId: string, result: "got_it" | "missed", conceptKey = "glycolysis-location", lectureId = LECTURE_A) => ({
  reviewEventId, result, reviewedAt: T1, lectureId, conceptKey, conceptLabel: "Glycolysis · Location",
});

describe("missed flashcards → weak concepts", () => {
  it("creates a weak concept for each missed card and ignores Got it", async () => {
    const { writer, concepts } = memoryWriter();
    const events = missedReviewEvents([review(REVIEW_1, "missed"), review(REVIEW_2, "got_it")]);
    expect(await recordWeakConceptEvents(writer, USER, events)).toEqual({ recorded: 1 });
    expect(concepts).toMatchObject([{ userId: USER, lectureId: LECTURE_A, conceptKey: "glycolysis-location", missedCount: 1, feedbackCount: 0 }]);
  });

  it("updates the existing concept when it is missed again in a later session", async () => {
    const { writer, concepts } = memoryWriter();
    await recordWeakConceptEvents(writer, USER, missedReviewEvents([review(REVIEW_1, "missed")]));
    await recordWeakConceptEvents(writer, USER, missedReviewEvents([{ ...review(REVIEW_3, "missed", "Glycolysis Location"), reviewedAt: T2 }]));
    expect(concepts).toHaveLength(1);
    expect(concepts[0]).toMatchObject({ missedCount: 2, lastSeenAt: T2 });
  });

  it("never counts a duplicated submission of the same review event twice", async () => {
    const { writer, concepts } = memoryWriter();
    const events = missedReviewEvents([review(REVIEW_1, "missed")]);
    await recordWeakConceptEvents(writer, USER, events);
    expect(await recordWeakConceptEvents(writer, USER, events)).toEqual({ recorded: 0 });
    expect(await recordWeakConceptEvents(writer, USER, [...events, ...events])).toEqual({ recorded: 0 });
    expect(concepts[0].missedCount).toBe(1);
  });

  it("keeps similar concepts in different lectures and users separate", async () => {
    const { writer, concepts } = memoryWriter();
    await recordWeakConceptEvents(writer, USER, missedReviewEvents([review(REVIEW_1, "missed"), review(REVIEW_2, "missed", "glycolysis-location", LECTURE_B)]));
    await recordWeakConceptEvents(writer, OTHER_USER, missedReviewEvents([review(REVIEW_3, "missed")]));
    expect(concepts.map((c) => [c.userId, c.lectureId, c.missedCount])).toEqual([[USER, LECTURE_A, 1], [USER, LECTURE_B, 1], [OTHER_USER, LECTURE_A, 1]]);
  });

  it("records nothing for an empty or all-correct session", async () => {
    const { writer, concepts } = memoryWriter();
    expect(await recordWeakConceptEvents(writer, USER, missedReviewEvents([]))).toEqual({ recorded: 0 });
    expect(await recordWeakConceptEvents(writer, USER, missedReviewEvents([review(REVIEW_1, "got_it")]))).toEqual({ recorded: 0 });
    expect(concepts).toEqual([]);
  });
});

describe("weak concept views", () => {
  const concept = { id: "77777777-7777-4777-8777-777777777701", lectureId: LECTURE_A, lectureTitle: "Respiration", label: "Glycolysis", missedCount: 2, feedbackCount: 1, lastSeenAt: T2 };
  const RECORDING_OLD = "99999999-9999-4999-8999-999999999901";
  const RECORDING_NEW = "99999999-9999-4999-8999-999999999902";

  it("shapes rows for the list with de-duplicated related missed cards", () => {
    const card = { weakConceptId: concept.id, id: "88888888-8888-4888-8888-888888888801", question: "Where?", answer: "Cytosol." };
    expect(toWeakConceptViews([concept], [card, card], [])).toEqual([
      {
        id: concept.id, lectureId: LECTURE_A, lectureTitle: "Respiration", label: "Glycolysis",
        missedCardCount: 2, explanationFeedbackCount: 1, lastSeenAt: T2.toISOString(),
        relatedCards: [{ id: card.id, question: "Where?", answer: "Cytosol." }],
        feedbackRecordingId: null,
      },
    ]);
  });

  it("links each concept to the most recent explanation recording that flagged it", () => {
    const recordings = [
      { weakConceptId: concept.id, recordingId: RECORDING_OLD, createdAt: T1 },
      { weakConceptId: concept.id, recordingId: RECORDING_NEW, createdAt: T2 },
      { weakConceptId: "someone-else", recordingId: "x", createdAt: T2 },
    ];
    expect(toWeakConceptViews([concept], [], recordings)[0].feedbackRecordingId).toBe(RECORDING_NEW);
    expect(toWeakConceptViews([concept], [], [...recordings].reverse())[0].feedbackRecordingId).toBe(RECORDING_NEW);
  });
});
