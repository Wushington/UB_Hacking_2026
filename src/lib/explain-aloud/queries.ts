import "server-only";
import { and, asc, count, desc, eq, lte } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { presignDownload } from "@/lib/storage";
import { emptyView, toExplainAloudView, type ExplainAloudView } from "./view";

const { audioRecordings, lectures, categories, explanationFeedback, explanationWeakPoints, transcriptSegments } = schema;

/** The user's classes, most recently updated first, for the recorder's class picker. */
export async function getLectureOptions(userId: string): Promise<{ id: string; title: string }[]> {
  return getDb()
    .select({ id: lectures.id, title: lectures.title })
    .from(lectures)
    .where(eq(lectures.userId, userId))
    .orderBy(desc(lectures.updatedAt))
    .limit(100);
}

/**
 * Loads one of the user's explanation attempts: `recordingId` if given (and owned), otherwise
 * the latest. Every query is scoped to `userId`, or to a parent row already verified as theirs.
 */
export async function getExplainAloudView(userId: string, recordingId?: string): Promise<ExplainAloudView> {
  const db = getDb();
  const requestedId = z.uuid().safeParse(recordingId).data;

  const [recording] = await db
    .select()
    .from(audioRecordings)
    .where(
      and(
        eq(audioRecordings.userId, userId),
        eq(audioRecordings.purpose, "explanation"),
        requestedId ? eq(audioRecordings.id, requestedId) : undefined,
      ),
    )
    .orderBy(desc(audioRecordings.createdAt))
    .limit(1);

  if (!recording) return emptyView("empty");

  const lectureQuery = recording.lectureId
    ? db
        .select({ title: lectures.title, categoryName: categories.name })
        .from(lectures)
        .leftJoin(categories, eq(categories.id, lectures.categoryId))
        .where(and(eq(lectures.id, recording.lectureId), eq(lectures.userId, userId)))
        .limit(1)
    : Promise.resolve([]);

  const attemptQuery = recording.lectureId
    ? db
        .select({ n: count() })
        .from(audioRecordings)
        .where(
          and(
            eq(audioRecordings.userId, userId),
            eq(audioRecordings.purpose, "explanation"),
            eq(audioRecordings.lectureId, recording.lectureId),
            lte(audioRecordings.createdAt, recording.createdAt),
          ),
        )
    : Promise.resolve([{ n: 1 }]);

  const feedbackQuery = db
    .select({
      id: explanationFeedback.id,
      transcriptText: explanationFeedback.transcriptText,
      summary: explanationFeedback.summary,
      coveredIdeas: explanationFeedback.coveredIdeas,
      nextStep: explanationFeedback.nextStep,
    })
    .from(explanationFeedback)
    .where(and(eq(explanationFeedback.recordingId, recording.id), eq(explanationFeedback.userId, userId)))
    .limit(1);

  const [[lecture], [attempt], [feedback], audioSrc] = await Promise.all([
    lectureQuery,
    attemptQuery,
    feedbackQuery,
    presignDownload(recording.objectKey).catch(() => null),
  ]);

  const [weakPoints, segments] = await Promise.all([
    feedback
      ? db
          .select({ label: explanationWeakPoints.label, explanation: explanationWeakPoints.explanation })
          .from(explanationWeakPoints)
          .where(eq(explanationWeakPoints.feedbackId, feedback.id))
      : [],
    feedback?.transcriptText.trim()
      ? []
      : db
          .select({ text: transcriptSegments.text })
          .from(transcriptSegments)
          .where(eq(transcriptSegments.recordingId, recording.id))
          .orderBy(asc(transcriptSegments.position)),
  ]);

  return toExplainAloudView({
    recording,
    lecture: lecture ? { title: lecture.title } : null,
    categoryName: lecture?.categoryName ?? null,
    attemptNumber: Math.max(1, attempt?.n ?? 1),
    feedback: feedback ?? null,
    weakPoints,
    segments,
    audioSrc,
  });
}
