"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import type { NoteSection, NotesUpdate } from "@/contracts/notes";
import { NOTE_BLOCK_KINDS } from "@/contracts/notes";
import { orbitCardClass, Pill } from "@/components/orbit/shell";
import { cn } from "@/lib/utils";

type Kind = (typeof NOTE_BLOCK_KINDS)[number];
type DraftBlock = NoteSection["blocks"][number];
type DraftSection = { id: string; heading: string; blocks: DraftBlock[] };
export type NotesDraft = { title: string; sections: DraftSection[] };

const KIND_LABELS: Record<Kind, string> = {
  paragraph: "Paragraph",
  bullet: "Bullet",
  definition: "Definition",
  example: "Example",
  equation: "Equation (LaTeX)",
};

const fieldClass =
  "w-full rounded-[10px] bg-[#1e1f45] px-3.5 py-2.5 text-white outline-none placeholder:text-[#6f71a0] focus-visible:ring-2 focus-visible:ring-[#ff5e7a]";
const iconButtonClass =
  "flex size-8 shrink-0 items-center justify-center rounded-full text-[#9496bf] transition-colors hover:bg-[#1e1f45] hover:text-white disabled:pointer-events-none disabled:opacity-30";

/**
 * What gets sent on save: blank blocks are dropped, blank headings get a placeholder, and
 * positions follow the on-screen order. Ids of new rows are replaced by the server.
 */
export function toNotesUpdate(draft: NotesDraft, baseRevision: number): NotesUpdate {
  const title = draft.title.trim();
  return {
    baseRevision,
    ...(title ? { title: title.slice(0, 200) } : {}),
    sections: draft.sections.map((s, position) => ({
      id: s.id,
      heading: s.heading.trim() || "Untitled section",
      position,
      blocks: s.blocks.filter((b) => b.text.trim()).map((b) => ({ ...b, text: b.text.trim() })),
    })),
  };
}

function move<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string; conflict?: boolean };

export function NotesEditor({
  lectureId,
  revision,
  initial,
}: {
  lectureId: string;
  revision: number;
  initial: NotesDraft;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<NotesDraft>(initial);
  const [saved, setSaved] = useState(() => JSON.stringify(initial));
  const [state, setState] = useState<SaveState>({ kind: "idle" });
  const [refreshing, startRefresh] = useTransition();
  const busy = state.kind === "saving" || refreshing;
  const dirty = useMemo(() => JSON.stringify(draft) !== saved, [draft, saved]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function edit(fn: (d: NotesDraft) => NotesDraft) {
    setDraft((d) => fn(d));
    if (state.kind === "saved" || (state.kind === "error" && !state.conflict)) setState({ kind: "idle" });
  }

  const editSection = (si: number, fn: (s: DraftSection) => DraftSection) =>
    edit((d) => ({ ...d, sections: d.sections.map((s, i) => (i === si ? fn(s) : s)) }));
  const editBlock = (si: number, bi: number, patch: Partial<DraftBlock>) =>
    editSection(si, (s) => ({ ...s, blocks: s.blocks.map((b, i) => (i === bi ? { ...b, ...patch } : b)) }));
  const newBlock = (): DraftBlock => ({ id: crypto.randomUUID(), kind: "paragraph", text: "", sourceRefs: [] });

  async function save() {
    setState({ kind: "saving" });
    let res: Response;
    try {
      res = await fetch(`/api/lectures/${lectureId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toNotesUpdate(draft, revision)),
      });
    } catch {
      setState({ kind: "error", message: "Couldn’t reach the server. Check your connection and try again." });
      return;
    }
    if (res.ok) {
      setSaved(JSON.stringify(draft));
      setState({ kind: "saved" });
      // Reload from the server so new rows get their real ids and the editor the new revision
      // (the page remounts this editor, keyed by revision). Editing is locked until then.
      startRefresh(() => router.refresh());
      return;
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    setState({
      kind: "error",
      conflict: res.status === 409,
      message: typeof body.error === "string" && res.status < 500 ? body.error : "Couldn’t save your notes. Please try again.",
    });
  }

  return (
    <div className="flex w-full flex-col gap-[22px]">
      <div className="sticky top-3 z-10 flex w-full flex-wrap items-center justify-between gap-3 rounded-[14px] bg-[#161730]/95 px-4 py-3 shadow-[0px_6px_24px_0px_rgba(0,0,0,0.25)] backdrop-blur">
        <div aria-live="polite" className="flex min-w-0 flex-wrap items-center gap-2 text-[13px]">
          {busy ? (
            <Pill>Saving…</Pill>
          ) : state.kind === "error" ? (
            <>
              <Pill tone="danger">Not saved</Pill>
              <span role="alert" className="text-[#ff5e7a]">
                {state.message}
              </span>
              {state.conflict ? (
                <button type="button" onClick={() => window.location.reload()} className="text-[#c1bedf] underline underline-offset-2 hover:text-white">
                  Reload
                </button>
              ) : null}
            </>
          ) : dirty ? (
            <Pill>Unsaved changes</Pill>
          ) : (
            <Pill tone="success">{state.kind === "saved" ? "Saved" : "All changes saved"}</Pill>
          )}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || busy}
          className="inline-flex h-10 items-center justify-center rounded-[10px] bg-[#ff5e7a] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#ff7891] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#ff5e7a]"
        >
          Save notes
        </button>
      </div>

      <fieldset disabled={busy} aria-label="Notes" className={cn(orbitCardClass, "m-0 min-w-0 border-0")}>
        <label className="flex flex-col gap-2">
          <span className="text-[11px] tracking-[0.5px] text-[#9496bf] uppercase">Title</span>
          <input
            value={draft.title}
            maxLength={200}
            onChange={(e) => edit((d) => ({ ...d, title: e.target.value }))}
            className={cn(fieldClass, "text-[20px] font-medium sm:text-[22px]")}
          />
        </label>

        {draft.sections.map((section, si) => (
          <div key={section.id} className="flex w-full flex-col gap-3 rounded-[14px] border border-[#333564] p-4 sm:p-5">
            <div className="flex items-center gap-2">
              <input
                aria-label={`Section ${si + 1} heading`}
                value={section.heading}
                placeholder="Section heading"
                onChange={(e) => editSection(si, (s) => ({ ...s, heading: e.target.value }))}
                className={cn(fieldClass, "min-w-0 flex-1 text-[16px] font-medium")}
              />
              <button type="button" aria-label={`Move section ${si + 1} up`} disabled={si === 0} onClick={() => edit((d) => ({ ...d, sections: move(d.sections, si, si - 1) }))} className={iconButtonClass}>
                <ArrowUp aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Move section ${si + 1} down`}
                disabled={si === draft.sections.length - 1}
                onClick={() => edit((d) => ({ ...d, sections: move(d.sections, si, si + 1) }))}
                className={iconButtonClass}
              >
                <ArrowDown aria-hidden className="size-4" />
              </button>
              <button
                type="button"
                aria-label={`Delete section ${si + 1}`}
                onClick={() => edit((d) => ({ ...d, sections: d.sections.filter((_, i) => i !== si) }))}
                className={iconButtonClass}
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </div>

            {section.blocks.map((block, bi) => (
              <div key={block.id} className="flex w-full flex-col gap-2 sm:flex-row sm:items-start">
                <select
                  aria-label={`Block ${bi + 1} type`}
                  value={block.kind}
                  onChange={(e) => editBlock(si, bi, { kind: e.target.value as Kind })}
                  className="h-10 shrink-0 rounded-[10px] bg-[#1e1f45] px-2.5 text-[12px] text-[#c1bedf] outline-none focus-visible:ring-2 focus-visible:ring-[#ff5e7a] sm:w-[150px]"
                >
                  {NOTE_BLOCK_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {KIND_LABELS[k]}
                    </option>
                  ))}
                </select>
                <textarea
                  aria-label={`Block ${bi + 1} text`}
                  value={block.text}
                  rows={1}
                  placeholder={block.kind === "equation" ? "e.g. E = mc^2" : "Write a note…"}
                  onChange={(e) => editBlock(si, bi, { text: e.target.value })}
                  className={cn(
                    fieldClass,
                    "min-h-10 flex-1 resize-none text-[14px] leading-[1.6] [field-sizing:content]",
                    block.kind === "equation" && "font-mono",
                  )}
                />
                <div className="flex shrink-0 items-center gap-0.5 self-end sm:self-start">
                  <button
                    type="button"
                    aria-label={`Move block ${bi + 1} up`}
                    disabled={bi === 0}
                    onClick={() => editSection(si, (s) => ({ ...s, blocks: move(s.blocks, bi, bi - 1) }))}
                    className={iconButtonClass}
                  >
                    <ArrowUp aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move block ${bi + 1} down`}
                    disabled={bi === section.blocks.length - 1}
                    onClick={() => editSection(si, (s) => ({ ...s, blocks: move(s.blocks, bi, bi + 1) }))}
                    className={iconButtonClass}
                  >
                    <ArrowDown aria-hidden className="size-4" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete block ${bi + 1}`}
                    onClick={() => editSection(si, (s) => ({ ...s, blocks: s.blocks.filter((_, i) => i !== bi) }))}
                    className={iconButtonClass}
                  >
                    <Trash2 aria-hidden className="size-4" />
                  </button>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => editSection(si, (s) => ({ ...s, blocks: [...s.blocks, newBlock()] }))}
              className="inline-flex items-center gap-1.5 self-start rounded-full px-2 py-1 text-[12px] text-[#c1bedf] transition-colors hover:text-white"
            >
              <Plus aria-hidden className="size-3.5" /> Add note
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() =>
            edit((d) => ({ ...d, sections: [...d.sections, { id: crypto.randomUUID(), heading: "", blocks: [newBlock()] }] }))
          }
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-dashed border-[#4a4c80] text-[13px] text-[#c1bedf] transition-colors hover:border-[#ff5e7a] hover:text-white"
        >
          <Plus aria-hidden className="size-4" /> Add section
        </button>
      </fieldset>
    </div>
  );
}
