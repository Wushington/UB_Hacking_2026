import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { finalizeUploadSchema, type FinalizeUploadResponse } from "@/contracts/uploads";
import { getDb, schema } from "@/db";
import { jsonError, parseJson, userIdOr401 } from "@/lib/api";
import { claimForGrading, runGrading } from "@/lib/explain-aloud/grade";
import { finalizeLectureImage } from "@/lib/lectures/store";
import { deleteObject, headObject, objectKeyFor } from "@/lib/storage";
import { checkUploadedAudio, recordingPurposeFor } from "@/lib/uploads";
import { ensureUser } from "@/lib/users";

const { audioRecordings, lectures } = schema;

/** Explanation grading runs in after() from this route. */
export const maxDuration = 120;

/**
 * Step 2 of an upload: checks the object really exists in the owner's namespace, validates what
 * was stored, and creates the media row (lecture_images for whiteboard photos, audio_recordings otherwise). Idempotent: finalizing the same upload twice returns
 * the same row.
 */
export async function POST(request: Request) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;

  const input = await parseJson(request, finalizeUploadSchema);
  if (input instanceof Response) return input;

  if (input.purpose === "lecture_image") {
    if (!input.lectureId) return jsonError(400, "lectureId: a photo must belong to a set of notes");
    const result = await finalizeLectureImage(userId, input.uploadId, input.lectureId);
    if (!result.ok) return jsonError(result.status, result.error);
    return Response.json({ id: result.id } satisfies FinalizeUploadResponse, { status: result.created ? 201 : 200 });
  }

  const recordingPurpose = recordingPurposeFor(input.purpose);
  if (!recordingPurpose) return jsonError(400, "Unsupported upload purpose");
  if (recordingPurpose === "explanation" && !input.lectureId) {
    return jsonError(400, "lectureId: an explanation must belong to a set of notes");
  }

  const db = getDb();
  if (input.lectureId) {
    const [lecture] = await db
      .select({ id: lectures.id })
      .from(lectures)
      .where(and(eq(lectures.id, input.lectureId), eq(lectures.userId, userId)))
      .limit(1);
    if (!lecture) return jsonError(404, "Notes not found");
  }

  // The key is rebuilt from the signed-in user, so nobody can finalize someone else's object.
  const objectKey = objectKeyFor(userId, input.purpose, input.uploadId);

  const [existing] = await db
    .select({ id: audioRecordings.id })
    .from(audioRecordings)
    .where(and(eq(audioRecordings.objectKey, objectKey), eq(audioRecordings.userId, userId)))
    .limit(1);
  if (existing) return Response.json({ id: existing.id } satisfies FinalizeUploadResponse);

  let stored: Awaited<ReturnType<typeof headObject>>;
  try {
    stored = await headObject(objectKey);
  } catch (error) {
    console.error("headObject failed:", (error as Error).message);
    return jsonError(503, "Storage is not available");
  }
  if (!stored) return jsonError(404, "Upload not found. It may have expired; please try again.");

  const check = checkUploadedAudio(input.purpose, stored, input.durationMs);
  if (!check.ok) {
    await deleteObject(objectKey).catch(() => {});
    return jsonError(422, check.reason);
  }

  await ensureUser(userId);
  const [row] = await db
    .insert(audioRecordings)
    .values({
      userId,
      lectureId: input.lectureId ?? null,
      purpose: recordingPurpose,
      objectKey,
      mimeType: check.mimeType,
      durationMs: check.durationMs,
      status: "uploaded",
    })
    .onConflictDoNothing({ target: audioRecordings.objectKey })
    .returning({ id: audioRecordings.id });

  // A concurrent finalize won the insert; return its row.
  const id =
    row?.id ??
    (
      await db
        .select({ id: audioRecordings.id })
        .from(audioRecordings)
        .where(and(eq(audioRecordings.objectKey, objectKey), eq(audioRecordings.userId, userId)))
        .limit(1)
    )[0]?.id;
  if (!id) return jsonError(409, "Upload could not be saved");

  // Explanations are graded right away, after the response so the browser isn't kept waiting.
  // If this is lost (e.g. a restart), the page's poller re-triggers it via /grade.
  if (row && recordingPurpose === "explanation") {
    after(async () => {
      const result = await claimForGrading(userId, row.id);
      if (result.claimed) await runGrading(result.claimed);
    });
  }

  return Response.json({ id } satisfies FinalizeUploadResponse, { status: row ? 201 : 200 });
}
