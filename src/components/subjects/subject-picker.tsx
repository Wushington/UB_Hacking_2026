"use client";

import { ChevronDown } from "lucide-react";
import { useId } from "react";
import type { SubjectChoice } from "@/contracts/lectures";

export type SubjectOption = { id: string; name: string };

/** Select values for "no subject" and "type a new one"; anything else is a subject id. */
export const NO_SUBJECT = "";
export const NEW_SUBJECT = "__new__";

/** The API choice for a picker state, or an error message if a new subject has no name yet. */
export function subjectChoice(value: string, newName: string): { choice: SubjectChoice } | { error: string } {
  if (value === NEW_SUBJECT) {
    const name = newName.trim();
    return name ? { choice: { name } } : { error: "Name your new subject, or pick an existing one." };
  }
  return { choice: value === NO_SUBJECT ? null : { id: value } };
}

const fieldClass =
  "h-[46px] w-full rounded-[10px] bg-[#1e1f45] text-[14px] text-white outline-none focus-visible:ring-2 focus-visible:ring-[#ff5e7a] disabled:opacity-60";

/** Dropdown of the user's subjects plus "No subject" and "+ New subject…", which reveals a name field. */
export function SubjectPicker({
  subjects,
  value,
  onChange,
  newName,
  onNewNameChange,
  disabled = false,
  label = "Subject",
}: {
  subjects: SubjectOption[];
  value: string;
  onChange: (value: string) => void;
  newName: string;
  onNewNameChange: (name: string) => void;
  disabled?: boolean;
  label?: string;
}) {
  const selectId = useId();
  const nameId = useId();
  return (
    <div className="flex w-full min-w-0 flex-col gap-2">
      <label htmlFor={selectId} className="text-[11px] tracking-[0.5px] text-[#9496bf] uppercase">
        {label}
      </label>
      <div className="relative">
        <select
          id={selectId}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className={`${fieldClass} appearance-none pr-10 pl-3.5`}
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
          <option value={NO_SUBJECT}>No subject</option>
          <option value={NEW_SUBJECT}>+ New subject…</option>
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-[#c1bedf]" />
      </div>
      {value === NEW_SUBJECT ? (
        <>
          <label htmlFor={nameId} className="sr-only">
            New subject name
          </label>
          <input
            id={nameId}
            value={newName}
            maxLength={60}
            disabled={disabled}
            onChange={(e) => onNewNameChange(e.target.value)}
            placeholder="e.g. Cell Biology · BIO 201"
            className={`${fieldClass} px-3.5 placeholder:text-[#6f71a0]`}
          />
        </>
      ) : null}
    </div>
  );
}
