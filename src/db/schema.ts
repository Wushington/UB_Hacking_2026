/**
 * Orbit Study database schema (Drizzle, PostgreSQL on Tiger Data).
 *
 * Ownership: top-level rows carry `user_id` (the Clerk user id, also users.id). Child rows
 * (sections, blocks, segments, weak points, cards, sources) are reached through an owned parent:
 * verify the parent's user_id before reading or writing children. Clerk authenticates; it does not
 * authorize rows. Media lives in the private bucket; rows store only the object key + metadata.
 */
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { RECORDING_PURPOSES, RECORDING_STATUSES } from "@/contracts/audio";
import { LECTURE_STATUSES, NOTE_BLOCK_KINDS, type SourceRef } from "@/contracts/notes";
import { REVIEW_RESULTS, SESSION_STATUSES } from "@/contracts/study";
import { WEAK_CONCEPT_SOURCE_TYPES } from "@/contracts/weak-concepts";

const id = () => uuid("id").primaryKey().defaultRandom();
const ts = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => ts("created_at").notNull().defaultNow();
const updatedAt = () =>
  ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const owner = () =>
  text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

export const lectureStatus = pgEnum("lecture_status", LECTURE_STATUSES);
export const noteBlockKind = pgEnum("note_block_kind", NOTE_BLOCK_KINDS);
export const recordingPurpose = pgEnum("recording_purpose", RECORDING_PURPOSES);
export const recordingStatus = pgEnum("recording_status", RECORDING_STATUSES);
export const sessionStatus = pgEnum("study_session_status", SESSION_STATUSES);
export const reviewResult = pgEnum("review_result", REVIEW_RESULTS);
export const weakConceptSourceType = pgEnum("weak_concept_source_type", WEAK_CONCEPT_SOURCE_TYPES);

/** One row per Clerk user; create it (insert … on conflict do nothing) before their first write. */
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  createdAt: createdAt(),
});

export const categories = pgTable(
  "categories",
  {
    id: id(),
    userId: owner(),
    name: text("name").notNull(),
    /** normalizeCategoryName(name) from src/contracts/categories. */
    normalizedName: text("normalized_name").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.userId, t.normalizedName)],
);

export const lectures = pgTable(
  "lectures",
  {
    id: id(),
    userId: owner(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    status: lectureStatus("status").notNull().default("draft"),
    /** Gemini's suggestion; never applied without the student's approval. */
    suggestedCategoryName: text("suggested_category_name"),
    /** Incremented on every saved edit; decks record the revision they were generated from. */
    notesRevision: integer("notes_revision").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId)],
);

export const lectureImages = pgTable(
  "lecture_images",
  {
    id: id(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    userId: owner(),
    objectKey: text("object_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    position: integer("position").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.lectureId)],
);

export const noteSections = pgTable(
  "note_sections",
  {
    id: id(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    heading: text("heading").notNull(),
    position: integer("position").notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.lectureId)],
);

export const noteBlocks = pgTable(
  "note_blocks",
  {
    id: id(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => noteSections.id, { onDelete: "cascade" }),
    kind: noteBlockKind("kind").notNull(),
    text: text("text").notNull(),
    position: integer("position").notNull(),
    sourceRefs: jsonb("source_refs").$type<SourceRef[]>().notNull().default([]),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.sectionId)],
);

export const audioRecordings = pgTable(
  "audio_recordings",
  {
    id: id(),
    userId: owner(),
    lectureId: uuid("lecture_id").references(() => lectures.id, { onDelete: "set null" }),
    purpose: recordingPurpose("purpose").notNull(),
    objectKey: text("object_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    durationMs: integer("duration_ms"),
    status: recordingStatus("status").notNull().default("uploaded"),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId)],
);

export const transcriptSegments = pgTable(
  "transcript_segments",
  {
    id: id(),
    recordingId: uuid("recording_id")
      .notNull()
      .references(() => audioRecordings.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    startMs: integer("start_ms").notNull(),
    endMs: integer("end_ms"),
    text: text("text").notNull(),
    approximate: boolean("approximate").notNull().default(true),
  },
  (t) => [index().on(t.recordingId)],
);

export const explanationFeedback = pgTable(
  "explanation_feedback",
  {
    id: id(),
    recordingId: uuid("recording_id")
      .notNull()
      .unique()
      .references(() => audioRecordings.id, { onDelete: "cascade" }),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    userId: owner(),
    transcriptText: text("transcript_text").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.userId)],
);

export const explanationWeakPoints = pgTable(
  "explanation_weak_points",
  {
    id: id(),
    feedbackId: uuid("feedback_id")
      .notNull()
      .references(() => explanationFeedback.id, { onDelete: "cascade" }),
    conceptKey: text("concept_key").notNull(),
    label: text("label").notNull(),
    explanation: text("explanation").notNull(),
    evidence: text("evidence"),
    referenceBlockIds: jsonb("reference_block_ids").$type<string[]>().notNull().default([]),
  },
  (t) => [index().on(t.feedbackId)],
);

export const flashcardDecks = pgTable(
  "flashcard_decks",
  {
    id: id(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    userId: owner(),
    requestedCount: integer("requested_count").notNull(),
    actualCount: integer("actual_count").notNull(),
    /** lectures.notes_revision this deck was generated from (stale-notes detection). */
    notesRevision: integer("notes_revision").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index().on(t.lectureId)],
);

export const flashcards = pgTable(
  "flashcards",
  {
    id: id(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => flashcardDecks.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    question: text("question").notNull(),
    answer: text("answer").notNull(),
    sourceNoteBlockIds: jsonb("source_note_block_ids").$type<string[]>().notNull().default([]),
    conceptKey: text("concept_key").notNull(),
    conceptLabel: text("concept_label").notNull(),
  },
  (t) => [index().on(t.deckId)],
);

export const studySessions = pgTable(
  "study_sessions",
  {
    id: id(),
    deckId: uuid("deck_id")
      .notNull()
      .references(() => flashcardDecks.id, { onDelete: "cascade" }),
    userId: owner(),
    status: sessionStatus("status").notNull().default("in_progress"),
    startedAt: ts("started_at").notNull().defaultNow(),
    completedAt: ts("completed_at"),
    correctCount: integer("correct_count").notNull().default(0),
    missedCount: integer("missed_count").notNull().default(0),
    totalCount: integer("total_count").notNull().default(0),
  },
  (t) => [index().on(t.userId), index().on(t.deckId)],
);

export const studyReviewEvents = pgTable(
  "study_review_events",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => studySessions.id, { onDelete: "cascade" }),
    flashcardId: uuid("flashcard_id")
      .notNull()
      .references(() => flashcards.id, { onDelete: "cascade" }),
    userId: owner(),
    reviewedAt: ts("reviewed_at").notNull().defaultNow(),
    result: reviewResult("result").notNull(),
  },
  // One result per card per session: repeated completion requests can't duplicate results.
  (t) => [unique().on(t.sessionId, t.flashcardId)],
);

export const weakConcepts = pgTable(
  "weak_concepts",
  {
    id: id(),
    userId: owner(),
    lectureId: uuid("lecture_id")
      .notNull()
      .references(() => lectures.id, { onDelete: "cascade" }),
    conceptKey: text("concept_key").notNull(),
    label: text("label").notNull(),
    missedCount: integer("missed_count").notNull().default(0),
    feedbackCount: integer("feedback_count").notNull().default(0),
    lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.lectureId, t.conceptKey)],
);

/** Polymorphic link (source_type + source_id) to the review event or weak point; no FK by design. */
export const weakConceptSources = pgTable(
  "weak_concept_sources",
  {
    id: id(),
    weakConceptId: uuid("weak_concept_id")
      .notNull()
      .references(() => weakConcepts.id, { onDelete: "cascade" }),
    sourceType: weakConceptSourceType("source_type").notNull(),
    sourceId: uuid("source_id").notNull(),
    createdAt: createdAt(),
  },
  // The same event can't be counted twice.
  (t) => [unique().on(t.weakConceptId, t.sourceType, t.sourceId)],
);
