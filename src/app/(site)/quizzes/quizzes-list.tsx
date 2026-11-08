"use client";

import { ImageIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import type { Divider } from "@/contracts/dividers";
import { orbitCardClass, Pill } from "@/components/orbit/shell";
import { buildSubjectsLayout, type SubjectGroup, type SubjectInfo } from "@/components/subjects/subjects-layout";
import type { QuizRow } from "@/lib/quizzes/view";
import { cn } from "@/lib/utils";

const ALL = "all";
const UNORGANIZED = "unorganized";

type Subject = SubjectGroup<QuizRow>;
type Group = { key: string; name: string; subjects: Subject[] };

const actionBase = "mt-auto inline-flex h-11 w-full items-center justify-center rounded-[10px] px-3 text-[13px] font-semibold transition-colors";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const deckCount = (subjects: Subject[]) => subjects.flatMap((s) => s.lectures).filter((l) => l.cardCount !== null).length;

function DividerSelector({ groups, active, onSelect }: { groups: Group[]; active: string; onSelect: (key: string) => void }) {
  return (
    <div role="group" aria-label="Filter flashcards by divider" className="-mx-1 flex max-w-full gap-2 overflow-x-auto p-1">
      {[{ key: ALL, name: "All" }, ...groups].map(({ key, name }) => (
        <button
          key={key}
          type="button"
          title={name}
          aria-pressed={key === active}
          onClick={() => onSelect(key)}
          className={cn(
            "h-11 max-w-[240px] shrink-0 truncate rounded-full px-4 text-[13px] transition-colors",
            key === active ? "bg-[#ff5e7a] font-semibold text-white" : "bg-[#1e1f45] text-[#c1bedf] hover:bg-[#2a2b5a] hover:text-white",
          )}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

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
  const noSubject = subject.id === "";
  return (
    <section aria-label={subject.name} className={orbitCardClass}>
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="flex h-[38px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#2a2b5a] text-[13px] font-semibold text-[#ff5e7a]">
            {noSubject ? "?" : subject.name.trim().charAt(0).toUpperCase()}
          </span>
          <h3 className="truncate text-[19px] font-medium">{subject.name}</h3>
        </div>
        <Pill>{plural(deckCount([subject]), "deck")}</Pill>
      </div>
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
    </section>
  );
}

function EmptyNotice({ group }: { group: Group }) {
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

/** Flashcard decks organized like My Subjects: divider, then subject, then deck. The selector only filters what's shown. */
export function QuizzesList({ quizzes, subjects, dividers }: { quizzes: QuizRow[]; subjects: SubjectInfo[]; dividers: Divider[] }) {
  const [selected, setSelected] = useState(ALL);

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

  const layout = buildSubjectsLayout(quizzes, subjects, dividers);
  const noSubject: Subject[] = layout.noSubject.length ? [{ id: "", name: "No Subject", lectures: layout.noSubject }] : [];
  const unorganized: Group = { key: UNORGANIZED, name: "Unorganized", subjects: [...noSubject, ...layout.ungrouped] };
  const groups: Group[] = [
    ...(unorganized.subjects.length ? [unorganized] : []),
    ...layout.dividers.map(({ divider, subjects: inDivider }) => ({ key: divider.id, name: divider.name, subjects: inDivider })),
  ];

  // A divider can disappear while it's selected (deleted elsewhere, then refreshed).
  const active = groups.some((g) => g.key === selected) ? selected : ALL;
  const isAll = active === ALL;
  const shown = isAll ? groups.filter((g) => g.subjects.length) : groups.filter((g) => g.key === active);
  const showHeadings = isAll && dividers.length > 0;
  const shownDecks = deckCount(shown.flatMap((g) => g.subjects));

  return (
    <>
      {dividers.length > 0 ? <DividerSelector groups={groups} active={active} onSelect={setSelected} /> : null}
      <p role="status" className="sr-only">
        Showing {plural(shownDecks, "deck")} in {isAll ? "all dividers" : shown[0]?.name}
      </p>

      {shown.map((group) => (
        <section key={group.key} aria-labelledby={`flashcards-${group.key}`} className="flex w-full flex-col gap-4">
          {showHeadings ? (
            <div className="flex w-full items-baseline gap-2.5 border-b border-[#333564] pb-2.5">
              <h2 id={`flashcards-${group.key}`} className="truncate text-[18px] font-medium text-white sm:text-[20px]">
                {group.name}
              </h2>
              <span className="shrink-0 text-[12px] text-[#9496bf]">{plural(group.subjects.length, "subject")}</span>
            </div>
          ) : (
            <h2 id={`flashcards-${group.key}`} className="sr-only">
              {group.name}
            </h2>
          )}
          {!isAll && deckCount(group.subjects) === 0 ? <EmptyNotice group={group} /> : null}
          {group.subjects.length ? (
            <div className="grid w-full grid-cols-1 items-start gap-[22px] lg:grid-cols-2 lg:gap-6">
              {group.subjects.map((subject) => (
                <SubjectCard key={subject.id} subject={subject} />
              ))}
            </div>
          ) : null}
        </section>
      ))}
    </>
  );
}
