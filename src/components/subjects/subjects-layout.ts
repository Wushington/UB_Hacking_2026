import type { Divider } from "@/contracts/dividers";

export type SubjectLecture = {
  id: string;
  title: string;
  status: "draft" | "processing" | "ready" | "failed";
  updatedAt: Date;
  categoryId: string | null;
  categoryName: string | null;
};

export type SubjectInfo = { id: string; name: string; dividerId: string | null };

export type SubjectGroup = { id: string; name: string; lectures: SubjectLecture[] };

export type SubjectsLayout = {
  /** Notes without a subject: the catch-all shown first. */
  noSubject: SubjectLecture[];
  /** Subjects not under any divider, shown above the dividers. */
  ungrouped: SubjectGroup[];
  dividers: { divider: Divider; subjects: SubjectGroup[] }[];
};

const newest = (g: SubjectGroup) => g.lectures[0]?.updatedAt.getTime() ?? -Infinity;

/**
 * Arranges My subjects. `lectures` must be newest first. Subjects are ordered by their newest notes;
 * subjects with no notes yet come after, alphabetically. Dividers keep their saved order; a subject
 * whose divider no longer exists falls back above the dividers.
 */
export function buildSubjectsLayout(lectures: SubjectLecture[], subjects: SubjectInfo[], dividers: Divider[]): SubjectsLayout {
  const groups = new Map<string, SubjectGroup>(subjects.map((s) => [s.id, { id: s.id, name: s.name, lectures: [] }]));
  const noSubject: SubjectLecture[] = [];
  for (const lecture of lectures) {
    if (!lecture.categoryId) {
      noSubject.push(lecture);
      continue;
    }
    let group = groups.get(lecture.categoryId);
    if (!group) {
      group = { id: lecture.categoryId, name: lecture.categoryName ?? "Untitled subject", lectures: [] };
      groups.set(lecture.categoryId, group);
    }
    group.lectures.push(lecture);
  }

  const sort = (list: SubjectGroup[]) =>
    list.sort((a, b) => newest(b) - newest(a) || a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  const ordered = [...dividers].sort((a, b) => a.position - b.position);
  const known = new Set(ordered.map((d) => d.id));
  const dividerOf = new Map(subjects.map((s) => [s.id, s.dividerId && known.has(s.dividerId) ? s.dividerId : null]));

  const all = [...groups.values()];
  return {
    noSubject,
    ungrouped: sort(all.filter((g) => !dividerOf.get(g.id))),
    dividers: ordered.map((divider) => ({ divider, subjects: sort(all.filter((g) => dividerOf.get(g.id) === divider.id)) })),
  };
}
