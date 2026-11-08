"use client";

import { ChevronRight, FolderInput, GripVertical, ImageIcon, MoreHorizontal, Plus, SeparatorHorizontal } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type DragEvent, type ReactNode } from "react";
import type { Divider } from "@/contracts/dividers";
import { Menu } from "@/components/orbit/menu";
import { orbitCardClass, OrbitPageHeading, Pill, type PillTone } from "@/components/orbit/shell";
import { cn } from "@/lib/utils";
import { buildSubjectsLayout, type SubjectGroup, type SubjectInfo, type SubjectLecture } from "./subjects-layout";

export type { SubjectLecture } from "./subjects-layout";

const STATUS: Record<SubjectLecture["status"], { label: string; tone: PillTone }> = {
  ready: { label: "Notes ready", tone: "success" },
  processing: { label: "Organizing…", tone: "neutral" },
  draft: { label: "No notes yet", tone: "neutral" },
  failed: { label: "Needs another try", tone: "danger" },
};

const captureButton =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] bg-[#ff5e7a] px-5 text-[14px] font-semibold text-white transition-colors hover:bg-[#ff7891]";
const secondaryButton =
  "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-[10px] border border-[#ff5e7a]/60 px-4 text-[14px] font-semibold text-[#ff8da1] transition-colors hover:bg-[#281d35] hover:text-white";
const smallButton = "h-9 rounded-[10px] px-3.5 text-[13px] font-semibold transition-colors disabled:opacity-50";
const fieldClass =
  "h-9 min-w-0 flex-1 rounded-[10px] bg-[#1e1f45] px-3 text-[14px] text-white outline-none placeholder:text-[#6f71a0] focus-visible:ring-2 focus-visible:ring-[#ff5e7a]";

/** Drag payload type, so other drags (links, files) are ignored. */
const DRAG_TYPE = "application/x-orbit-subject";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

async function send(url: string, method: string, body?: unknown): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = "Couldn’t save that change. Please try again.";
    try {
      const data = (await res.json()) as { error?: unknown };
      if (typeof data.error === "string" && res.status < 500) message = data.error;
    } catch {}
    throw new Error(message);
  }
  return res;
}

// Stable defaults: a fresh `[]` per render would look like new server data on every render.
const NO_SUBJECTS: SubjectInfo[] = [];
const NO_DIVIDERS: Divider[] = [];

export function SubjectsScreen({
  lectures,
  subjects = NO_SUBJECTS,
  dividers = NO_DIVIDERS,
  signedIn,
}: {
  lectures: SubjectLecture[];
  subjects?: SubjectInfo[];
  dividers?: Divider[];
  signedIn: boolean;
}) {
  const router = useRouter();
  // Local copies so changes show immediately; replaced whenever the server sends fresh data.
  const [source, setSource] = useState({ subjects, dividers });
  const [subs, setSubs] = useState(subjects);
  const [divs, setDivs] = useState(dividers);
  if (source.subjects !== subjects || source.dividers !== dividers) {
    setSource({ subjects, dividers });
    setSubs(subjects);
    setDivs(dividers);
  }

  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const layout = buildSubjectsLayout(lectures, subs, divs);
  const nothing = !lectures.length && !subs.length && !divs.length;

  /** Applies a change locally, saves it, and undoes it (with a message) if saving fails. */
  async function change(apply: () => void, revert: () => void, save: () => Promise<unknown>) {
    setError(null);
    apply();
    try {
      await save();
      router.refresh();
    } catch (e) {
      revert();
      setError((e as Error).message);
    }
  }

  function moveSubject(subjectId: string, dividerId: string | null) {
    const before = subs;
    if (before.find((s) => s.id === subjectId)?.dividerId === dividerId) return;
    void change(
      () => setSubs(before.map((s) => (s.id === subjectId ? { ...s, dividerId } : s))),
      () => setSubs(before),
      () => send(`/api/subjects/${subjectId}`, "PATCH", { dividerId }),
    );
  }

  function updateDivider(id: string, next: Divider[], body: object) {
    const before = divs;
    void change(
      () => setDivs(next),
      () => setDivs(before),
      () => send(`/api/dividers/${id}`, "PATCH", body),
    );
  }

  function toggleDivider(d: Divider) {
    updateDivider(d.id, divs.map((x) => (x.id === d.id ? { ...x, collapsed: !x.collapsed } : x)), { collapsed: !d.collapsed });
  }

  function renameDivider(d: Divider, name: string) {
    updateDivider(d.id, divs.map((x) => (x.id === d.id ? { ...x, name } : x)), { name });
  }

  function moveDivider(d: Divider, move: "up" | "down") {
    const ordered = [...divs].sort((a, b) => a.position - b.position);
    const i = ordered.findIndex((x) => x.id === d.id);
    const j = move === "up" ? i - 1 : i + 1;
    if (j < 0 || j >= ordered.length) return;
    const swapped = ordered.map((x, k) =>
      k === i ? { ...x, position: ordered[j].position } : k === j ? { ...x, position: ordered[i].position } : x,
    );
    updateDivider(d.id, swapped, { move });
  }

  function deleteDivider(d: Divider) {
    const before = { subs, divs };
    void change(
      () => {
        setDivs(divs.filter((x) => x.id !== d.id));
        setSubs(subs.map((s) => (s.dividerId === d.id ? { ...s, dividerId: null } : s)));
      },
      () => {
        setDivs(before.divs);
        setSubs(before.subs);
      },
      () => send(`/api/dividers/${d.id}`, "DELETE"),
    );
  }

  async function addDivider(name: string) {
    setError(null);
    try {
      const res = await send("/api/dividers", "POST", { name });
      const created = (await res.json()) as Divider;
      setDivs((all) => [...all, created]);
      setAdding(false);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  /** Drop-target props: dropping a dragged subject here moves it to `dividerId` (null = above the dividers). */
  function dropZone(key: string, dividerId: string | null) {
    return {
      "data-drop-active": dragging && dropTarget === key ? "true" : undefined,
      onDragOver: (e: DragEvent) => {
        if (!dragging && !e.dataTransfer?.types?.includes(DRAG_TYPE)) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
        if (dropTarget !== key) setDropTarget(key);
      },
      onDragLeave: (e: DragEvent) => {
        if (!(e.currentTarget as Node).contains(e.relatedTarget as Node | null)) setDropTarget((t) => (t === key ? null : t));
      },
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        const id = e.dataTransfer?.getData(DRAG_TYPE) || dragging;
        setDropTarget(null);
        setDragging(null);
        if (id) moveSubject(id, dividerId);
      },
    };
  }

  const ordered = layout.dividers.map((d) => d.divider);
  const cardProps = (group: SubjectGroup) => ({
    group,
    dividers: ordered,
    dividerId: subs.find((s) => s.id === group.id)?.dividerId ?? null,
    onMove: (dividerId: string | null) => moveSubject(group.id, dividerId),
    onDragStart: () => setDragging(group.id),
    onDragEnd: () => {
      setDragging(null);
      setDropTarget(null);
    },
    dragging: dragging === group.id,
  });

  return (
    <>
      <OrbitPageHeading
        eyebrow="MY SUBJECTS"
        title="Everything you’ve captured."
        subtitle={
          signedIn
            ? "Open a set of notes to read it, change its subject, or turn it into flashcards. Group subjects with dividers."
            : "Sign in to see your subjects."
        }
        aside={
          signedIn ? (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setAdding(true)} disabled={adding} className={cn(secondaryButton, "disabled:opacity-50")}>
                <SeparatorHorizontal aria-hidden className="size-[18px]" />
                Add divider
              </button>
              <Link href="/capture" className={captureButton}>
                <Plus aria-hidden className="size-[18px]" />
                Capture notes
              </Link>
            </div>
          ) : null
        }
      />

      {error ? (
        <p role="alert" className="rounded-[12px] bg-[#281d35] px-4 py-3 text-[13px] text-[#ff8da1]">
          {error}
        </p>
      ) : null}

      {signedIn && nothing && !adding ? (
        <section className={orbitCardClass}>
          <p className="rounded-[12px] border border-dashed border-[#333564] px-5 py-8 text-center text-[14px] leading-[1.6] text-[#9496bf]">
            No subjects yet. Upload photos of your handwritten notes and they’ll show up here.
          </p>
        </section>
      ) : null}

      {/* Above the dividers: the "No subject" catch-all, then subjects that aren't under a divider. */}
      <div
        {...dropZone("top", null)}
        className={cn(
          "w-full rounded-[22px] transition-colors data-[drop-active=true]:bg-[#ff5e7a]/5 data-[drop-active=true]:outline-2 data-[drop-active=true]:outline-dashed data-[drop-active=true]:outline-[#ff5e7a]/60",
        )}
      >
        <CardGrid>
          {layout.noSubject.length ? <SubjectCard noSubject group={{ id: "", name: "No subject", lectures: layout.noSubject }} /> : null}
          {layout.ungrouped.map((group) => (
            <SubjectCard key={group.id} {...cardProps(group)} />
          ))}
        </CardGrid>
        {dragging && !layout.ungrouped.length && subs.find((s) => s.id === dragging)?.dividerId ? (
          <p className="rounded-[18px] border border-dashed border-[#4a4c80] px-5 py-5 text-center text-[13px] text-[#9496bf]">
            Drop here to take it out of its divider
          </p>
        ) : null}
      </div>

      {adding ? <AddDividerForm onAdd={addDivider} onCancel={() => setAdding(false)} /> : null}

      {layout.dividers.map(({ divider, subjects: grouped }, i) => (
        <DividerSection
          key={divider.id}
          divider={divider}
          count={grouped.length}
          first={i === 0}
          last={i === layout.dividers.length - 1}
          onToggle={() => toggleDivider(divider)}
          onRename={(name) => renameDivider(divider, name)}
          onMove={(dir) => moveDivider(divider, dir)}
          onDelete={() => deleteDivider(divider)}
          dropZone={dropZone(divider.id, divider.id)}
        >
          {grouped.length ? (
            <CardGrid>
              {grouped.map((group) => (
                <SubjectCard key={group.id} {...cardProps(group)} />
              ))}
            </CardGrid>
          ) : (
            <p className="rounded-[18px] border border-dashed border-[#333564] px-5 py-6 text-center text-[13px] text-[#9496bf]">
              Drag subjects here, or use a subject’s <span className="text-[#c1bedf]">Move to…</span> menu.
            </p>
          )}
        </DividerSection>
      ))}
    </>
  );
}

function CardGrid({ children }: { children: ReactNode }) {
  return <div className="grid w-full grid-cols-1 items-start gap-[22px] lg:grid-cols-2 lg:gap-6">{children}</div>;
}

function AddDividerForm({ onAdd, onCancel }: { onAdd: (name: string) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const inputId = useId();
  async function submit() {
    if (!name.trim() || busy) return;
    setBusy(true);
    await onAdd(name.trim());
    setBusy(false);
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex w-full flex-col gap-2 rounded-[18px] border border-dashed border-[#ff5e7a]/50 bg-[#161730] p-4 sm:flex-row sm:items-center"
    >
      <label htmlFor={inputId} className="shrink-0 text-[12px] tracking-[0.5px] text-[#9496bf] uppercase">
        New divider
      </label>
      <input
        id={inputId}
        autoFocus
        value={name}
        maxLength={60}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") onCancel();
        }}
        placeholder="e.g. Fall 2026"
        className={fieldClass}
      />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className={cn(smallButton, "text-[#c1bedf] hover:text-white")}>
          Cancel
        </button>
        <button type="submit" disabled={!name.trim() || busy} className={cn(smallButton, "bg-[#ff5e7a] text-white hover:bg-[#ff7891]")}>
          Add divider
        </button>
      </div>
    </form>
  );
}

function DividerSection({
  divider,
  count,
  first,
  last,
  onToggle,
  onRename,
  onMove,
  onDelete,
  dropZone,
  children,
}: {
  divider: Divider;
  count: number;
  first: boolean;
  last: boolean;
  onToggle: () => void;
  onRename: (name: string) => void;
  onMove: (dir: "up" | "down") => void;
  onDelete: () => void;
  dropZone: object;
  children: ReactNode;
}) {
  const bodyId = useId();
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(divider.name);
  const [confirming, setConfirming] = useState(false);

  return (
    <section
      aria-label={`${divider.name} divider`}
      {...dropZone}
      className="flex w-full flex-col gap-4 rounded-[22px] p-1 transition-colors data-[drop-active=true]:bg-[#ff5e7a]/5 data-[drop-active=true]:outline-2 data-[drop-active=true]:outline-dashed data-[drop-active=true]:outline-[#ff5e7a]/60"
    >
      <div className="flex w-full items-center gap-3 border-b border-[#333564] pb-2.5">
        {renaming ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              onRename(name.trim());
              setRenaming(false);
            }}
          >
            <label className="sr-only" htmlFor={`${bodyId}-name`}>
              Divider name
            </label>
            <input
              id={`${bodyId}-name`}
              autoFocus
              value={name}
              maxLength={60}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setName(divider.name);
                  setRenaming(false);
                }
              }}
              className={fieldClass}
            />
            <button type="submit" disabled={!name.trim()} className={cn(smallButton, "bg-[#ff5e7a] text-white hover:bg-[#ff7891]")}>
              Save
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={!divider.collapsed}
            aria-controls={bodyId}
            className="group flex min-w-0 flex-1 items-center gap-2.5 rounded-[10px] py-1 text-left focus-visible:ring-2 focus-visible:ring-[#ff5e7a] focus-visible:outline-none"
          >
            <ChevronRight
              aria-hidden
              className={cn("size-5 shrink-0 text-[#ff5e7a] transition-transform", !divider.collapsed && "rotate-90")}
            />
            <span className="truncate text-[18px] font-medium text-white sm:text-[20px]">{divider.name}</span>
            <span className="shrink-0 text-[12px] text-[#9496bf]">{plural(count, "subject")}</span>
          </button>
        )}
        <Menu
          label={`Divider options for ${divider.name}`}
          trigger={<MoreHorizontal aria-hidden className="size-5" />}
          items={[
            {
              label: "Rename",
              onSelect: () => {
                setName(divider.name);
                setRenaming(true);
              },
            },
            { label: "Move up", onSelect: () => onMove("up"), disabled: first },
            { label: "Move down", onSelect: () => onMove("down"), disabled: last },
            { label: "Delete divider", onSelect: () => setConfirming(true), danger: true },
          ]}
        />
      </div>

      {confirming ? (
        <div
          role="alertdialog"
          aria-label={`Delete the ${divider.name} divider?`}
          className="flex flex-col gap-3 rounded-[12px] bg-[#281d35] p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-[13px] leading-[1.6] text-[#e8e6ff]">
            Delete “{divider.name}”? Its subjects move back to the top. No subjects or notes are deleted.
          </p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={() => setConfirming(false)} className={cn(smallButton, "text-[#c1bedf] hover:text-white")}>
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setConfirming(false);
                onDelete();
              }}
              className={cn(smallButton, "bg-[#ff5e7a] text-white hover:bg-[#ff7891]")}
            >
              Delete
            </button>
          </div>
        </div>
      ) : null}

      <div id={bodyId} hidden={divider.collapsed}>
        {children}
      </div>
    </section>
  );
}

function SubjectCard({
  group,
  noSubject = false,
  dividers = [],
  dividerId = null,
  onMove,
  onDragStart,
  onDragEnd,
  dragging = false,
}: {
  group: SubjectGroup;
  noSubject?: boolean;
  dividers?: Divider[];
  dividerId?: string | null;
  onMove?: (dividerId: string | null) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  dragging?: boolean;
}) {
  const movable = !noSubject && onMove;
  return (
    <section
      aria-label={group.name}
      draggable={movable ? true : undefined}
      onDragStart={
        movable
          ? (e) => {
              e.dataTransfer?.setData(DRAG_TYPE, group.id);
              if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
              onDragStart?.();
            }
          : undefined
      }
      onDragEnd={movable ? onDragEnd : undefined}
      // overflow-visible: the "Move to…" menu must be able to extend past the card.
      className={cn(orbitCardClass, "overflow-visible", movable && "cursor-grab active:cursor-grabbing", dragging && "opacity-40")}
    >
      <div className="flex w-full items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          {movable ? <GripVertical aria-hidden className="-mr-1.5 -ml-2 size-4 shrink-0 text-[#4a4c80]" /> : null}
          <span
            aria-hidden
            className="flex h-[38px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#2a2b5a] text-[13px] font-semibold text-[#ff5e7a]"
          >
            {noSubject ? "?" : group.name.trim().charAt(0).toUpperCase()}
          </span>
          <h2 className="truncate text-[19px] font-medium">{group.name}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Pill>{plural(group.lectures.length, "note set")}</Pill>
          {movable ? (
            <Menu
              label={`Move ${group.name} to a divider`}
              heading="Move to…"
              trigger={<FolderInput aria-hidden className="size-[18px]" />}
              items={[
                { label: "No divider (top)", checked: dividerId === null, onSelect: () => onMove(null) },
                ...dividers.map((d) => ({ label: d.name, checked: dividerId === d.id, onSelect: () => onMove(d.id) })),
              ]}
            />
          ) : null}
        </div>
      </div>

      {group.lectures.length ? (
        <ul className="flex w-full flex-col gap-1">
          {group.lectures.map((lecture) => {
            const status = STATUS[lecture.status];
            return (
              <li key={lecture.id} className="flex items-center gap-2 rounded-[12px] odd:bg-[#1e1f45]/60">
                <Link
                  href={`/lectures/${lecture.id}`}
                  draggable={false}
                  className="group flex min-w-0 flex-1 items-center gap-3 rounded-[12px] p-3 transition-colors hover:bg-[#1e1f45]"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#1e1f45]">
                    <ImageIcon aria-hidden className="size-4 text-[#ff5e7a]" strokeWidth={1.75} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[14px] text-white">{lecture.title}</span>
                    <span className="text-[11px] text-[#9496bf]">Updated {formatDate(lecture.updatedAt)}</span>
                  </span>
                  <Pill tone={status.tone}>{status.label}</Pill>
                  <ChevronRight aria-hidden className="size-4 shrink-0 text-[#9496bf] group-hover:text-white" />
                </Link>
                {lecture.status === "ready" ? (
                  <Link
                    href={`/lectures/${lecture.id}/study`}
                    draggable={false}
                    className="mr-2 hidden shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold text-[#ff5e7a] transition-colors hover:bg-[#281d35] sm:inline-flex"
                  >
                    Flashcards
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[13px] text-[#9496bf]">No notes in this subject yet.</p>
      )}
    </section>
  );
}
