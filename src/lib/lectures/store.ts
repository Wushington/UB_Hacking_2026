import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { normalizeCategoryName } from "@/contracts/categories";
import type { CreateLecture } from "@/contracts/lectures";
import type { NoteSection, NotesUpdate } from "@/contracts/notes";
import { getDb, schema } from "@/db";
import { deleteObject, headObject, objectKeyFor } from "@/lib/storage";
import { checkUploadedImage } from "@/lib/uploads";
import { ensureUser } from "@/lib/users";
import { planNotesReplacement } from "./notes-update";

const { categories, lectureImages, lectures, noteBlocks, noteSections } = schema;

/** Title until the AI service suggests one from the photos. */
export const UNTITLED_LECTURE = "Untitled class";

export type CategoryOption = { id: string; name: string };

/** The user's categories, alphabetical, for the Capture page's class picker. */
export async function listCategories(userId: string): Promise<CategoryOption[]> {
  return getDb()
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.userId, userId))
    .orderBy(asc(categories.normalizedName))
    .limit(200);
}

export type LectureSummary = {
  id: string;
  title: string;
  status: (typeof lectures.$inferSelect)["status"];
  updatedAt: Date;
  categoryId: string | null;
  categoryName: string | null;
};

/** All of the user's lectures, most recently updated first, for the My classes page. */
export async function listLectures(userId: string): Promise<LectureSummary[]> {
  return getDb()
    .select({
      id: lectures.id,
      title: lectures.title,
      status: lectures.status,
      updatedAt: lectures.updatedAt,
      categoryId: lectures.categoryId,
      categoryName: categories.name,
    })
    .from(lectures)
    .leftJoin(categories, eq(categories.id, lectures.categoryId))
    .where(eq(lectures.userId, userId))
    .orderBy(desc(lectures.updatedAt))
    .limit(500);
}

/** Creates a draft lecture. Returns null if a category id was given that the user doesn't own. */
export async function createLecture(userId: string, category: NonNullable<CreateLecture["category"]> | null): Promise<string | null> {
  const db = getDb();
  await ensureUser(userId);

  let categoryId: string | null = null;
  if (category && "id" in category) {
    const [owned] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, category.id), eq(categories.userId, userId)));
    if (!owned) return null;
    categoryId = owned.id;
  } else if (category) {
    const normalizedName = normalizeCategoryName(category.name);
    await db
      .insert(categories)
      .values({ userId, name: category.name.trim().replace(/\s+/g, " "), normalizedName })
      .onConflictDoNothing({ target: [categories.userId, categories.normalizedName] });
    const [row] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.normalizedName, normalizedName)));
    categoryId = row.id;
  }

  const [lecture] = await db
    .insert(lectures)
    .values({ userId, categoryId, title: UNTITLED_LECTURE })
    .returning({ id: lectures.id });
  return lecture.id;
}

export type FinalizeImageResult =
  | { ok: true; id: string; created: boolean }
  | { ok: false; status: number; error: string };

/**
 * Records a whiteboard photo the browser already PUT to the bucket. Idempotent per upload id.
 * The object key is rebuilt from the signed-in user, so nobody can claim someone else's object.
 */
export async function finalizeLectureImage(userId: string, uploadId: string, lectureId: string): Promise<FinalizeImageResult> {
  const db = getDb();
  const [lecture] = await db
    .select({ status: lectures.status })
    .from(lectures)
    .where(and(eq(lectures.id, lectureId), eq(lectures.userId, userId)));
  if (!lecture) return { ok: false, status: 404, error: "Class not found" };

  const objectKey = objectKeyFor(userId, "lecture_image", uploadId);
  const [existing] = await db
    .select({ id: lectureImages.id })
    .from(lectureImages)
    .where(and(eq(lectureImages.objectKey, objectKey), eq(lectureImages.userId, userId)));
  if (existing) return { ok: true, id: existing.id, created: false };

  if (lecture.status === "processing" || lecture.status === "ready") {
    return { ok: false, status: 409, error: "This class's notes were already generated" };
  }

  let stored: Awaited<ReturnType<typeof headObject>>;
  try {
    stored = await headObject(objectKey);
  } catch (error) {
    console.error("headObject failed:", (error as Error).message);
    return { ok: false, status: 503, error: "Storage is not available" };
  }
  if (!stored) return { ok: false, status: 404, error: "Upload not found. It may have expired; please try again." };

  const check = checkUploadedImage(stored);
  if (!check.ok) {
    await deleteObject(objectKey).catch(() => {});
    return { ok: false, status: 422, error: check.reason };
  }

  const [{ n }] = await db.select({ n: count() }).from(lectureImages).where(eq(lectureImages.lectureId, lectureId));
  const [row] = await db
    .insert(lectureImages)
    .values({ lectureId, userId, objectKey, mimeType: check.mimeType, byteSize: check.byteSize, position: n })
    .onConflictDoNothing({ target: lectureImages.objectKey })
    .returning({ id: lectureImages.id });
  if (row) return { ok: true, id: row.id, created: true };

  // A concurrent finalize won the insert.
  const [winner] = await db.select({ id: lectureImages.id }).from(lectureImages).where(eq(lectureImages.objectKey, objectKey));
  return winner ? { ok: true, id: winner.id, created: false } : { ok: false, status: 409, error: "Upload could not be saved" };
}

export type LectureForEditor = {
  id: string;
  title: string;
  status: (typeof lectures.$inferSelect)["status"];
  revision: number;
  categoryName: string | null;
  suggestedCategoryName: string | null;
  sections: NoteSection[];
};

/** A lecture the user owns with its notes, read in one consistent snapshot; null if not theirs. */
export async function loadLectureForEditor(userId: string, lectureId: string): Promise<LectureForEditor | null> {
  return getDb().transaction(
    async (tx) => {
      const [lecture] = await tx
        .select({
          id: lectures.id,
          title: lectures.title,
          status: lectures.status,
          revision: lectures.notesRevision,
          categoryName: categories.name,
          suggestedCategoryName: lectures.suggestedCategoryName,
        })
        .from(lectures)
        .leftJoin(categories, eq(categories.id, lectures.categoryId))
        .where(and(eq(lectures.id, lectureId), eq(lectures.userId, userId)));
      if (!lecture) return null;

      const sections = await tx
        .select()
        .from(noteSections)
        .where(eq(noteSections.lectureId, lectureId))
        .orderBy(asc(noteSections.position));
      const blocks = sections.length
        ? await tx
            .select()
            .from(noteBlocks)
            .where(inArray(noteBlocks.sectionId, sections.map((s) => s.id)))
            .orderBy(asc(noteBlocks.position))
        : [];

      return {
        ...lecture,
        sections: sections.map((s) => ({
          id: s.id,
          heading: s.heading,
          position: s.position,
          blocks: blocks
            .filter((b) => b.sectionId === s.id)
            .map((b) => ({ id: b.id, kind: b.kind, text: b.text, sourceRefs: b.sourceRefs })),
        })),
      };
    },
    { isolationLevel: "repeatable read" },
  );
}

export type SaveNotesResult =
  | { ok: true; revision: number }
  | { ok: false; status: 404 | 409; error: string; revision?: number };

/**
 * Replaces the lecture's notes with the editor's version, guarded by the revision the editor
 * started from: if someone saved in between, nothing changes and the current revision is returned.
 */
export async function saveLectureNotes(userId: string, lectureId: string, update: NotesUpdate): Promise<SaveNotesResult> {
  return getDb().transaction(async (tx) => {
    const owned = and(eq(lectures.id, lectureId), eq(lectures.userId, userId));
    const [lecture] = await tx
      .select({ status: lectures.status, revision: lectures.notesRevision })
      .from(lectures)
      .where(owned)
      .for("update");
    if (!lecture) return { ok: false, status: 404, error: "Class not found" };
    if (lecture.status !== "ready") return { ok: false, status: 409, error: "These notes aren't ready to edit yet" };
    if (lecture.revision !== update.baseRevision) {
      return {
        ok: false,
        status: 409,
        error: "These notes changed since you opened them. Reload to see the latest version.",
        revision: lecture.revision,
      };
    }

    const sectionIds = (await tx.select({ id: noteSections.id }).from(noteSections).where(eq(noteSections.lectureId, lectureId))).map(
      (r) => r.id,
    );
    const blockIds = sectionIds.length
      ? (await tx.select({ id: noteBlocks.id }).from(noteBlocks).where(inArray(noteBlocks.sectionId, sectionIds))).map((r) => r.id)
      : [];
    const imageIds = (
      await tx.select({ id: lectureImages.id }).from(lectureImages).where(eq(lectureImages.lectureId, lectureId))
    ).map((r) => r.id);

    const plan = planNotesReplacement(lectureId, update.sections, { sectionIds, blockIds, imageIds }, randomUUID);

    // Blocks cascade with their sections.
    await tx.delete(noteSections).where(eq(noteSections.lectureId, lectureId));
    if (plan.sections.length) await tx.insert(noteSections).values(plan.sections);
    if (plan.blocks.length) await tx.insert(noteBlocks).values(plan.blocks);

    const [saved] = await tx
      .update(lectures)
      .set({ notesRevision: sql`${lectures.notesRevision} + 1`, ...(update.title ? { title: update.title } : {}) })
      .where(owned)
      .returning({ revision: lectures.notesRevision });
    return { ok: true, revision: saved.revision };
  });
}

export type DiscardResult = { ok: true } | { ok: false; status: 404 | 409; error: string };

/**
 * Deletes an unfinished lecture (draft or failed, so no notes are lost) and its photos, e.g. when the
 * student changes class or starts over on the Capture page. Photo rows cascade; bucket objects are
 * removed best-effort afterwards.
 */
export async function discardUnfinishedLecture(userId: string, lectureId: string): Promise<DiscardResult> {
  const db = getDb();
  const owned = and(eq(lectures.id, lectureId), eq(lectures.userId, userId));
  const keys = await db.transaction(async (tx) => {
    const [lecture] = await tx.select({ status: lectures.status }).from(lectures).where(owned).for("update");
    if (!lecture) return { status: 404 as const };
    if (lecture.status !== "draft" && lecture.status !== "failed") return { status: 409 as const };
    const images = await tx.select({ key: lectureImages.objectKey }).from(lectureImages).where(eq(lectureImages.lectureId, lectureId));
    await tx.delete(lectures).where(owned);
    return { keys: images.map((i) => i.key) };
  });
  if ("status" in keys) {
    return keys.status === 404
      ? { ok: false, status: 404, error: "Class not found" }
      : { ok: false, status: 409, error: "Only unfinished classes can be discarded" };
  }
  await Promise.allSettled(keys.keys.map((key) => deleteObject(key)));
  return { ok: true };
}
