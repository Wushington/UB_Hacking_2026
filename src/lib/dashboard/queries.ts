import "server-only";
import { and, count, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { listWeakConcepts } from "@/lib/weak-concepts/store";
import { dayLabel, quizAccuracy, studyStreak, type DashboardView } from "./view";

const { audioRecordings, categories, lectureImages, lectures, studySessions } = schema;

const RECENT_NOTES = 3;
const WEAK_CONCEPT_PREVIEW = 3;

/** The signed-in user's dashboard. Every query is scoped to `userId`. */
export async function getDashboardView(userId: string, firstName: string | null, now = new Date()): Promise<DashboardView> {
  const db = getDb();

  const [classRows, [{ notesSaved }], recent, sessions, weak] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name, noteCount: count(lectures.id) })
      .from(categories)
      .leftJoin(lectures, and(eq(lectures.categoryId, categories.id), eq(lectures.userId, userId)))
      .where(eq(categories.userId, userId))
      .groupBy(categories.id, categories.name)
      .orderBy(desc(count(lectures.id)), categories.name),
    db.select({ notesSaved: count() }).from(lectures).where(eq(lectures.userId, userId)),
    db
      .select({ id: lectures.id, title: lectures.title, className: categories.name, updatedAt: lectures.updatedAt })
      .from(lectures)
      .leftJoin(categories, eq(categories.id, lectures.categoryId))
      .where(eq(lectures.userId, userId))
      .orderBy(desc(lectures.updatedAt))
      .limit(RECENT_NOTES),
    db
      .select({ correctCount: studySessions.correctCount, totalCount: studySessions.totalCount, completedAt: studySessions.completedAt })
      .from(studySessions)
      .where(and(eq(studySessions.userId, userId), eq(studySessions.status, "completed"))),
    listWeakConcepts(userId),
  ]);

  // Label each recent note by what it was captured from.
  const ids = recent.map((r) => r.id);
  const [withImages, withAudio] = ids.length
    ? await Promise.all([
        db.selectDistinct({ id: lectureImages.lectureId }).from(lectureImages).where(and(eq(lectureImages.userId, userId), inArray(lectureImages.lectureId, ids))),
        db
          .selectDistinct({ id: audioRecordings.lectureId })
          .from(audioRecordings)
          .where(and(eq(audioRecordings.userId, userId), eq(audioRecordings.purpose, "lecture"), inArray(audioRecordings.lectureId, ids))),
      ])
    : [[], []];
  const imageIds = new Set(withImages.map((r) => r.id));
  const audioIds = new Set(withAudio.map((r) => r.id));

  return {
    signedIn: true,
    firstName,
    stats: {
      quizAccuracy: quizAccuracy(sessions),
      notesSaved,
      quizzesTaken: sessions.length,
      streakDays: studyStreak(
        sessions.flatMap((s) => (s.completedAt ? [s.completedAt] : [])),
        now,
      ),
    },
    classes: classRows,
    recentNotes: recent.map((r) => ({
      id: r.id,
      title: r.title,
      className: r.className,
      source: imageIds.has(r.id) ? "Handwritten" : audioIds.has(r.id) ? "Audio" : "Notes",
      dayLabel: dayLabel(r.updatedAt, now),
    })),
    weakConcepts: weak.slice(0, WEAK_CONCEPT_PREVIEW).map((c) => ({
      id: c.id,
      label: c.label,
      detail: `${c.lectureTitle} · ${
        c.missedCardCount > 0
          ? `Missed on ${c.missedCardCount} flashcard${c.missedCardCount === 1 ? "" : "s"}`
          : "Flagged in your explanation"
      }`,
    })),
    weakConceptCount: weak.length,
  };
}
