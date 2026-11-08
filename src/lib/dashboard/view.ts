/** Everything the home dashboard shows, already shaped for display. Built only from the user's own rows. */
export type DashboardView = {
  signedIn: boolean;
  /** From the Clerk profile; null when unknown. */
  firstName: string | null;
  stats: {
    /** Percent of flashcards answered correctly in completed sessions; null before any session. */
    quizAccuracy: number | null;
    notesSaved: number;
    quizzesTaken: number;
    streakDays: number;
  };
  classes: { id: string; name: string; noteCount: number }[];
  recentNotes: { id: string; title: string; className: string | null; source: "Whiteboard" | "Audio" | "Notes"; dayLabel: string }[];
  weakConcepts: { id: string; label: string; detail: string }[];
  weakConceptCount: number;
};

export function emptyDashboard(signedIn: boolean): DashboardView {
  return {
    signedIn,
    firstName: null,
    stats: { quizAccuracy: null, notesSaved: 0, quizzesTaken: 0, streakDays: 0 },
    classes: [],
    recentNotes: [],
    weakConcepts: [],
    weakConceptCount: 0,
  };
}

const DAY_MS = 86_400_000;
/** Whole UTC calendar days since the epoch. */
const dayNumber = (d: Date) => Math.floor(d.getTime() / DAY_MS);

/** Consecutive days with a completed study session, ending today or yesterday (so it survives until a day is missed). */
export function studyStreak(completedAt: Date[], now: Date): number {
  const days = new Set(completedAt.map(dayNumber));
  let day = dayNumber(now);
  if (!days.has(day)) day -= 1;
  let streak = 0;
  while (days.has(day)) {
    streak += 1;
    day -= 1;
  }
  return streak;
}

export function quizAccuracy(sessions: { correctCount: number; totalCount: number }[]): number | null {
  const total = sessions.reduce((sum, s) => sum + s.totalCount, 0);
  if (total === 0) return null;
  const correct = sessions.reduce((sum, s) => sum + s.correctCount, 0);
  return Math.round((correct / total) * 100);
}

export function dayLabel(date: Date, now: Date): string {
  const diff = dayNumber(now) - dayNumber(date);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
