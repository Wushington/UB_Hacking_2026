"use client";

import { ImageIcon } from "lucide-react";
import Link from "next/link";
import type { Divider } from "@/contracts/dividers";
import { DividerGroups, SubjectPanel } from "@/components/subjects/divider-groups";
import { buildSubjectsLayout, dividerGroups, type DividerGroup, type SubjectGroup, type SubjectInfo } from "@/components/subjects/subjects-layout";
import { Pill } from "@/components/orbit/shell";
import type { QuizRow } from "@/lib/quizzes/view";
import { cn } from "@/lib/utils";

type Subject = SubjectGroup<QuizRow>;

const actionBase = "mt-auto inline-flex h-11 w-full items-center justify-center rounded-[10px] px-3 text-[13px] font-semibold transition-colors";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const deckCount = (subjects: Subject[]) => subjects.flatMap((s) => s.lectures).filter((l) => l.cardCount !== null).length;

function DeckCard({ deck }: { deck: QuizRow }) {
  const generate = deck.cardCount === null;
  return (
    <li className="flex min-w-0 flex-col gap-3 rounded-[14px] bg-[#1e1f45]/60 p-3.5">
      <h4 className="text-[14px] font-medium break-words text-white">{deck.title}</h4>
      <div className="flex flex-wrap gap-1.5">
        {deck.cardCount === null ? (
          <Pill>No flashcards yet</Pill>
        ) : (
          <>
            <Pill>{plural(deck.cardCount, "card")}</Pill>
            <Pill>{deck.sessionCount === 0 ? "Not studied yet" : `Studied ${plural(deck.sessionCount, "time")}`}</Pill>
            {deck.lastScore !== null && <Pill>{`Last score ${deck.lastScore}%`}</Pill>}
          </>
        )}
      </div>
      <Link
        href={`/lectures/${deck.id}/study`}
        className={cn(actionBase, generate ? "border border-[#ff5e7a]/60 text-[#ff8da1] hover:bg-[#281d35] hover:text-white" : "bg-[#ff5e7a] text-white hover:bg-[#ff7891]")}
      >
        {generate ? "Generate Flashcards" : deck.sessionCount === 0 ? "Start Studying" : "Continue Studying"}
      </Link>
    </li>
  );
}

function SubjectCard({ subject }: { subject: Subject }) {
  return (
    <SubjectPanel subject={subject} count={plural(deckCount([subject]), "deck")}>
      {subject.lectures.length ? (
        <ul className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
          {subject.lectures.map((deck) => (
            <DeckCard key={deck.id} deck={deck} />
          ))}
        </ul>
      ) : (
        <p className="flex items-center gap-2 text-[13px] text-[#9496bf]">
          <ImageIcon aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
          No notes in this subject yet.
        </p>
      )}
    </SubjectPanel>
  );
}

function EmptyNotice({ group }: { group: DividerGroup<QuizRow> }) {
  const hasNotes = group.subjects.some((s) => s.lectures.length > 0);
  return (
    <p className="rounded-[18px] border border-dashed border-[#333564] px-5 py-6 text-center text-[13px] leading-[1.6] text-[#9496bf]">
      No flashcards in {group.name} yet.{" "}
      {hasNotes ? (
        "Generate a deck from the notes below."
      ) : (
        <>
          Add notes to its subjects from{" "}
          <Link href="/subjects" className="text-[#ff8da1] underline underline-offset-2 hover:text-white">
            My Subjects
          </Link>
          .
        </>
      )}
    </p>
  );
}

/** Flashcard decks organized like My Subjects: divider, then subject, then deck. */
export function QuizzesList({ quizzes, subjects, dividers }: { quizzes: QuizRow[]; subjects: SubjectInfo[]; dividers: Divider[] }) {
  if (quizzes.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[14px] text-[#9496bf]">No notes yet. Capture notes to generate flashcards.</p>
        <Link href="/capture" className="inline-flex h-11 items-center rounded-[10px] bg-[#ff5e7a] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#ff7891]">
          Capture Notes
        </Link>
      </div>
    );
  }

  return (
    <DividerGroups
      groups={dividerGroups(buildSubjectsLayout(quizzes, subjects, dividers))}
      filterLabel="Filter flashcards by divider"
      countItems={deckCount}
      itemName="deck"
      renderSubject={(subject) => <SubjectCard key={subject.id} subject={subject} />}
      renderEmpty={(group) => <EmptyNotice group={group} />}
    />
  );
}
