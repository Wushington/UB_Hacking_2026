"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { feedbackSpeechText, type ExplainAloudState, type ExplainAloudView } from "@/lib/explain-aloud/view";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./account-menu";
import { ExplanationRecorder, type LectureOption } from "./explanation-recorder";
import { GradingWatcher, RetryGradingButton } from "./grading-status";
import { ListenButton } from "./listen-button";

const ASSETS = "/figma/explain-aloud";

export type ExplainAloudScreenProps = {
  view: ExplainAloudView;
  /** The user's classes, for choosing which one a new explanation belongs to. */
  lectures?: LectureOption[];
  className?: string;
  backHref?: string;
};

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "My classes", href: "/classes" },
  { label: "Quizzes", href: "/quizzes" },
  { label: "Weak concepts", href: "/weak-concepts", active: true },
] as const;

const LEARNING_STEPS = ["Capture a class", "Organize notes", "Take a quiz", "Find the gaps", "Explain & improve"];

/** Decorative waveform shape (no amplitude data is stored); playback colors it. */
const WAVEFORM = [
  8, 14, 22, 12, 30, 20, 36, 27, 16, 24, 34, 18, 28, 12, 20, 31, 40, 26, 14, 22, 30, 16, 10, 24, 34, 20, 14, 26, 18, 10, 15,
  8,
];

const INTRO: Record<ExplainAloudState, { heading: string; body: string }> = {
  ready: {
    heading: "You’re making the connections.",
    body: "Your explanation is complete. Here’s what landed, and what to try next.",
  },
  "no-feedback": {
    heading: "Your explanation is saved.",
    body: "Feedback isn’t available for this attempt yet.",
  },
  processing: {
    heading: "Listening back to your explanation.",
    body: "Your transcript and feedback will appear here once analysis finishes.",
  },
  failed: {
    heading: "We couldn’t analyze that attempt.",
    body: "Try recording your explanation again.",
  },
  empty: {
    heading: "Explain a concept out loud.",
    body: "Record an explanation to see what landed and what to try next.",
  },
  "signed-out": {
    heading: "Explain a concept out loud.",
    body: "Sign in to see your explanations and feedback.",
  },
  loading: { heading: "Loading your explanation…", body: "Just a moment." },
};

const EMPTY_COPY: Record<"concept" | "transcript", Partial<Record<ExplainAloudState, string>> & { default: string }> = {
  concept: {
    "signed-out": "Sign in to see the concept you practiced.",
    loading: "Loading…",
    default: "No explanation recorded yet. Pick a weak concept and explain it in your own words.",
  },
  transcript: {
    "signed-out": "Sign in to see your transcript.",
    loading: "Loading…",
    processing: "Your transcript will appear here after your explanation is processed.",
    failed: "No transcript. This attempt couldn’t be processed.",
    default: "Your words will appear here after you record an explanation.",
  },
};

function copyFor(section: keyof typeof EMPTY_COPY, state: ExplainAloudState) {
  return EMPTY_COPY[section][state] ?? EMPTY_COPY[section].default;
}

const cardClass =
  "flex w-full min-w-0 flex-col gap-5 overflow-clip rounded-[18px] bg-[#161730] p-5 shadow-[0px_6px_24px_0px_rgba(0,0,0,0.13)] sm:rounded-[22px] sm:p-7";
/** Page gutters: 16px on phones up to the design's 56px at xl. */
const gutterClass = "px-4 sm:px-6 lg:px-10 xl:px-14";
const eyebrowClass = "text-[10px] font-semibold tracking-[1.5px] whitespace-nowrap text-[#9496bf]";

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type PillTone = "neutral" | "success" | "danger";

function Pill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2.5 py-[5px] text-[11px] leading-[1.5] whitespace-nowrap",
        tone === "success" && "bg-[#163d38] text-[#4ecba0]",
        tone === "danger" && "bg-[#281d35] text-[#ff5e7a]",
        tone === "neutral" && "bg-[#1e1f45] text-[#c1bedf]",
      )}
    >
      {children}
    </span>
  );
}

/** Empty-section placeholder that sits inside the dark cards. */
function Placeholder({ children, bordered = true }: { children: ReactNode; bordered?: boolean }) {
  return (
    <p
      data-placeholder
      className={cn(
        "w-full text-[13px] leading-[1.5] text-[#9496bf]",
        bordered && "rounded-[12px] border border-dashed border-[#333564] px-5 py-6 text-center",
      )}
    >
      {children}
    </p>
  );
}

function Icon({ name, width, height, className }: { name: string; width: number; height: number; className?: string }) {
  // A wrapper sized exactly to the asset with `fill` inside: Next/Image compares the browser's
  // rounded pixel size with a fractional width/height attribute (e.g. 13.5) and falsely warns
  // "width or height modified". Fill mode keeps the geometry identical without that check.
  return (
    <span aria-hidden className={cn("relative block shrink-0", className)} style={{ width, height }}>
      <Image src={`${ASSETS}/${name}.svg`} alt="" fill sizes={`${Math.ceil(width)}px`} className="block max-w-none" />
    </span>
  );
}

function attemptTone(state: ExplainAloudState): PillTone {
  if (state === "failed") return "danger";
  if (state === "processing") return "neutral";
  return "success";
}

function RecordingPlayer({ recording }: { recording: NonNullable<ExplainAloudView["recording"]> | null }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [loadedDuration, setLoadedDuration] = useState<number | null>(null);
  const audioSrc = recording?.audioSrc ?? null;
  const duration = loadedDuration ?? recording?.durationSeconds ?? null;

  const progress = duration && duration > 0 ? currentTime / duration : 0;
  const playedBars = Math.round(progress * WAVEFORM.length);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  return (
    <div className="flex w-full items-center gap-4">
      <button
        type="button"
        onClick={toggle}
        disabled={!audioSrc}
        aria-label={playing ? "Pause recording" : "Play recording"}
        title={audioSrc ? undefined : "Recording unavailable"}
        className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-[#1e1f45] transition-colors hover:bg-[#2a2b5a] disabled:cursor-default disabled:opacity-50 disabled:hover:bg-[#1e1f45]"
      >
        <Icon name="play" width={18} height={18} />
      </button>
      <div className="flex h-[42px] min-w-0 flex-1 items-center gap-1 overflow-clip" aria-hidden>
        {WAVEFORM.map((h, i) => (
          <div
            key={i}
            className={cn("w-[3px] shrink-0 rounded-[3px]", i < playedBars ? "bg-[#ff5e7a]" : "bg-[#333564]")}
            style={{ height: h }}
          />
        ))}
      </div>
      <p className="shrink-0 text-[12px] leading-[1.5] whitespace-nowrap text-[#9496bf]">
        {formatTime(currentTime)} / {duration != null ? formatTime(duration) : "–:–"}
      </p>
      {audioSrc ? (
        <audio
          ref={audioRef}
          src={audioSrc}
          preload="metadata"
          className="hidden"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            if (Number.isFinite(e.currentTarget.duration)) setLoadedDuration(e.currentTarget.duration);
          }}
        />
      ) : null}
    </div>
  );
}

function FeedbackStatus({ state }: { state: ExplainAloudState }) {
  if (state === "ready") return <Pill tone="success">Analysis complete</Pill>;
  if (state === "processing") return <Pill>Analyzing…</Pill>;
  if (state === "failed") return <Pill tone="danger">Analysis failed</Pill>;
  return null;
}

export function ExplainAloudScreen({ view, lectures = [], className, backHref = "/weak-concepts" }: ExplainAloudScreenProps) {
  const { state, course, concept, recording, transcript, recordedLabel, feedback } = view;
  const intro = INTRO[state];
  const hasAttempt = concept !== null;
  const gaps = feedback?.gaps ?? [];
  const covered = feedback?.covered ?? [];
  const listenRecordingId = feedbackSpeechText(view) !== null ? view.recordingId : null;

  return (
    <div className={cn("relative isolate flex min-h-dvh w-full flex-col overflow-hidden bg-[#0d0e2a] text-white", className)}>
      {/* Decorative background layers (bottom-anchored so they stay at the foot of taller mobile pages) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-0 h-[1080px] w-full min-w-[1440px]">
          <Image src={`${ASSETS}/star-field.svg`} alt="" fill className="block max-w-none" />
        </div>
        <div className="absolute bottom-[-120px] left-0 h-[440px] w-full min-w-[1440px] opacity-24">
          <Image src={`${ASSETS}/lunar-atmosphere.jpg`} alt="" fill sizes="100vw" loading="eager" className="object-cover" />
        </div>
        <div className="absolute bottom-[40px] left-0 h-[280px] w-full bg-gradient-to-b from-[#0d0e2a] to-[rgba(13,14,42,0)]" />
      </div>

      {/* Navigation */}
      <header
        className={cn(
          "flex w-full shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[rgba(42,43,80,0.25)] bg-[rgba(19,20,48,0.5)] py-3 lg:h-20 lg:flex-nowrap lg:py-0",
          gutterClass,
        )}
      >
        <Link href="/" className="text-[20px] font-bold tracking-[-0.9px] whitespace-nowrap sm:text-[23px]">
          Orbit Study
        </Link>
        <nav
          aria-label="Main"
          className="-mx-1 order-last flex w-full items-center gap-2 overflow-x-auto px-1 lg:order-none lg:mx-0 lg:w-auto lg:overflow-visible lg:px-0"
        >
          {NAV_ITEMS.map((item) => {
            const active = "active" in item && item.active;
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-[14px] py-[8px] text-[13px] leading-[1.5] whitespace-nowrap transition-colors lg:px-[17px] lg:py-[11px]",
                  active ? "bg-[#ff5e7a] font-semibold text-white" : "text-[#9496bf] hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-4 lg:gap-[22px]">
          <button type="button" aria-label="Search" className="relative size-[18px] shrink-0">
            <Icon name="search" width={16} height={16} className="absolute top-0 left-0" />
          </button>
          <button type="button" aria-label="Notifications" className="relative size-[18px] shrink-0">
            <Icon name="notifications" width={18} height={13.5} className="absolute top-0 left-0" />
          </button>
          <AccountMenu />
        </div>
      </header>

      {/* Workspace */}
      <div
        className={cn("flex w-full flex-1 flex-col gap-6 pt-7 pb-8 sm:gap-7 sm:pt-9", gutterClass)}
        aria-busy={state === "loading"}
      >
        <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="flex min-w-0 flex-col gap-2">
            <p className={eyebrowClass}>05 / SAY IT. UNDERSTAND IT.</p>
            <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-1.3px] text-balance sm:text-[32px] lg:text-[36px]">
              {intro.heading}
            </h1>
            <p className="text-[14px] leading-[1.5] text-pretty text-[#9496bf]">{intro.body}</p>
          </div>
          {course ? <Pill>{course}</Pill> : null}
        </div>

        <div className="grid w-full grid-cols-1 items-start gap-[22px] lg:grid-cols-[minmax(0,636fr)_minmax(0,668fr)] lg:gap-6">
          {/* Left column */}
          <div className="flex w-full min-w-0 flex-col gap-[22px]">
            <section aria-label="Practice attempt" className={cardClass}>
              <div className="flex w-full flex-wrap items-start justify-between gap-2">
                <p className={eyebrowClass}>YOUR SELECTED CONCEPT</p>
                {concept?.attemptLabel ? <Pill tone={attemptTone(state)}>{concept.attemptLabel}</Pill> : null}
              </div>
              {concept ? (
                <>
                  <div className="flex flex-col gap-2 leading-[1.5]">
                    <h2 className="text-[22px] font-medium break-words sm:text-[26px]">{concept.title}</h2>
                    {concept.breadcrumb ? <p className="text-[12px] text-[#9496bf]">{concept.breadcrumb}</p> : null}
                  </div>
                  {concept.prompt ? (
                    <p className="w-full text-[14px] leading-[1.5] text-[#c1bedf]">“{concept.prompt}”</p>
                  ) : (
                    <Placeholder bordered={false}>No question prompt saved for this attempt.</Placeholder>
                  )}
                  <div className="h-px w-full bg-[#333564]" />
                  <RecordingPlayer recording={recording} />
                </>
              ) : (
                <Placeholder>{copyFor("concept", state)}</Placeholder>
              )}
            </section>

            <section aria-label="Spoken response" className={cardClass}>
              <div className="flex w-full flex-wrap items-start justify-between gap-2">
                <h2 className="text-[17px] leading-[1.5] font-medium sm:text-[19px]">In your own words</h2>
                <Pill>Transcript</Pill>
              </div>
              {transcript ? (
                <p className="w-full text-[15px] leading-[1.85] break-words text-[#c1bedf] sm:text-[17px]">“{transcript}”</p>
              ) : (
                <Placeholder>{copyFor("transcript", state)}</Placeholder>
              )}
              {recordedLabel ? (
                <p className="text-[11px] leading-[1.5] text-[#9496bf]">
                  Recorded {recordedLabel} · Only you can see this practice
                </p>
              ) : null}
            </section>

            <ExplanationRecorder
              lectures={lectures}
              defaultLectureId={view.lectureId}
              disabled={state === "signed-out" || state === "loading"}
              hasAttempt={hasAttempt}
              backHref={backHref}
            />
          </div>

          {/* AI feedback */}
          <section aria-label="AI feedback" className={cardClass}>
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Icon name="sparkles" width={22} height={22} />
                <h2 className="text-[18px] leading-[1.5] font-medium sm:text-[21px]">A little feedback from AI</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {listenRecordingId ? <ListenButton recordingId={listenRecordingId} /> : null}
                {state === "failed" && view.recordingId ? <RetryGradingButton recordingId={view.recordingId} /> : null}
                <FeedbackStatus state={state} />
              </div>
            </div>
            {state === "processing" && view.recordingId ? <GradingWatcher recordingId={view.recordingId} /> : null}
            {feedback?.summary ? (
              <p className="w-full text-[14px] leading-[1.5] text-[#c1bedf]">{feedback.summary}</p>
            ) : null}

            <div className="flex w-full flex-col gap-3 rounded-[12px] bg-[#142b30] p-5">
              <div className="flex items-start gap-[9px]">
                <Icon name="circle-check" width={18} height={18} />
                <h3 className="text-[13px] leading-[1.5] font-semibold text-[#4ecba0]">What you covered</h3>
              </div>
              {covered.length > 0 ? (
                <ul className="flex flex-col gap-3">
                  {covered.map((item) => (
                    <li key={item} className="text-[13px] leading-[1.5] whitespace-pre-wrap text-[#e8e6ff]">
                      {`✓  ${item}`}
                    </li>
                  ))}
                </ul>
              ) : (
                <Placeholder bordered={false}>
                  {feedback?.summary
                    ? "No ideas from the notes came through clearly yet. Try the step below."
                    : "Ideas you explained well will show up here."}
                </Placeholder>
              )}
            </div>

            <div className="flex w-full flex-col gap-3.5 rounded-[12px] bg-[#281d35] p-5">
              <div className="flex items-start gap-[9px]">
                <Icon name="circle-dashed" width={18} height={18} />
                <h3 className="text-[13px] leading-[1.5] font-semibold text-[#ff5e7a]">What’s still missing</h3>
              </div>
              {gaps.length > 0 ? (
                gaps.map((gap) => (
                  <div key={gap.title} className="flex w-full flex-col gap-[5px] text-[13px] leading-[1.5]">
                    <p className="font-medium text-white">{gap.title}</p>
                    <p className="text-[#c1bedf]">{gap.detail}</p>
                  </div>
                ))
              ) : (
                <Placeholder bordered={false}>
                  {feedback ? "No gaps found in this explanation. Nice work." : "Gaps in your explanation will show up here."}
                </Placeholder>
              )}
            </div>

            <div className="flex w-full flex-col gap-2.5">
              <p className={eyebrowClass}>TRY THIS NEXT{feedback?.nextStep ? " · 45–60 SECONDS" : ""}</p>
              {feedback?.nextStep ? (
                <p className="text-[14px] leading-[1.5] text-white">{feedback.nextStep}</p>
              ) : (
                <Placeholder bordered={false}>A suggested next attempt will appear here.</Placeholder>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Learning loop */}
      <div className={cn("flex w-full pb-6 sm:pb-9", gutterClass)}>
        <nav
          aria-label="Learning loop"
          className="flex min-w-0 flex-1 items-center gap-6 overflow-x-auto rounded-[18px] bg-[rgba(19,20,48,0.69)] px-[22px] py-4 sm:rounded-[22px] xl:h-[58px] xl:justify-between xl:py-0"
        >
          <p className={cn(eyebrowClass, "shrink-0")}>IT ALL CONNECTS</p>
          {LEARNING_STEPS.map((step, i) => {
            const last = i === LEARNING_STEPS.length - 1;
            const label = `${String(i + 1).padStart(2, "0")}  /  ${step}`;
            return last ? (
              <p key={step} aria-current="step" className="shrink-0 text-[11px] leading-[1.5] font-semibold whitespace-pre text-[#ff5e7a]">
                {label}
              </p>
            ) : (
              <div key={step} className="flex shrink-0 items-center gap-2.5 leading-[1.5] text-[#9496bf]">
                <p className="text-[11px] whitespace-pre">{label}</p>
                <span aria-hidden className="text-[14px]">
                  →
                </span>
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
