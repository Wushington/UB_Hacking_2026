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

export type SubjectGroup<L extends SubjectLecture = SubjectLecture> = { id: string; name: string; lectures: L[] };

export type SubjectsLayout<L extends SubjectLecture = SubjectLecture> = {
  /** Notes without a subject: the catch-all shown first. */
  noSubject: L[];
  /** Subjects not under any divider, shown above the dividers. */
  ungrouped: SubjectGroup<L>[];
  dividers: { divider: Divider; subjects: SubjectGroup<L>[] }[];
};

const newest = (g: SubjectGroup) => g.lectures[0]?.updatedAt.getTime() ?? -Infinity;

/**
 * Arranges notes by divider and subject (My Subjects and Flashcards). `lectures` must be newest first. Subjects are ordered by their newest notes;
 * subjects with no notes yet come after, alphabetically. Dividers keep their saved order; a subject
 * whose divider no longer exists falls back above the dividers.
 */
export function buildSubjectsLayout<L extends SubjectLecture>(lectures: L[], subjects: SubjectInfo[], dividers: Divider[]): SubjectsLayout<L> {
  const groups = new Map<string, SubjectGroup<L>>(subjects.map((s) => [s.id, { id: s.id, name: s.name, lectures: [] }]));
  const noSubject: L[] = [];
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

  const sort = (list: SubjectGroup<L>[]) =>
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
