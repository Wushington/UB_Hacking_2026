import type { WeakConceptSourceType } from "@/contracts/weak-concepts";
import type { WeakConceptWriter } from "./core";

export const USER = "user_123";
export const OTHER_USER = "user_456";
export const LECTURE_A = "22222222-2222-4222-8222-222222222201";
export const LECTURE_B = "22222222-2222-4222-8222-222222222202";
export const REVIEW_1 = "55555555-5555-4555-8555-555555555501";
export const REVIEW_2 = "55555555-5555-4555-8555-555555555502";
export const REVIEW_3 = "55555555-5555-4555-8555-555555555503";

type Row = { id: string; userId: string; lectureId: string; conceptKey: string; label: string; missedCount: number; feedbackCount: number; lastSeenAt: Date };

/**
 * In-memory stand-in for the weak_concepts + weak_concept_sources tables, enforcing the same unique
 * constraints as src/db/schema.ts: (user_id, lecture_id, concept_key) and (weak_concept_id, source_type, source_id).
 */
export function memoryWriter() {
  const concepts: Row[] = [];
  const sources = new Set<string>();
  const writer: WeakConceptWriter = {
    async ensureConcept(userId, lectureId, conceptKey, label, seenAt) {
      const found = concepts.find((c) => c.userId === userId && c.lectureId === lectureId && c.conceptKey === conceptKey);
      if (found) return found.id;
      const row = { id: `concept-${concepts.length + 1}`, userId, lectureId, conceptKey, label, missedCount: 0, feedbackCount: 0, lastSeenAt: seenAt };
      concepts.push(row);
      return row.id;
    },
    async addSource(conceptId, sourceType: WeakConceptSourceType, sourceId) {
      const key = `${conceptId}|${sourceType}|${sourceId}`;
      if (sources.has(key)) return false;
      sources.add(key);
      return true;
    },
    async countSource(conceptId, sourceType, label, seenAt) {
      const row = concepts.find((c) => c.id === conceptId)!;
      if (sourceType === "study_review_event") row.missedCount++;
      else row.feedbackCount++;
      row.label = label;
      if (seenAt > row.lastSeenAt) row.lastSeenAt = seenAt;
    },
  };
  return { writer, concepts };
}
