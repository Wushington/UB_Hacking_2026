"use client";

import { useId, useState, type ReactNode } from "react";
import { orbitCardClass, Pill } from "@/components/orbit/shell";
import { cn } from "@/lib/utils";
import { UNORGANIZED, type DividerGroup, type SubjectGroup, type SubjectLecture } from "./subjects-layout";

const ALL = "all";

/** Subject card matching My Subjects: letter chip, name, a count pill, then the subject's content. */
export function SubjectPanel({ subject, count, children }: { subject: SubjectGroup<SubjectLecture>; count: string; children: ReactNode }) {
  return (
    <section aria-label={subject.name} className={orbitCardClass}>
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span aria-hidden className="flex h-[38px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#2a2b5a] text-[13px] font-semibold text-[#ff5e7a]">
            {subject.id === "" ? "?" : subject.name.trim().charAt(0).toUpperCase()}
          </span>
          <h3 className="truncate text-[19px] font-medium">{subject.name}</h3>
        </div>
        <Pill>{count}</Pill>
      </div>
      {children}
    </section>
  );
}

function DividerSelector({ label, options, active, onSelect }: { label: string; options: { key: string; name: string }[]; active: string; onSelect: (key: string) => void }) {
  return (
    <div role="group" aria-label={label} className="-mx-1 flex max-w-full gap-2 overflow-x-auto p-1">
      {options.map(({ key, name }) => (
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

/** Sections organized like My Subjects, with a selector that filters which divider is shown. Nothing is saved. */
export function DividerGroups<L extends SubjectLecture>({
  groups,
  filterLabel,
  countItems,
  itemName,
  renderSubject,
  renderEmpty,
}: {
  groups: DividerGroup<L>[];
  filterLabel: string;
  /** How many items (decks, weak concepts) these subjects hold. */
  countItems: (subjects: SubjectGroup<L>[]) => number;
  itemName: string;
  renderSubject: (subject: SubjectGroup<L>) => ReactNode;
  /** Shown when the selected divider has no items. */
  renderEmpty: (group: DividerGroup<L>) => ReactNode;
}) {
  const baseId = useId();
  const [selected, setSelected] = useState(ALL);

  const selectable = groups.filter((g) => g.key !== UNORGANIZED || g.subjects.length > 0);
  const hasDividers = groups.some((g) => g.key !== UNORGANIZED);
  // A divider can disappear while it's selected (deleted elsewhere, then refreshed).
  const active = selectable.some((g) => g.key === selected) ? selected : ALL;
  const isAll = active === ALL;
  const shown = isAll ? selectable.filter((g) => g.subjects.length) : selectable.filter((g) => g.key === active);
  const showHeadings = isAll && hasDividers;
  const shownItems = countItems(shown.flatMap((g) => g.subjects));

  return (
    <>
      {hasDividers ? <DividerSelector label={filterLabel} options={[{ key: ALL, name: "All" }, ...selectable]} active={active} onSelect={setSelected} /> : null}
      <p role="status" className="sr-only">
        Showing {shownItems} {itemName}
        {shownItems === 1 ? "" : "s"} in {isAll ? "all dividers" : shown[0]?.name}
      </p>

      {shown.map((group) => {
        const headingId = `${baseId}-${group.key}`;
        return (
          <section key={group.key} aria-labelledby={headingId} className="flex w-full flex-col gap-4">
            {showHeadings ? (
              <div className="flex w-full items-baseline gap-2.5 border-b border-[#333564] pb-2.5">
                <h2 id={headingId} className="truncate text-[18px] font-medium text-white sm:text-[20px]">
                  {group.name}
                </h2>
                <span className="shrink-0 text-[12px] text-[#9496bf]">
                  {group.subjects.length} subject{group.subjects.length === 1 ? "" : "s"}
                </span>
              </div>
            ) : (
              <h2 id={headingId} className="sr-only">
                {group.name}
              </h2>
            )}
            {!isAll && countItems(group.subjects) === 0 ? renderEmpty(group) : null}
            {group.subjects.length ? (
              <div className="grid w-full grid-cols-1 items-start gap-[22px] lg:grid-cols-2 lg:gap-6">{group.subjects.map(renderSubject)}</div>
            ) : null}
          </section>
        );
      })}
    </>
  );
}
