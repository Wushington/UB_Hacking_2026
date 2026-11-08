import {
  ArrowUpRight,
  AudioLines,
  ChevronRight,
  Flame,
  ImageIcon,
  Mic,
  NotebookTabs,
  ScanLine,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import type { DashboardView } from "@/lib/dashboard/view";
import { cn } from "@/lib/utils";

/** Decorative bars either side of the mic (mirrors the design; no audio is captured here). */
const BARS = [7, 11, 18, 10, 23, 33, 19, 29, 15];
const soundBar = "w-[3px] rounded-[3px] bg-orbit-chip motion-safe:animate-sound-bar";

const card = "flex w-full flex-col rounded-[22px] bg-orbit-surface shadow-[0_6px_24px_rgb(0_0_0/0.19)]";
const eyebrow = "text-[10px] font-semibold tracking-[1.5px] text-orbit-muted uppercase";
const textLink =
  "inline-flex min-h-10 items-center gap-1.5 self-start text-[12px] font-semibold text-orbit-accent-text transition-colors hover:text-white";
const primaryButton =
  "inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-orbit-accent px-4 text-[13px] font-semibold whitespace-nowrap text-white transition-colors hover:bg-orbit-accent-hover";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="w-full rounded-xl border border-dashed border-orbit-line px-4 py-5 text-center text-[12px] leading-[1.6] text-orbit-muted">
      {children}
    </p>
  );
}

function SoonBadge() {
  return <span className="rounded-full bg-white/5 px-2 py-0.5 text-[9px] font-medium tracking-wide text-orbit-muted uppercase">Soon</span>;
}

function Overview({ view }: { view: DashboardView }) {
  const { stats, classes } = view;
  return (
    <section aria-labelledby="overview-heading" className="flex flex-col gap-7 xl:pt-1.5">
      <div className="flex flex-col gap-3">
        <h2 id="overview-heading" className={eyebrow}>
          Your orbit
        </h2>
        {stats.quizAccuracy === null ? (
          <>
            <p className="text-[56px] leading-[1.05] tracking-[-3px] text-white/30" aria-hidden>
              —
            </p>
            <p className="text-[13px] leading-[1.6] text-orbit-muted">No quizzes yet. Study a flashcard deck to see your accuracy.</p>
          </>
        ) : (
          <>
            <p className="text-[64px] leading-[1.05] tracking-[-4px] text-white xl:text-[70px]">{stats.quizAccuracy}%</p>
            <p className="text-[13px] text-orbit-muted">Flashcard quiz accuracy</p>
          </>
        )}
      </div>

      <dl className="flex justify-between gap-4 rounded-[22px] bg-orbit-raised p-[17px]">
        {[
          { label: "Notes saved", value: stats.notesSaved },
          { label: "Quizzes taken", value: stats.quizzesTaken },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col-reverse gap-1.5">
            <dt className="text-[10px] text-orbit-muted">{label}</dt>
            <dd className="text-[25px] font-medium tracking-[-0.7px] text-white">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3">
        <h2 className={eyebrow}>My subjects</h2>
        {classes.length === 0 ? (
          <Empty>Subjects you save notes to will appear here.</Empty>
        ) : (
          <ul className="flex flex-col gap-1">
            {classes.map((c) => (
              <li key={c.id} className="flex items-center gap-[11px] rounded-xl p-3 odd:bg-orbit-raised/60">
                <span aria-hidden className="flex h-[38px] w-[34px] shrink-0 items-center justify-center rounded-[10px] bg-orbit-chip text-[13px] font-semibold text-orbit-accent-text">
                  {c.name.trim().charAt(0).toUpperCase()}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="truncate text-[13px] font-semibold text-orbit-text">{c.name}</p>
                  <p className="text-[11px] text-orbit-muted">{plural(c.noteCount, "note")}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Link href="/subjects" className={textLink}>
          View all subjects <ChevronRight aria-hidden className="size-3.5" />
        </Link>
      </div>

      <div className="hidden flex-col gap-2 px-3 text-[12px] leading-[1.7] text-orbit-muted xl:flex">
        <Sparkles aria-hidden className="size-[18px] text-orbit-accent-text" />
        <p>Small sessions. Big connections. You’re building something good.</p>
      </div>
    </section>
  );
}

function CaptureOption({ label, formats, icon: Icon }: { label: string; formats: string; icon: LucideIcon }) {
  return (
    <button
      type="button"
      disabled
      aria-label={`${label} (coming soon)`}
      className="flex min-w-0 flex-1 cursor-not-allowed flex-col gap-[11px] rounded-xl border border-orbit-line bg-orbit-raised p-[17px] text-left"
    >
      <span className="flex w-full items-start justify-between">
        <Icon aria-hidden className="size-[22px] text-orbit-accent-text" />
        <SoonBadge />
      </span>
      <span className="flex flex-col gap-1.5">
        <span className="text-[14px] font-semibold text-orbit-text">{label}</span>
        <span className="text-[11px] text-orbit-muted">{formats}</span>
      </span>
    </button>
  );
}

function Capture() {
  return (
    <section aria-labelledby="capture-heading" className={cn(card, "gap-[19px] p-5 sm:p-[26px]")}>
      <p className={eyebrow}>01 / Capture</p>
      <div className="flex flex-col gap-2">
        <h2 id="capture-heading" className="text-[22px] font-medium tracking-[-0.8px] text-white sm:text-[25px]">
          Less transcribing. More understanding.
        </h2>
        <p className="text-[12px] leading-[1.65] text-orbit-muted">Turn a whiteboard photo or lecture audio into clear, organized notes.</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          href="/capture"
          className="flex min-w-0 flex-1 flex-col gap-[11px] rounded-xl border border-orbit-line bg-orbit-raised p-[17px] text-left transition-colors hover:border-orbit-accent/60"
        >
          <span className="flex w-full items-start justify-between">
            <ScanLine aria-hidden className="size-[22px] text-orbit-accent-text" />
            <ArrowUpRight aria-hidden className="size-4 text-orbit-muted" />
          </span>
          <span className="flex flex-col gap-1.5">
            <span className="text-[14px] font-semibold text-orbit-text">Upload whiteboard photo</span>
            <span className="text-[11px] text-orbit-muted">JPG, PNG or HEIC</span>
          </span>
        </Link>
        <CaptureOption label="Upload lecture audio" formats="MP3, M4A or WAV" icon={AudioLines} />
      </div>
      <p className="text-[11px] text-orbit-muted">You’ll choose which subject each upload is saved to. Lecture audio is coming soon.</p>
    </section>
  );
}

function RecentNotes({ view }: { view: DashboardView }) {
  return (
    <section aria-labelledby="notes-heading" className={cn(card, "gap-3 px-5 pt-6 pb-[18px] sm:px-[26px]")}>
      <p className={eyebrow}>02 / Your notes</p>
      <h2 id="notes-heading" className="text-[20px] font-medium tracking-[-0.5px] text-white">
        Pick up where you left off
      </h2>
      {view.recentNotes.length === 0 ? (
        <Empty>{view.signedIn ? "No notes yet. Upload your first lecture to get started." : "Sign in to see your notes."}</Empty>
      ) : (
        <ul className="flex flex-col">
          {view.recentNotes.map((note) => {
            const Icon = note.source === "Audio" ? AudioLines : note.source === "Whiteboard" ? ImageIcon : NotebookTabs;
            return (
              <li key={note.id} className="border-b border-orbit-line last:border-b-0">
                <Link href={`/lectures/${note.id}/study`} className="group flex items-center gap-[13px] py-[13px]">
                  <span aria-hidden className="flex h-[42px] w-[37px] shrink-0 items-center justify-center rounded-[10px] bg-orbit-raised">
                    <Icon className="size-[18px] text-orbit-accent-text" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="truncate text-[13px] text-orbit-text group-hover:text-white">{note.title}</span>
                    <span className="truncate text-[11px] text-orbit-muted">
                      {[note.className, note.source, note.dayLabel].filter(Boolean).join(" · ")}
                    </span>
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

function GenerateQuiz({ view }: { view: DashboardView }) {
  const latest = view.recentNotes[0];
  return (
    <section aria-labelledby="quiz-heading" className="flex w-full flex-col gap-4 rounded-[22px] bg-orbit-raised p-[22px] sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-col gap-[7px]">
        <p className={eyebrow}>03 / Test your understanding</p>
        <h2 id="quiz-heading" className="text-[17px] font-medium text-white">
          Turn your notes into a little challenge.
        </h2>
        <p className="truncate text-[11px] text-orbit-muted">
          {latest ? `${latest.title} · Flashcard deck` : "Save a note first, then generate a flashcard deck to study."}
        </p>
      </div>
      {latest ? (
        <Link href={`/lectures/${latest.id}/study`} className={primaryButton}>
          <Sparkles aria-hidden className="size-[18px]" />
          Generate quiz
        </Link>
      ) : null}
    </section>
  );
}

function WeakConcepts({ view }: { view: DashboardView }) {
  return (
    <section aria-labelledby="gaps-heading" className={cn(card, "gap-[17px] p-5 sm:p-6")}>
      <div className="flex items-center justify-between gap-2">
        <p className={eyebrow}>04 / Find the gaps</p>
        {view.weakConceptCount > 0 ? (
          <span className="rounded-full bg-orbit-accent-soft px-2 py-1 text-[10px] text-orbit-accent-text">{view.weakConceptCount} to revisit</span>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">
        <h2 id="gaps-heading" className="text-[21px] font-medium tracking-[-0.5px] text-white">
          A wrong answer is a starting point.
        </h2>
        <p className="text-[12px] leading-[1.65] text-orbit-muted">Concepts you miss land here automatically, so you know what to work on next.</p>
      </div>
      {view.weakConcepts.length === 0 ? (
        <Empty>Nothing to revisit yet. Missed questions and explanation feedback will appear here.</Empty>
      ) : (
        <ul className="flex flex-col gap-[3px]">
          {view.weakConcepts.map((concept, i) => (
            <li key={concept.id}>
              <Link href="/explain" className="group flex items-center gap-2.5 rounded-xl px-3 py-[13px] transition-colors hover:bg-orbit-raised">
                <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", i === 0 ? "bg-orbit-accent-text" : "bg-orbit-muted/60")} />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="truncate text-[13px] text-orbit-text">{concept.label}</span>
                  <span className="truncate text-[10px] text-orbit-muted">{concept.detail}</span>
                </span>
                <ChevronRight aria-hidden className="size-3.5 shrink-0 text-orbit-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href="/explain" className={textLink}>
        View weak concepts
        <ArrowUpRight aria-hidden className="size-3.5" />
      </Link>
    </section>
  );
}

function ExplainAloud({ view }: { view: DashboardView }) {
  const focus = view.weakConcepts[0]?.label;
  return (
    <section aria-labelledby="explain-heading" className="flex w-full flex-col gap-[18px] rounded-[22px] border border-white/5 bg-orbit-sunken p-5 sm:p-6">
      <p className={eyebrow}>05 / Say it. Understand it.</p>
      <div className="flex flex-col gap-2">
        <h2 id="explain-heading" className="text-[24px] tracking-[-0.7px] text-white">
          Make it click. Out loud.
        </h2>
        <p className="text-[12px] leading-[1.65] text-[#c1bedf]">Explain a concept in your own words. Get AI feedback on what’s missing.</p>
      </div>
      <div aria-hidden className="flex h-[52px] items-center justify-center gap-[5px]">
        {BARS.map((h, i) => (
          <span key={`l${i}`} className={soundBar} style={{ height: h, animationDelay: `${-i * 0.18}s` }} />
        ))}
        <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-orbit-accent motion-safe:animate-mic-pulse">
          <Mic className="size-[22px] text-white" />
        </span>
        {[...BARS].reverse().map((h, i) => (
          <span key={`r${i}`} className={soundBar} style={{ height: h, animationDelay: `${-(BARS.length - 1 - i) * 0.18}s` }} />
        ))}
      </div>
      <p className="truncate text-[11px] text-orbit-muted">{focus ? `Suggested: ${focus}` : "Pick any concept from your notes."}</p>
      <Link href="/explain" className={cn(primaryButton, "w-full")}>
        <Mic aria-hidden className="size-[18px]" />
        Explain this concept
      </Link>
      <p className="text-center text-[10px] text-orbit-muted">About 2 minutes · Private practice, no pressure</p>
    </section>
  );
}

export function DashboardScreen({ view, className }: { view: DashboardView; className?: string }) {
  const name = view.signedIn && view.firstName ? `, ${view.firstName}` : "";
  const streak = view.stats.streakDays;

  return (
    <div className={cn("mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-[30px] px-4 pt-8 pb-9 sm:px-6 lg:px-10 lg:pt-[38px] xl:px-14", className)}>
      <div className="flex flex-col gap-4 motion-safe:animate-rise sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-col gap-[9px]">
          <p className={eyebrow}>Your space to understand</p>
          <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-1.3px] text-balance text-white sm:text-[36px]">
            A little closer to your next aha{name}.
          </h1>
          <p className="text-[14px] text-orbit-muted">
            {view.signedIn ? "Capture your notes. Connect the dots. Make it stick." : "Sign in to capture your notes, track quizzes and find your gaps."}
          </p>
        </div>
        {streak > 0 ? (
          <p className="inline-flex shrink-0 items-center gap-2.5 self-start rounded-full bg-orbit-raised/60 px-[15px] py-[11px] text-[12px] font-medium text-orbit-text sm:self-auto">
            <Flame aria-hidden className="size-[18px] text-orbit-accent-text" />
            {streak}-day study streak
          </p>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-[248px_minmax(0,1fr)_384px]">
        <div className="flex flex-col gap-5 motion-safe:animate-rise md:col-span-2 xl:order-2 xl:col-span-1" style={{ animationDelay: "160ms" }}>
          <Capture />
          <RecentNotes view={view} />
          <GenerateQuiz view={view} />
        </div>
        <div className="motion-safe:animate-rise xl:order-1" style={{ animationDelay: "80ms" }}>
          <Overview view={view} />
        </div>
        <div className="flex flex-col gap-5 motion-safe:animate-rise xl:order-3" style={{ animationDelay: "240ms" }}>
          <WeakConcepts view={view} />
          <ExplainAloud view={view} />
        </div>
      </div>
    </div>
  );
}
