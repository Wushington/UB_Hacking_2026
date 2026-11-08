import "server-only";
import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { normalizeCategoryName } from "@/contracts/categories";
import type { SubjectChoice } from "@/contracts/lectures";
import type { NoteSection } from "@/contracts/notes";
import { getDb, schema } from "@/db";
import { deleteObject, headObject, objectKeyFor } from "@/lib/storage";
import { checkUploadedImage } from "@/lib/uploads";
import { ensureUser } from "@/lib/users";
import { previewKeyFor } from "./photos";

// In the UI a lecture is a set of "notes" and a category is its "subject".
const { audioRecordings, categories, lectureImages, lectures, noteBlocks, noteSections } = schema;

/** Title until the AI service suggests one from the photos. */
export const UNTITLED_LECTURE = "Untitled notes";

export type CategoryOption = { id: string; name: string };

/** The user's subjects (categories), alphabetical, for the subject pickers. */
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

/** All of the user's notes, most recently updated first, for the My subjects page. */
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

type Db = ReturnType<typeof getDb>;

/**
 * Resolves a subject choice to a category id: an owned id, a name (created if new, reusing an existing
 * one with the same normalized name), or null for none. Returns undefined if the id isn't the user's.
 */
async function resolveSubject(db: Db, userId: string, subject: SubjectChoice): Promise<string | null | undefined> {
  if (!subject) return null;
  if ("id" in subject) {
    const [owned] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(and(eq(categories.id, subject.id), eq(categories.userId, userId)));
    return owned?.id;
  }
  const normalizedName = normalizeCategoryName(subject.name);
  await db
    .insert(categories)
    .values({ userId, name: subject.name.trim().replace(/\s+/g, " "), normalizedName })
    .onConflictDoNothing({ target: [categories.userId, categories.normalizedName] });
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.normalizedName, normalizedName)));
  return row.id;
}

/** Creates a draft lecture. Returns null if a subject id was given that the user doesn't own. */
export async function createLecture(userId: string, subject: SubjectChoice): Promise<string | null> {
  const db = getDb();
  await ensureUser(userId);
  const categoryId = await resolveSubject(db, userId, subject);
  if (categoryId === undefined) return null;

  const [lecture] = await db
    .insert(lectures)
    .values({ userId, categoryId, title: UNTITLED_LECTURE })
    .returning({ id: lectures.id });
  return lecture.id;
}

/** Moves notes to another subject (or none). Returns the new subject's name, or an error. */
export async function changeLectureSubject(
  userId: string,
  lectureId: string,
  subject: SubjectChoice,
): Promise<{ ok: true; subjectName: string | null } | { ok: false; status: 404; error: string }> {
  const db = getDb();
  const categoryId = await resolveSubject(db, userId, subject);
  if (categoryId === undefined) return { ok: false, status: 404, error: "Subject not found" };
  const [updated] = await db
    .update(lectures)
    .set({ categoryId })
    .where(and(eq(lectures.id, lectureId), eq(lectures.userId, userId)))
    .returning({ id: lectures.id });
  if (!updated) return { ok: false, status: 404, error: "Notes not found" };
  if (!categoryId) return { ok: true, subjectName: null };
  const [row] = await db.select({ name: categories.name }).from(categories).where(eq(categories.id, categoryId));
  return { ok: true, subjectName: row?.name ?? null };
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
  if (!lecture) return { ok: false, status: 404, error: "Notes not found" };

  const objectKey = objectKeyFor(userId, "lecture_image", uploadId);
  const [existing] = await db
    .select({ id: lectureImages.id })
    .from(lectureImages)
    .where(and(eq(lectureImages.objectKey, objectKey), eq(lectureImages.userId, userId)));
  if (existing) return { ok: true, id: existing.id, created: false };

  if (lecture.status === "processing" || lecture.status === "ready") {
    return { ok: false, status: 409, error: "These notes were already generated" };
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

export type LectureForPage = {
  id: string;
  title: string;
  status: (typeof lectures.$inferSelect)["status"];
  categoryId: string | null;
  categoryName: string | null;
  suggestedCategoryName: string | null;
  sections: NoteSection[];
};

/** Notes the user owns, with their sections, read in one consistent snapshot; null if not theirs. */
export async function loadLectureForPage(userId: string, lectureId: string): Promise<LectureForPage | null> {
  return getDb().transaction(
    async (tx) => {
      const [lecture] = await tx
        .select({
          id: lectures.id,
          title: lectures.title,
          status: lectures.status,
          categoryId: lectures.categoryId,
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

export type LecturePhoto = { id: string; position: number };

/** The photos of notes the user owns, in upload order (for the notes page). */
export async function listLecturePhotos(userId: string, lectureId: string): Promise<LecturePhoto[]> {
  return getDb()
    .select({ id: lectureImages.id, position: lectureImages.position })
    .from(lectureImages)
    .where(and(eq(lectureImages.lectureId, lectureId), eq(lectureImages.userId, userId)))
    .orderBy(asc(lectureImages.position), asc(lectureImages.createdAt));
}

/** One photo of the user's notes, or null if it isn't theirs. */
export async function findLecturePhoto(
  userId: string,
  lectureId: string,
  imageId: string,
): Promise<{ objectKey: string; mimeType: string } | null> {
  const [row] = await getDb()
    .select({ objectKey: lectureImages.objectKey, mimeType: lectureImages.mimeType })
    .from(lectureImages)
    .where(and(eq(lectureImages.id, imageId), eq(lectureImages.lectureId, lectureId), eq(lectureImages.userId, userId)));
  return row ?? null;
}

export type DeleteResult = { ok: true } | { ok: false; status: 404 | 409; error: string };

/**
 * Deletes a set of notes and everything made from it: sections, photos, flashcard decks and study
 * history, explanation attempts and their feedback, and weak concepts (database cascades, plus the
 * explanation recordings, which only reference it). Bucket objects are removed best-effort afterwards.
 *
 * `unfinishedOnly` (used by the Capture page to discard an abandoned attempt) refuses notes that were
 * generated, so a retry can never delete real notes. Notes being generated can't be deleted.
 */
export async function deleteLecture(userId: string, lectureId: string, { unfinishedOnly = false } = {}): Promise<DeleteResult> {
  const db = getDb();
  const owned = and(eq(lectures.id, lectureId), eq(lectures.userId, userId));
  const result = await db.transaction(async (tx): Promise<DeleteResult | { ok: true; keys: string[] }> => {
    const [lecture] = await tx.select({ status: lectures.status }).from(lectures).where(owned).for("update");
    if (!lecture) return { ok: false, status: 404, error: "Notes not found" };
    if (lecture.status === "processing") return { ok: false, status: 409, error: "These notes are still being organized. Try again in a minute." };
    if (unfinishedOnly && lecture.status === "ready") return { ok: false, status: 409, error: "These notes were already generated" };

    const images = await tx.select({ key: lectureImages.objectKey }).from(lectureImages).where(eq(lectureImages.lectureId, lectureId));
    const recordings = await tx
      .delete(audioRecordings)
      .where(and(eq(audioRecordings.lectureId, lectureId), eq(audioRecordings.userId, userId)))
      .returning({ key: audioRecordings.objectKey });
    await tx.delete(lectures).where(owned);
    // Photos may have a generated JPEG preview next to them (see ./photos.ts).
    return { ok: true, keys: [...images.flatMap((i) => [i.key, previewKeyFor(i.key)]), ...recordings.map((r) => r.key)] };
  });
  if (!result.ok || !("keys" in result)) return result;
  await Promise.allSettled(result.keys.map((key) => deleteObject(key)));
  return { ok: true };
}
