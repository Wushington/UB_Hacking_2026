"use client";

import { Mic } from "lucide-react";
import Link from "next/link";
import type { Divider } from "@/contracts/dividers";
import type { WeakConceptView } from "@/contracts/weak-concepts";
import { Pill } from "@/components/orbit/shell";
import { DividerGroups, SubjectPanel } from "@/components/subjects/divider-groups";
import { buildSubjectsLayout, dividerGroups, type SubjectGroup, type SubjectInfo, type SubjectLecture } from "@/components/subjects/subjects-layout";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const actionBase = "inline-flex h-11 min-w-[150px] flex-1 items-center justify-center gap-2 rounded-[10px] px-3 text-[13px] font-semibold whitespace-nowrap transition-colors";
const primaryAction = cn(actionBase, "bg-[#ff5e7a] text-white hover:bg-[#ff7891]");
const secondaryAction = cn(actionBase, "border border-[#333564] bg-[#1e1f45] text-white hover:bg-[#2a2b5a]");

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function ConceptCard({ concept: c }: { concept: WeakConceptView }) {
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-[14px] bg-[#1e1f45]/60 p-3.5">
      <div className="flex flex-col gap-1">
        <h4 className="text-[15px] font-medium break-words text-white">{c.label}</h4>
        <p className="text-[12px] break-words text-[#9496bf]">
          {/* A fixed time zone keeps the server and browser renders identical. */}
          <span>{c.lectureTitle}</span> · last seen <time dateTime={c.lastSeenAt}>{new Date(c.lastSeenAt).toLocaleDateString("en-US", { timeZone: "UTC" })}</time>
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {c.missedCardCount > 0 && <Pill>{`Missed ${plural(c.missedCardCount, "flashcard")}`}</Pill>}
        {c.explanationFeedbackCount > 0 && <Pill>{`Weak point in ${plural(c.explanationFeedbackCount, "explanation recording")}`}</Pill>}
      </div>
      {c.relatedCards.length > 0 && (
        <details>
          <summary className="cursor-pointer text-[13px] font-medium text-[#c1bedf]">{`Review ${plural(c.relatedCards.length, "missed card")}`}</summary>
          <ol className="mt-3 flex flex-col gap-3">
            {c.relatedCards.map((card) => (
              <li key={card.id} className="border-b border-[#333564] pb-3 last:border-b-0">
                <p className="text-[13px] font-medium break-words text-white">{card.question}</p>
                <p className="text-[13px] break-words text-[#9496bf]">{card.answer}</p>
              </li>
            ))}
          </ol>
        </details>
      )}
      <div className="flex flex-wrap gap-2">
        {c.missedCardCount > 0 && (
          <Link href={`/lectures/${c.lectureId}/study`} className={primaryAction}>
            Study Flashcards
          </Link>
        )}
        <Link href={`/explain?concept=${c.id}`} className={c.missedCardCount > 0 ? secondaryAction : primaryAction}>
          <Mic aria-hidden className="size-4" />
          Record Explanation
        </Link>
        {c.explanationFeedbackCount > 0 && (
          <>
            {c.feedbackRecordingId && (
              <Link href={`/explain?recording=${c.feedbackRecordingId}`} className={secondaryAction}>
                View Feedback
              </Link>
            )}
            <Link href={`/lectures/${c.lectureId}`} className={secondaryAction}>
              View Notes
            </Link>
          </>
        )}
      </div>
    </li>
  );
}

/** Concepts whose lecture isn't in `lectures` still need a place to appear: they're listed under No Subject. */
function withMissingLectures(lectures: SubjectLecture[], concepts: WeakConceptView[]): SubjectLecture[] {
  const known = new Set(lectures.map((l) => l.id));
  const missing = new Map<string, SubjectLecture>();
  for (const c of concepts) {
    if (!known.has(c.lectureId)) {
      missing.set(c.lectureId, { id: c.lectureId, title: c.lectureTitle, status: "ready", updatedAt: new Date(c.lastSeenAt), categoryId: null, categoryName: null });
    }
  }
  return [...lectures, ...missing.values()];
}

/** Weak concepts organized like My Subjects: divider, then subject, then concept (most recent first). */
export function WeakConceptsList({
  concepts,
  lectures,
  subjects,
  dividers,
}: {
  concepts: WeakConceptView[];
  lectures: SubjectLecture[];
  subjects: SubjectInfo[];
  dividers: Divider[];
}) {
  if (concepts.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">No weak concepts yet. Cards you mark Missed and weak points from your explanations will appear here.</p>
        <Link href="/quizzes" className={buttonVariants({ size: "sm" })}>Study Flashcards</Link>
      </div>
    );
  }

  const conceptsIn = (subject: SubjectGroup) => {
    const lectureIds = new Set(subject.lectures.map((l) => l.id));
    return concepts.filter((c) => lectureIds.has(c.lectureId));
  };
  // Only subjects with something to review appear here.
  const groups = dividerGroups(buildSubjectsLayout(withMissingLectures(lectures, concepts), subjects, dividers)).map((group) => ({
    ...group,
    subjects: group.subjects.filter((subject) => conceptsIn(subject).length > 0),
  }));

  return (
    <DividerGroups
      groups={groups}
      filterLabel="Filter weak concepts by divider"
      countItems={(list) => list.flatMap(conceptsIn).length}
      itemName="weak concept"
      renderSubject={(subject) => {
        const inSubject = conceptsIn(subject);
        return (
          <SubjectPanel key={subject.id} subject={subject} count={plural(inSubject.length, "concept")}>
            <ul className="flex w-full flex-col gap-3">
              {inSubject.map((concept) => (
                <ConceptCard key={concept.id} concept={concept} />
              ))}
            </ul>
          </SubjectPanel>
        );
      }}
      renderEmpty={(group) => (
        <p className="rounded-[18px] border border-dashed border-[#333564] px-5 py-6 text-center text-[13px] leading-[1.6] text-[#9496bf]">
          No weak concepts in {group.name}. Cards you mark Missed and weak points from your explanations will appear here.
        </p>
      )}
    />
  );
}
