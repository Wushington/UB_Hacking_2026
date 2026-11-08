export type ClassLecture = {
  id: string;
  title: string;
  status: "draft" | "processing" | "ready" | "failed";
  updatedAt: Date;
  categoryId: string | null;
  categoryName: string | null;
};

export type ClassGroup = { key: string; name: string; lectures: ClassLecture[] };

/**
 * Groups lectures by class (category), keeping each group's lectures in the given order (newest first).
 * Classes are ordered by their most recent lecture; uncategorized lectures come last.
 */
export function groupByClass(lectures: ClassLecture[]): ClassGroup[] {
  const groups = new Map<string, ClassGroup>();
  for (const lecture of lectures) {
    const key = lecture.categoryId ?? "";
    const group = groups.get(key) ?? { key, name: lecture.categoryName ?? "No class yet", lectures: [] };
    group.lectures.push(lecture);
    groups.set(key, group);
  }
  const all = [...groups.values()];
  return [...all.filter((g) => g.key !== ""), ...all.filter((g) => g.key === "")];
}
