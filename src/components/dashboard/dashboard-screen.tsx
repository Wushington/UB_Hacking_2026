import { ArrowUpRight, AudioLines, Check, ChevronRight, ImageIcon, Mic, NotebookTabs, Upload } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { STUDY_WORKFLOW } from "@/components/layout/workflow";
import type { DashboardView } from "@/lib/dashboard/view";
import { cn } from "@/lib/utils";

const card = "flex w-full flex-col rounded-[22px] bg-orbit-surface shadow-[0_6px_24px_rgb(0_0_0/0.19)]";
const quietCard = "flex w-full flex-col gap-3 rounded-[22px] bg-orbit-surface/60 p-5";
const sectionTitle = "text-[18px] font-medium tracking-[-0.3px] text-white";
const quietTitle = "text-[14px] font-medium text-orbit-text";
const description = "text-[13px] leading-[1.5] text-orbit-muted";
const textLink = "inline-flex min-h-10 items-center gap-1.5 self-start text-[13px] font-semibold text-orbit-accent-text transition-colors hover:text-white";
const buttonBase = "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-[13px] font-semibold whitespace-nowrap transition-colors";
/** Used once per dashboard: uploading notes is the page's one primary action. */
const primaryButton = cn(buttonBase, "bg-orbit-accent text-white hover:bg-orbit-accent-hover");
const secondaryButton = cn(buttonBase, "border border-orbit-line bg-orbit-raised text-orbit-text hover:border-orbit-accent/60 hover:text-white");

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Empty({ children }: { children: ReactNode }) {
  return <p className="w-full rounded-xl border border-dashed border-orbit-line px-4 py-4 text-center text-[13px] leading-[1.5] text-orbit-muted">{children}</p>;
}

/** Upload Notes → Generate Flashcards → Study → Review Weak Concepts, marked from the user's real progress. */
function Workflow({ view }: { view: DashboardView }) {
  const { notesSaved, decksGenerated, quizzesTaken } = view.stats;
  const done = [notesSaved > 0, decksGenerated > 0, quizzesTaken > 0, quizzesTaken > 0 && view.weakConceptCount === 0];
  const next = done.indexOf(false);

  return (
    <ol aria-label="Study workflow" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {STUDY_WORKFLOW.map(({ label }, i) => (
        <li
          key={label}
          aria-current={i === next ? "step" : undefined}
          className={cn(
            "flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px]",
            i === next ? "bg-orbit-accent-soft font-semibold text-white" : "bg-orbit-surface/60 text-orbit-muted",
          )}
        >
          <span aria-hidden className={cn("flex size-6 shrink-0 items-center justify-center rounded-full text-[12px]", i === next ? "bg-orbit-accent text-white" : "bg-orbit-raised")}>
            {done[i] ? <Check className="size-3.5" /> : i + 1}
          </span>
          {done[i] ? <span className="sr-only">Completed: </span> : null}
          <span className="min-w-0">{label}</span>
        </li>
      ))}
    </ol>
  );
}

function Capture() {
  return (
    <section
      aria-labelledby="capture-heading"
      className={cn(card, "gap-5 border border-orbit-accent/40 bg-linear-to-br from-orbit-accent-soft to-orbit-surface p-5 sm:p-7")}
    >
      <div className="flex flex-col gap-1.5">
        <h2 id="capture-heading" className="text-[24px] font-medium tracking-[-0.8px] text-white sm:text-[28px]">
          Capture Notes
        </h2>
        <p className="text-[14px] leading-[1.5] text-orbit-text">Upload whiteboard photos to create organized notes.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Link href="/capture" className={cn(primaryButton, "h-12 px-6 text-[14px]")}>
          <Upload aria-hidden className="size-[18px]" />
          Upload Photos
        </Link>
        <button
          type="button"
          disabled
          aria-label="Upload Lecture Audio (coming soon)"
          className={cn(buttonBase, "h-12 cursor-not-allowed gap-2.5 border border-orbit-line text-orbit-muted")}
        >
          <AudioLines aria-hidden className="size-[18px]" />
          Upload Lecture Audio
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase">Soon</span>
        </button>
      </div>
      <p className="text-[12px] text-orbit-muted">JPG, PNG or HEIC, up to 20 MB each.</p>
    </section>
  );
}

function RecentNotes({ view }: { view: DashboardView }) {
  return (
    <section aria-labelledby="notes-heading" className={cn(card, "gap-2 px-5 pt-5 pb-3 sm:px-7")}>
      <h2 id="notes-heading" className={sectionTitle}>
        Recent Notes
      </h2>
      {view.recentNotes.length === 0 ? (
        <div className="pb-2">
          <Empty>{view.signedIn ? "No notes yet. Your uploaded notes will appear here." : "Sign in to see your notes."}</Empty>
        </div>
      ) : (
        <ul className="flex flex-col">
          {view.recentNotes.map((note) => {
            const Icon = note.source === "Audio" ? AudioLines : note.source === "Handwritten" ? ImageIcon : NotebookTabs;
            return (
              <li key={note.id} className="border-b border-orbit-line last:border-b-0">
                <Link href={`/lectures/${note.id}`} className="group flex items-center gap-3 py-3">
                  <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-orbit-raised">
                    <Icon className="size-[18px] text-orbit-accent-text" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[14px] text-orbit-text group-hover:text-white">{note.title}</span>
                    <span className="truncate text-[12px] text-orbit-muted">{[note.className, note.source, note.dayLabel].filter(Boolean).join(" · ")}</span>
                  </span>
                  <ArrowUpRight aria-hidden className="size-[15px] shrink-0 text-orbit-muted transition-colors group-hover:text-orbit-accent-text" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function StudyFlashcards({ view }: { view: DashboardView }) {
  const latest = view.recentNotes[0];
  return (
    <section aria-labelledby="study-heading" className={cn(card, "gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-7")}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <h2 id="study-heading" className={sectionTitle}>
          Study Flashcards
        </h2>
        <p className={cn(description, "truncate")}>{latest ? latest.title : "Upload notes first, then generate flashcards."}</p>
      </div>
      {latest ? (
        <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-1">
          <Link href={`/lectures/${latest.id}/study`} className={secondaryButton}>
            {latest.hasFlashcards ? "Continue Studying" : "Generate Flashcards"}
          </Link>
          {view.stats.decksGenerated > 0 ? (
            <Link href="/quizzes" className={textLink}>
              View Flashcards
            </Link>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function WeakConcepts({ view }: { view: DashboardView }) {
  return (
    <section aria-labelledby="gaps-heading" className={cn(card, "gap-3 p-5")}>
      <div className="flex items-center justify-between gap-2">
        <h2 id="gaps-heading" className={sectionTitle}>
          Weak Concepts
        </h2>
        {view.weakConceptCount > 0 ? <span className="rounded-full bg-orbit-accent-soft px-2.5 py-1 text-[11px] text-orbit-accent-text">{view.weakConceptCount} to review</span> : null}
      </div>
      {view.weakConcepts.length === 0 ? (
        <Empty>No weak concepts yet. Cards you mark Missed will appear here.</Empty>
      ) : (
        <>
          <ul className="-mx-2 flex flex-col">
            {view.weakConcepts.map((concept) => (
              <li key={concept.id}>
                <Link href={`/explain?concept=${concept.id}`} className="group flex items-center gap-2.5 rounded-xl px-2 py-2.5 transition-colors hover:bg-orbit-raised">
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[14px] text-orbit-text">{concept.label}</span>
                    <span className="truncate text-[12px] text-orbit-muted">{concept.detail}</span>
                  </span>
                  <ChevronRight aria-hidden className="size-3.5 shrink-0 text-orbit-muted" />
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/weak-concepts" className={textLink}>
            Review Weak Concepts
          </Link>
        </>
      )}
    </section>
  );
}

function ExplainConcept({ view }: { view: DashboardView }) {
  const focus = view.weakConcepts[0];
  return (
    <section aria-labelledby="explain-heading" className={cn(card, "gap-3 p-5")}>
      <div className="flex flex-col gap-1">
        <h2 id="explain-heading" className={sectionTitle}>
          Explain a Concept
        </h2>
        <p className={description}>Record an explanation and get AI feedback.</p>
      </div>
      <Link href={focus ? `/explain?concept=${focus.id}` : "/explain"} className={cn(secondaryButton, "self-start")}>
        <Mic aria-hidden className="size-4" />
        Record Explanation
      </Link>
    </section>
  );
}

function StudyProgress({ view }: { view: DashboardView }) {
  const { stats } = view;
  const noActivity = stats.notesSaved === 0 && stats.quizzesTaken === 0;
  return (
    <section aria-labelledby="progress-heading" className={quietCard}>
      <h2 id="progress-heading" className={quietTitle}>
        Study Progress
      </h2>
      {noActivity ? (
        <p className={description}>Your statistics will appear after your first study session.</p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            {[
              { label: "Flashcard accuracy", value: stats.quizAccuracy === null ? null : `${stats.quizAccuracy}%` },
              { label: "Saved notes", value: String(stats.notesSaved) },
              { label: "Completed sessions", value: String(stats.quizzesTaken) },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col-reverse justify-end gap-1">
                <dt className="text-[11px] leading-[1.3] text-orbit-muted">{label}</dt>
                <dd className="text-[20px] font-medium tracking-[-0.5px] text-white">
                  {value ?? (
                    <>
                      <span aria-hidden className="text-white/40">
                        —
                      </span>
                      <span className="sr-only">No data</span>
                    </>
                  )}
                </dd>
              </div>
            ))}
          </dl>
          {stats.streakDays > 0 ? <p className="text-[12px] text-orbit-muted">{stats.streakDays}-day study streak</p> : null}
        </>
      )}
    </section>
  );
}

function Subjects({ classes }: { classes: DashboardView["classes"] }) {
  return (
    <section aria-labelledby="subjects-heading" className={quietCard}>
      <h2 id="subjects-heading" className={quietTitle}>
        My Subjects
      </h2>
      <ul className="flex flex-col gap-2">
        {classes.slice(0, 4).map((c) => (
          <li key={c.id} className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[13px] text-orbit-text">{c.name}</p>
            <p className="shrink-0 text-[12px] text-orbit-muted">{plural(c.noteCount, "note")}</p>
          </li>
        ))}
      </ul>
      <Link href="/subjects" className={textLink}>
        View All Subjects
      </Link>
    </section>
  );
}

export function DashboardScreen({ view, className }: { view: DashboardView; className?: string }) {
  const name = view.signedIn && view.firstName ? `, ${view.firstName}` : "";
  const greeting = view.stats.notesSaved > 0 ? "Welcome back" : "Welcome";

  return (
    <div className={cn("mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-5 px-4 pt-7 pb-9 sm:px-6 lg:px-10", className)}>
      <div className="flex flex-col gap-1.5 motion-safe:animate-rise">
        <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-1.3px] text-balance text-white sm:text-[32px]">
          {greeting}
          {name}.
        </h1>
        {view.signedIn ? null : <p className="text-[14px] text-orbit-muted">Sign in to capture notes and study flashcards.</p>}
      </div>

      <div className="motion-safe:animate-rise" style={{ animationDelay: "60ms" }}>
        <Workflow view={view} />
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5 motion-safe:animate-rise" style={{ animationDelay: "120ms" }}>
          <Capture />
          <RecentNotes view={view} />
          <StudyFlashcards view={view} />
        </div>
        <div className="flex flex-col gap-5 motion-safe:animate-rise" style={{ animationDelay: "180ms" }}>
          <WeakConcepts view={view} />
          <ExplainConcept view={view} />
          <StudyProgress view={view} />
          {view.classes.length > 0 ? <Subjects classes={view.classes} /> : null}
        </div>
      </div>
    </div>
  );
}
