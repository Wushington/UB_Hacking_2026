import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

// Mirrors the agreed data model (required tables and constraints).
const tables = Object.values(schema).filter((v) => v instanceof PgTable) as PgTable[];
const byName = new Map(tables.map((t) => [getTableConfig(t).name, getTableConfig(t)]));
const cfg = (name: string) => {
  const c = byName.get(name);
  if (!c) throw new Error(`missing table ${name}`);
  return c;
};
const columnNames = (name: string) => cfg(name).columns.map((c) => c.name);
const uniqueSets = (name: string) => [
  ...cfg(name).uniqueConstraints.map((u) => u.columns.map((c) => c.name).sort().join(",")),
  ...cfg(name)
    .columns.filter((c) => c.isUnique)
    .map((c) => c.name),
];
const parentOf = (name: string, column: string) => {
  const fk = cfg(name).foreignKeys.find((f) => f.reference().columns.some((c) => c.name === column));
  return fk && { table: getTableConfig(fk.reference().foreignTable).name, onDelete: fk.onDelete };
};

describe("database schema", () => {
  it("defines exactly the required tables", () => {
    expect([...byName.keys()].sort()).toEqual(
      [
        "users",
        "categories",
        "lectures",
        "lecture_images",
        "note_sections",
        "note_blocks",
        "audio_recordings",
        "transcript_segments",
        "explanation_feedback",
        "explanation_weak_points",
        "flashcard_decks",
        "flashcards",
        "study_sessions",
        "study_review_events",
        "weak_concepts",
        "weak_concept_sources",
      ].sort(),
    );
  });

  it("uses the Clerk user id as the users primary key", () => {
    const id = cfg("users").columns.find((c) => c.name === "id")!;
    expect(id.primary).toBe(true);
    expect(id.getSQLType()).toBe("text");
  });

  it.each([
    "categories",
    "lectures",
    "lecture_images",
    "audio_recordings",
    "explanation_feedback",
    "flashcard_decks",
    "study_sessions",
    "study_review_events",
    "weak_concepts",
  ])("%s is owned by a user (required user_id → users)", (name) => {
    const col = cfg(name).columns.find((c) => c.name === "user_id");
    expect(col?.notNull).toBe(true);
    expect(parentOf(name, "user_id")?.table).toBe("users");
  });

  it.each([
    ["note_sections", "lecture_id", "lectures"],
    ["note_blocks", "section_id", "note_sections"],
    ["transcript_segments", "recording_id", "audio_recordings"],
    ["explanation_weak_points", "feedback_id", "explanation_feedback"],
    ["flashcards", "deck_id", "flashcard_decks"],
    ["weak_concept_sources", "weak_concept_id", "weak_concepts"],
  ])("%s is reached only through its owned parent (%s → %s)", (name, column, parent) => {
    expect(parentOf(name, column)).toEqual({ table: parent, onDelete: "cascade" });
  });

  it("keeps lectures and recordings when their optional parent is deleted", () => {
    expect(parentOf("lectures", "category_id")).toEqual({ table: "categories", onDelete: "set null" });
    expect(parentOf("audio_recordings", "lecture_id")).toEqual({ table: "lectures", onDelete: "set null" });
  });

  it("enforces the spec's uniqueness rules", () => {
    expect(uniqueSets("categories")).toContain("normalized_name,user_id");
    expect(uniqueSets("study_review_events")).toContain("flashcard_id,session_id");
    expect(uniqueSets("weak_concepts")).toContain("concept_key,lecture_id,user_id");
    expect(uniqueSets("weak_concept_sources")).toContain("source_id,source_type,weak_concept_id");
  });

  it("tracks note revisions so decks and edits can detect stale notes", () => {
    expect(columnNames("lectures")).toEqual(expect.arrayContaining(["status", "suggested_category_name", "notes_revision"]));
    expect(columnNames("flashcard_decks")).toEqual(
      expect.arrayContaining(["requested_count", "actual_count", "notes_revision"]),
    );
  });

  it("stores media as private object keys plus metadata, never file contents", () => {
    for (const name of ["lecture_images", "audio_recordings"]) {
      expect(columnNames(name)).toEqual(expect.arrayContaining(["object_key", "mime_type"]));
      expect(uniqueSets(name)).toContain("object_key");
      expect(cfg(name).columns.some((c) => c.getSQLType() === "bytea")).toBe(false);
    }
  });

  it("stores study results as got_it / missed", () => {
    const result = cfg("study_review_events").columns.find((c) => c.name === "result")!;
    expect(result.notNull).toBe(true);
    expect((result as unknown as { enumValues: string[] }).enumValues).toEqual(["got_it", "missed"]);
  });
});
