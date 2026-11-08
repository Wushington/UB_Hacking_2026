import { normalizeConceptKey, type WeakConceptSourceType, type WeakConceptView } from "@/contracts/weak-concepts";
import type { ReviewResult } from "@/contracts/study";

/** One identified weakness: a missed review event or a saved explanation weak point. */
export type WeakConceptEvent = {
  lectureId: string;
  conceptKey: string;
  label: string;
  sourceType: WeakConceptSourceType;
  sourceId: string;
  seenAt: Date;
};

/** Writes to weak_concepts / weak_concept_sources inside the caller's transaction. */
export type WeakConceptWriter = {
  /** Returns the id of the user's concept for (lecture, key), creating it with zero counts if missing. */
  ensureConcept(userId: string, lectureId: string, conceptKey: string, label: string, seenAt: Date): Promise<string>;
  /** Links the source event to the concept; false when that event was already recorded. */
  addSource(conceptId: string, sourceType: WeakConceptSourceType, sourceId: string): Promise<boolean>;
  /**
   * Adds one to the source type's counter, refreshes label + last_seen_at, and reopens the concept
   * if it was resolved (resolved_at → null): a new struggle brings it back to the student's list.
   */
  countSource(conceptId: string, sourceType: WeakConceptSourceType, label: string, seenAt: Date): Promise<void>;
};

/** Records each event once: a source already linked (duplicate submission) never changes counts. */
export async function recordWeakConceptEvents(writer: WeakConceptWriter, userId: string, events: WeakConceptEvent[]): Promise<{ recorded: number }> {
  let recorded = 0;
  for (const event of events) {
    const conceptKey = normalizeConceptKey(event.conceptKey);
    const label = event.label.trim();
    if (!conceptKey || !label) continue;
    const conceptId = await writer.ensureConcept(userId, event.lectureId, conceptKey, label, event.seenAt);
    if (!(await writer.addSource(conceptId, event.sourceType, event.sourceId))) continue;
    await writer.countSource(conceptId, event.sourceType, label, event.seenAt);
    recorded++;
  }
  return { recorded };
}

export type ReviewEventRow = { reviewEventId: string; result: ReviewResult; reviewedAt: Date; lectureId: string; conceptKey: string; conceptLabel: string };

export function missedReviewEvents(rows: ReviewEventRow[]): WeakConceptEvent[] {
  return rows
    .filter((r) => r.result === "missed")
    .map((r) => ({ lectureId: r.lectureId, conceptKey: r.conceptKey, label: r.conceptLabel, sourceType: "study_review_event", sourceId: r.reviewEventId, seenAt: r.reviewedAt }));
}

export type WeakConceptRow = { id: string; lectureId: string; lectureTitle: string; label: string; missedCount: number; feedbackCount: number; lastSeenAt: Date };
export type RelatedCardRow = { weakConceptId: string; id: string; question: string; answer: string };
export type FeedbackRecordingRow = { weakConceptId: string; recordingId: string; createdAt: Date };

export function toWeakConceptViews(concepts: WeakConceptRow[], cards: RelatedCardRow[], recordings: FeedbackRecordingRow[]): WeakConceptView[] {
  return concepts.map((c) => {
    let latest: FeedbackRecordingRow | null = null;
    for (const r of recordings) {
      if (r.weakConceptId === c.id && (!latest || r.createdAt > latest.createdAt)) latest = r;
    }
    const related = new Map<string, { id: string; question: string; answer: string }>();
    for (const card of cards) {
      if (card.weakConceptId === c.id) related.set(card.id, { id: card.id, question: card.question, answer: card.answer });
    }
    return {
      id: c.id,
      lectureId: c.lectureId,
      lectureTitle: c.lectureTitle,
      label: c.label,
      missedCardCount: c.missedCount,
      explanationFeedbackCount: c.feedbackCount,
      lastSeenAt: c.lastSeenAt.toISOString(),
      relatedCards: [...related.values()],
      feedbackRecordingId: latest?.recordingId ?? null,
    };
  });
}
