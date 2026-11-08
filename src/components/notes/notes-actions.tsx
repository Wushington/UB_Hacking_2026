"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { orbitCardClass } from "@/components/orbit/shell";
import { NO_SUBJECT, SubjectPicker, subjectChoice, type SubjectOption } from "@/components/subjects/subject-picker";

type Status = { kind: "idle" } | { kind: "busy" } | { kind: "saved" } | { kind: "error"; message: string };

const buttonClass =
  "inline-flex h-[46px] shrink-0 items-center justify-center gap-2 rounded-[10px] px-5 text-[14px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";

async function errorMessage(res: Response, fallback: string) {
  try {
    const body = (await res.json()) as { error?: unknown };
    return typeof body.error === "string" && res.status < 500 ? body.error : fallback;
  } catch {
    return fallback;
  }
}

/** Move notes to another subject, or delete them (with an inline confirmation). */
export function NotesActions({
  lectureId,
  subjects,
  subjectId,
  canDelete = true,
}: {
  lectureId: string;
  subjects: SubjectOption[];
  /** The notes' current subject, or null for none. */
  subjectId: string | null;
  /** False while the notes are still being generated. */
  canDelete?: boolean;
}) {
  const router = useRouter();
  const current = subjectId ?? NO_SUBJECT;
  const [value, setValue] = useState(current);
  const [newName, setNewName] = useState("");
  // After a change the page re-renders with the new subject (e.g. a just-created one's id): follow it.
  const [shown, setShown] = useState(current);
  if (shown !== current) {
    setShown(current);
    setValue(current);
  }
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [confirming, setConfirming] = useState(false);
  const busy = status.kind === "busy";
  const changed = value !== current;

  async function moveSubject() {
    const picked = subjectChoice(value, newName);
    if ("error" in picked) return setStatus({ kind: "error", message: picked.error });
    setStatus({ kind: "busy" });
    try {
      const res = await fetch(`/api/lectures/${lectureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: picked.choice }),
      });
      if (!res.ok) return setStatus({ kind: "error", message: await errorMessage(res, "Couldn’t change the subject. Please try again.") });
      setStatus({ kind: "saved" });
      setNewName("");
      router.refresh(); // new subject id/name (and a new subject in the list) come from the server
    } catch {
      setStatus({ kind: "error", message: "Couldn’t reach the server. Check your connection and try again." });
    }
  }

  async function deleteNotes() {
    setStatus({ kind: "busy" });
    try {
      const res = await fetch(`/api/lectures/${lectureId}`, { method: "DELETE" });
      if (!res.ok) {
        setConfirming(false);
        return setStatus({ kind: "error", message: await errorMessage(res, "Couldn’t delete these notes. Please try again.") });
      }
      router.push("/subjects");
    } catch {
      setStatus({ kind: "error", message: "Couldn’t reach the server. Check your connection and try again." });
    }
  }

  return (
    <section aria-label="Subject and delete" className={orbitCardClass}>
      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
          <div className="w-full sm:max-w-[310px]">
            <SubjectPicker
              label="Subject"
              subjects={subjects}
              value={value}
              onChange={(v) => {
                setValue(v);
                setStatus({ kind: "idle" });
              }}
              newName={newName}
              onNewNameChange={setNewName}
              disabled={busy}
            />
          </div>
          <button
            type="button"
            onClick={moveSubject}
            disabled={!changed || busy}
            className={`${buttonClass} border border-[#333564] bg-[#1e1f45] text-white hover:bg-[#2a2b5a] disabled:hover:bg-[#1e1f45]`}
          >
            Change Subject
          </button>
        </div>

        {canDelete && !confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={busy}
            className={`${buttonClass} border border-[#ff5e7a]/50 text-[#ff5e7a] hover:bg-[#281d35]`}
          >
            <Trash2 aria-hidden className="size-4" />
            Delete Notes
          </button>
        ) : null}
      </div>

      {confirming ? (
        <div role="alertdialog" aria-label="Delete these notes?" className="flex flex-col gap-3 rounded-[12px] bg-[#281d35] p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] leading-[1.6] text-[#e8e6ff]">
            Delete these notes? Their photos, flashcards, study history and explanations are deleted too. This can’t be undone.
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={busy}
              className="h-10 rounded-[10px] px-4 text-[13px] text-[#c1bedf] transition-colors hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={deleteNotes}
              disabled={busy}
              className="h-10 rounded-[10px] bg-[#ff5e7a] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#ff7891] disabled:opacity-50"
            >
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      ) : null}

      <div aria-live="polite">
        {status.kind === "error" ? (
          <p role="alert" className="text-[13px] text-[#ff5e7a]">
            {status.message}
          </p>
        ) : status.kind === "saved" ? (
          <p className="text-[13px] text-[#4ecba0]">Subject changed.</p>
        ) : null}
      </div>
    </section>
  );
}
