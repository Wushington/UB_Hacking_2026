export type SubjectLecture = {
  id: string;
  title: string;
  status: "draft" | "processing" | "ready" | "failed";
  updatedAt: Date;
  categoryId: string | null;
  categoryName: string | null;
};

export type SubjectGroup = { key: string; name: string; lectures: SubjectLecture[] };

/**
 * Groups notes by subject (category), keeping each group's lectures in the given order (newest first).
 * Subjects are ordered by their most recent lecture; notes without a subject come last.
 */
export function groupBySubject(lectures: SubjectLecture[]): SubjectGroup[] {
  const groups = new Map<string, SubjectGroup>();
  for (const lecture of lectures) {
    const key = lecture.categoryId ?? "";
    const group = groups.get(key) ?? { key, name: lecture.categoryName ?? "No subject", lectures: [] };
    group.lectures.push(lecture);
    groups.set(key, group);
  }
  const all = [...groups.values()];
  return [...all.filter((g) => g.key !== ""), ...all.filter((g) => g.key === "")];
}
