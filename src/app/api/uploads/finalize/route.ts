import { and, eq } from "drizzle-orm";
import { finalizeUploadSchema, type FinalizeUploadResponse } from "@/contracts/uploads";
import { getDb, schema } from "@/db";
import { jsonError, parseJson, userIdOr401 } from "@/lib/api";
import { deleteObject, headObject, objectKeyFor } from "@/lib/storage";
import { checkUploadedAudio, recordingPurposeFor } from "@/lib/uploads";
import { ensureUser } from "@/lib/users";

const { audioRecordings, lectures } = schema;

/**
 * Step 2 of an upload: checks the object really exists in the owner's namespace, validates what
 * was stored, and creates the media row. Idempotent: finalizing the same upload twice returns
 * the same row.
 */
export async function POST(request: Request) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;

  const input = await parseJson(request, finalizeUploadSchema);
  if (input instanceof Response) return input;

  const recordingPurpose = recordingPurposeFor(input.purpose);
  // Whiteboard images are finalized by the Capture feature, which isn't built yet.
  if (!recordingPurpose) return jsonError(501, "Image uploads aren't supported yet");
  if (recordingPurpose === "explanation" && !input.lectureId) {
    return jsonError(400, "lectureId: an explanation must belong to a class");
  }

  const db = getDb();
  if (input.lectureId) {
    const [lecture] = await db
      .select({ id: lectures.id })
      .from(lectures)
      .where(and(eq(lectures.id, input.lectureId), eq(lectures.userId, userId)))
      .limit(1);
    if (!lecture) return jsonError(404, "Class not found");
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

  return Response.json({ id } satisfies FinalizeUploadResponse, { status: row ? 201 : 200 });
}
