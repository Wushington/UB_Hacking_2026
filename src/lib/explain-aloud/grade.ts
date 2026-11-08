import "server-only";
import { and, asc, eq, inArray, lt, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { GEMINI_FALLBACK_MODELS, GEMINI_MODEL, getGemini } from "@/lib/gemini";
import { getObjectBytes } from "@/lib/storage";
import {
  buildGradingPrompt,
  GRADING_RESPONSE_JSON_SCHEMA,
  parseGradingResponse,
  type GradingNotes,
} from "./grading";

const {
  audioRecordings,
  explanationFeedback,
  explanationWeakPoints,
  lectures,
  noteBlocks,
  noteSections,
  weakConcepts,
  weakConceptSources,
} = schema;

/** A crashed/abandoned job stuck in "processing" may be retried after this long. */
const STALE_PROCESSING_MS = 10 * 60_000;

/** Waits between attempts when Gemini is overloaded, rate-limited or hangs. */
const GEMINI_RETRY_DELAYS_MS = [2_000, 6_000, 15_000];
/** Per-attempt limit: a hung request is abandoned and retried instead of stalling the attempt. */
const GEMINI_ATTEMPT_TIMEOUT_MS = 45_000;
/** Stay inside the routes' maxDuration (120s) so the job can still mark itself failed. */
const GEMINI_TOTAL_BUDGET_MS = 105_000;

function isTransientGeminiError(error: unknown): boolean {
  const name = (error as Error)?.name;
  if (name === "TimeoutError" || name === "AbortError") return true;
  const status = (error as { status?: unknown }).status;
  if (typeof status === "number") return status === 429 || status >= 500;
  return /"code":\s*(429|5\d\d)|UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED/.test(String((error as Error)?.message));
}

/** Model for each attempt: primary first, then the fallbacks, then back to the primary. */
const MODEL_ROTATION = [GEMINI_MODEL, ...GEMINI_FALLBACK_MODELS];

/**
 * Runs a Gemini call with a per-attempt timeout, retrying temporary failures (overload, rate
 * limits, hangs) on the next model in the rotation, with backoff, while the total time budget
 * allows; rethrows anything else.
 */
async function withGeminiRetries<T>(call: (model: string, signal: AbortSignal) => Promise<T>): Promise<T> {
  const startedAt = Date.now();
  for (let attempt = 0; ; attempt++) {
    const model = MODEL_ROTATION[attempt % MODEL_ROTATION.length];
    const remaining = GEMINI_TOTAL_BUDGET_MS - (Date.now() - startedAt);
    try {
      return await call(model, AbortSignal.timeout(Math.min(GEMINI_ATTEMPT_TIMEOUT_MS, remaining)));
    } catch (error) {
      // Switching models needs no long backoff: the next one is likely healthy.
      const delay = attempt === 0 ? 0 : GEMINI_RETRY_DELAYS_MS[attempt - 1];
      const timeLeft = GEMINI_TOTAL_BUDGET_MS - (Date.now() - startedAt);
      // Only retry if there's still a meaningful window (≥15s) for another attempt.
      if (delay === undefined || !isTransientGeminiError(error) || timeLeft - delay < 15_000) throw error;
      console.warn(
        `Gemini ${model} unavailable (${(error as Error).name}); retrying with ${MODEL_ROTATION[(attempt + 1) % MODEL_ROTATION.length]}${delay ? ` in ${delay / 1000}s` : ""}`,
      );
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

type Recording = typeof audioRecordings.$inferSelect;

export type GradingStatus = Recording["status"] | "not-found";

/**
 * Atomically moves the user's explanation recording to "processing" so only one grader runs.
 * Returns the claimed row, or null with the current status if it isn't claimable
 * (already processing, already graded, or not theirs).
 */
export async function claimForGrading(
  userId: string,
  recordingId: string,
): Promise<{ claimed: Recording } | { claimed: null; status: GradingStatus }> {
  const db = getDb();
  const owned = and(
    eq(audioRecordings.id, recordingId),
    eq(audioRecordings.userId, userId),
    eq(audioRecordings.purpose, "explanation"),
  );
  const [claimed] = await db
    .update(audioRecordings)
    .set({ status: "processing" })
    .where(
      and(
        owned,
        or(
          inArray(audioRecordings.status, ["uploaded", "failed"]),
          and(
            eq(audioRecordings.status, "processing"),
            lt(audioRecordings.createdAt, new Date(Date.now() - STALE_PROCESSING_MS)),
          ),
        ),
      ),
    )
    .returning();
  if (claimed) return { claimed };

  const [current] = await db.select({ status: audioRecordings.status }).from(audioRecordings).where(owned).limit(1);
  return { claimed: null, status: current?.status ?? "not-found" };
}

async function loadNotes(userId: string, lectureId: string): Promise<GradingNotes | null> {
  const db = getDb();
  const [lecture] = await db
    .select({ title: lectures.title })
    .from(lectures)
    .where(and(eq(lectures.id, lectureId), eq(lectures.userId, userId)))
    .limit(1);
  if (!lecture) return null;

  const rows = await db
    .select({
      sectionId: noteSections.id,
      heading: noteSections.heading,
      blockId: noteBlocks.id,
      kind: noteBlocks.kind,
      text: noteBlocks.text,
    })
    .from(noteSections)
    .innerJoin(noteBlocks, eq(noteBlocks.sectionId, noteSections.id))
    .where(eq(noteSections.lectureId, lectureId))
    .orderBy(asc(noteSections.position), asc(noteBlocks.position));

  const sections = new Map<string, GradingNotes["sections"][number]>();
  for (const row of rows) {
    const section = sections.get(row.sectionId) ?? { heading: row.heading, blocks: [] };
    section.blocks.push({ id: row.blockId, kind: row.kind, text: row.text });
    sections.set(row.sectionId, section);
  }
  return { lectureTitle: lecture.title, sections: [...sections.values()] };
}

async function markFailed(recordingId: string, reason: string) {
  // Reason goes to the server log only; it may mention Gemini/storage details.
  console.error(`Grading failed for recording ${recordingId}: ${reason}`);
  await getDb()
    .update(audioRecordings)
    .set({ status: "failed" })
    .where(and(eq(audioRecordings.id, recordingId), eq(audioRecordings.status, "processing")));
}

/**
 * Grades a claimed explanation: sends the audio and the class notes to Gemini, then saves the
 * transcript, the grounded weak points, and the weak-concept tally in one transaction.
 * Never throws; failures leave the recording "failed" so the student can retry.
 */
export async function runGrading(recording: Recording): Promise<"ready" | "failed"> {
  try {
    if (!recording.lectureId) {
      await markFailed(recording.id, "recording has no notes");
      return "failed";
    }
    const notes = await loadNotes(recording.userId, recording.lectureId);
    const blockIds = new Set(notes?.sections.flatMap((s) => s.blocks.map((b) => b.id)) ?? []);
    if (!notes || blockIds.size === 0) {
      await markFailed(recording.id, "notes are empty, nothing to compare against");
      return "failed";
    }

    const audio = await getObjectBytes(recording.objectKey);
    const audioBase64 = Buffer.from(audio).toString("base64");
    const response = await withGeminiRetries((model, abortSignal) =>
      getGemini().models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: recording.mimeType, data: audioBase64 } },
              { text: buildGradingPrompt(notes) },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseJsonSchema: GRADING_RESPONSE_JSON_SCHEMA,
          temperature: 0.2,
          abortSignal,
        },
      }),
    );

    const feedback = parseGradingResponse(response.text, blockIds);
    if (!feedback.transcriptText) {
      await markFailed(recording.id, "no intelligible speech in the recording");
      return "failed";
    }

    const lectureId = recording.lectureId;
    await getDb().transaction(async (tx) => {
      const [saved] = await tx
        .insert(explanationFeedback)
        .values({
          recordingId: recording.id,
          lectureId,
          userId: recording.userId,
          transcriptText: feedback.transcriptText,
          summary: feedback.summary ?? null,
          coveredIdeas: feedback.covered,
          nextStep: feedback.nextStep ?? null,
        })
        .returning({ id: explanationFeedback.id });

      for (const wp of feedback.weakPoints) {
        const [point] = await tx
          .insert(explanationWeakPoints)
          .values({
            feedbackId: saved.id,
            conceptKey: wp.conceptKey,
            label: wp.label,
            explanation: wp.explanation,
            evidence: wp.evidence ?? null,
            referenceBlockIds: wp.referenceNoteBlockIds,
          })
          .returning({ id: explanationWeakPoints.id });

        // Feed the "Find the gaps" list: one weak concept per (user, class, concept).
        const now = new Date();
        const [concept] = await tx
          .insert(weakConcepts)
          .values({
            userId: recording.userId,
            lectureId,
            conceptKey: wp.conceptKey,
            label: wp.label,
            feedbackCount: 1,
            lastSeenAt: now,
          })
          .onConflictDoUpdate({
            target: [weakConcepts.userId, weakConcepts.lectureId, weakConcepts.conceptKey],
            set: { label: wp.label, feedbackCount: sql`${weakConcepts.feedbackCount} + 1`, lastSeenAt: now },
          })
          .returning({ id: weakConcepts.id });

        await tx
          .insert(weakConceptSources)
          .values({ weakConceptId: concept.id, sourceType: "explanation_weak_point", sourceId: point.id })
          .onConflictDoNothing();
      }

      await tx.update(audioRecordings).set({ status: "ready" }).where(eq(audioRecordings.id, recording.id));
    });
    return "ready";
  } catch (error) {
    await markFailed(recording.id, error instanceof Error ? `${error.name}: ${error.message}` : "unknown error").catch(
      () => {},
    );
    return "failed";
  }
}
