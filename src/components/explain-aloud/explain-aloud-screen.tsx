"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AccountMenu } from "./account-menu";

const ASSETS = "/figma/explain-aloud";

export type ExplainAloudGap = { title: string; detail: string };

export type ExplainAloudData = {
  /** Course chip in the page introduction, e.g. "Cell Biology · BIO 201". */
  course: string;
  concept: {
    title: string;
    breadcrumb: string;
    prompt: string;
    attemptLabel: string;
  };
  recording: {
    /** Total length in seconds; used for the time label when no audio is loaded yet. */
    durationSeconds: number;
    audioSrc?: string;
    /** Bar heights in px (max 42). */
    waveform: number[];
    /** Fraction of bars shown as played before playback starts (0–1). */
    initialProgress?: number;
  };
  transcript: { text: string; footnote: string };
  feedback: {
    summary: string;
    covered: string[];
    gaps: ExplainAloudGap[];
    nextStep: { label: string; text: string; reviewLabel: string; reviewHref?: string; listStatus: string };
  };
};

export type ExplainAloudScreenProps = ExplainAloudData & {
  className?: string;
  backHref?: string;
  onRecordAgain?: () => void;
};

const NAV_ITEMS = [
  { label: "Home", href: "/" },
  { label: "My classes", href: "/classes" },
  { label: "Quizzes", href: "/quizzes" },
  { label: "Weak concepts", href: "/weak-concepts", active: true },
] as const;

const LEARNING_STEPS = ["Capture a class", "Organize notes", "Take a quiz", "Find the gaps", "Explain & improve"];

const cardClass =
  "flex w-full flex-col gap-5 overflow-clip rounded-[22px] bg-[#161730] p-7 shadow-[0px_6px_24px_0px_rgba(0,0,0,0.13)]";
const eyebrowClass = "text-[10px] font-semibold tracking-[1.5px] whitespace-nowrap text-[#9496bf]";

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function Pill({ tone = "neutral", children }: { tone?: "neutral" | "success"; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2.5 py-[5px] text-[11px] leading-[1.5] whitespace-nowrap",
        tone === "success" ? "bg-[#163d38] text-[#4ecba0]" : "bg-[#1e1f45] text-[#c1bedf]",
      )}
    >
      {children}
    </span>
  );
}

function Icon({ name, width, height, className }: { name: string; width: number; height: number; className?: string }) {
  return <Image src={`${ASSETS}/${name}.svg`} alt="" width={width} height={height} className={cn("block max-w-none", className)} />;
}

function RecordingPlayer({ recording }: { recording: ExplainAloudData["recording"] }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(recording.durationSeconds);
  const hasAudio = Boolean(recording.audioSrc);

  const progress =
    hasAudio && currentTime > 0 && duration > 0 ? currentTime / duration : (recording.initialProgress ?? 0);
  const playedBars = Math.round(progress * recording.waveform.length);

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
        disabled={!hasAudio}
        aria-label={playing ? "Pause recording" : "Play recording"}
        className="flex size-[42px] shrink-0 items-center justify-center rounded-full bg-[#1e1f45] transition-colors hover:bg-[#2a2b5a] disabled:cursor-default disabled:hover:bg-[#1e1f45]"
      >
        <Icon name="play" width={18} height={18} />
      </button>
      <div className="flex h-[42px] min-w-px flex-1 items-center gap-1 overflow-clip" aria-hidden>
        {recording.waveform.map((h, i) => (
          <div
            key={i}
            className={cn("w-[3px] shrink-0 rounded-[3px]", i < playedBars ? "bg-[#ff5e7a]" : "bg-[#333564]")}
            style={{ height: h }}
          />
        ))}
      </div>
      <p className="shrink-0 text-[12px] leading-[1.5] whitespace-nowrap text-[#9496bf]">
        {formatTime(currentTime)} / {formatTime(duration)}
      </p>
      {hasAudio ? (
        <audio
          ref={audioRef}
          src={recording.audioSrc}
          preload="metadata"
          className="hidden"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => {
            if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration);
          }}
        />
      ) : null}
    </div>
  );
}

export function ExplainAloudScreen({
  course,
  concept,
  recording,
  transcript,
  feedback,
  className,
  backHref = "/weak-concepts",
  onRecordAgain,
}: ExplainAloudScreenProps) {
  return (
    <div className={cn("relative isolate flex min-h-[1080px] w-full flex-col overflow-hidden bg-[#0d0e2a] text-white", className)}>
      {/* Decorative background layers */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-0 h-[1080px] w-full min-w-[1440px]">
          <Image src={`${ASSETS}/star-field.svg`} alt="" fill className="block max-w-none" />
        </div>
        <div className="absolute top-[760px] left-0 h-[440px] w-full min-w-[1440px] opacity-24">
          <Image src={`${ASSETS}/lunar-atmosphere.jpg`} alt="" fill sizes="100vw" className="object-cover" />
        </div>
        <div className="absolute top-[760px] left-0 h-[280px] w-full bg-gradient-to-b from-[#0d0e2a] to-[rgba(13,14,42,0)]" />
      </div>

      {/* Navigation */}
      <header className="flex h-20 w-full shrink-0 items-center justify-between border-b border-[rgba(42,43,80,0.25)] bg-[rgba(19,20,48,0.5)] px-14">
        <Link href="/" className="text-[23px] font-bold tracking-[-0.9px] whitespace-nowrap">
          Orbit Study
        </Link>
        <nav aria-label="Main" className="flex items-center gap-2">
          {NAV_ITEMS.map((item) => {
            const active = "active" in item && item.active;
            return (
              <Link
                key={item.label}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-full px-[17px] py-[11px] text-[13px] leading-[1.5] whitespace-nowrap transition-colors",
                  active ? "bg-[#ff5e7a] font-semibold text-white" : "text-[#9496bf] hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-[22px]">
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
      <div className="flex min-h-[906px] w-full flex-col gap-7 px-14 pt-9 pb-8">
        <div className="flex w-full items-center justify-between">
          <div className="flex flex-col gap-2">
            <p className={eyebrowClass}>05 / SAY IT. UNDERSTAND IT.</p>
            <h1 className="text-[36px] font-medium tracking-[-1.3px]">You’re making the connections.</h1>
            <p className="text-[14px] leading-[1.5] text-[#9496bf]">
              Your explanation is complete. Here’s what landed, and what to try next.
            </p>
          </div>
          <Pill>{course}</Pill>
        </div>

        <div className="flex w-full items-start gap-6">
          {/* Left column */}
          <div className="flex w-[636px] shrink-0 flex-col gap-[22px]">
            <section aria-label="Practice attempt" className={cardClass}>
              <div className="flex w-full items-start justify-between">
                <p className={eyebrowClass}>YOUR SELECTED CONCEPT</p>
                <Pill tone="success">{concept.attemptLabel}</Pill>
              </div>
              <div className="flex flex-col gap-2 leading-[1.5]">
                <h2 className="text-[26px] font-medium">{concept.title}</h2>
                <p className="text-[12px] text-[#9496bf]">{concept.breadcrumb}</p>
              </div>
              <p className="w-full text-[14px] leading-[1.5] text-[#c1bedf]">“{concept.prompt}”</p>
              <div className="h-px w-full bg-[#333564]" />
              <RecordingPlayer recording={recording} />
            </section>

            <section aria-label="Spoken response" className={cardClass}>
              <div className="flex w-full items-start justify-between">
                <h2 className="text-[19px] leading-[1.5] font-medium">In your own words</h2>
                <Pill>Transcript</Pill>
              </div>
              <p className="w-full text-[17px] leading-[1.85] text-[#c1bedf]">“{transcript.text}”</p>
              <p className="text-[11px] leading-[1.5] text-[#9496bf]">{transcript.footnote}</p>
            </section>

            <div className="flex w-full items-center justify-between">
              <Link href={backHref} className="text-[12px] leading-[1.5] text-[#ff5e7a] hover:underline">
                ← Back to weak concepts
              </Link>
              <button
                type="button"
                onClick={onRecordAgain}
                className="flex h-[46px] items-center justify-center gap-[9px] rounded-[12px] bg-[#ff5e7a] px-[18px] text-[13px] leading-[1.5] font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#ff7790]"
              >
                <Icon name="mic" width={18} height={18} />
                Record another attempt
              </button>
            </div>
          </div>

          {/* AI feedback */}
          <section aria-label="AI feedback" className={cn(cardClass, "min-w-px flex-1")}>
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Icon name="sparkles" width={22} height={22} />
                <h2 className="text-[21px] leading-[1.5] font-medium whitespace-nowrap">A little feedback from AI</h2>
              </div>
              <Pill tone="success">Analysis complete</Pill>
            </div>
            <p className="w-full text-[14px] leading-[1.5] text-[#c1bedf]">{feedback.summary}</p>

            <div className="flex w-full flex-col gap-3 rounded-[12px] bg-[#142b30] p-5">
              <div className="flex items-start gap-[9px]">
                <Icon name="circle-check" width={18} height={18} />
                <h3 className="text-[13px] leading-[1.5] font-semibold text-[#4ecba0]">What you covered</h3>
              </div>
              <ul className="flex flex-col gap-3">
                {feedback.covered.map((item) => (
                  <li key={item} className="text-[13px] leading-[1.5] whitespace-pre-wrap text-[#e8e6ff]">
                    {`✓  ${item}`}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex w-full flex-col gap-3.5 rounded-[12px] bg-[#281d35] p-5">
              <div className="flex items-start gap-[9px]">
                <Icon name="circle-dashed" width={18} height={18} />
                <h3 className="text-[13px] leading-[1.5] font-semibold text-[#ff5e7a]">What’s still missing</h3>
              </div>
              {feedback.gaps.map((gap) => (
                <div key={gap.title} className="flex w-full flex-col gap-[5px] text-[13px] leading-[1.5]">
                  <p className="font-medium text-white">{gap.title}</p>
                  <p className="text-[#c1bedf]">{gap.detail}</p>
                </div>
              ))}
            </div>

            <div className="flex w-full flex-col gap-2.5">
              <p className={eyebrowClass}>{feedback.nextStep.label}</p>
              <p className="text-[14px] leading-[1.5] text-white">{feedback.nextStep.text}</p>
              <div className="flex w-full items-start justify-between leading-[1.5] whitespace-nowrap">
                {feedback.nextStep.reviewHref ? (
                  <Link href={feedback.nextStep.reviewHref} className="text-[12px] text-[#ff5e7a] hover:underline">
                    {feedback.nextStep.reviewLabel} ↗
                  </Link>
                ) : (
                  <span className="text-[12px] text-[#ff5e7a]">{feedback.nextStep.reviewLabel} ↗</span>
                )}
                <p className="text-[11px] text-[#9496bf]">{feedback.nextStep.listStatus}</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Learning loop */}
      <div className="flex w-full px-14 pb-9">
        <nav
          aria-label="Learning loop"
          className="flex h-[58px] min-w-px flex-1 items-center justify-between rounded-[22px] bg-[rgba(19,20,48,0.69)] px-[22px]"
        >
          <p className={eyebrowClass}>IT ALL CONNECTS</p>
          {LEARNING_STEPS.map((step, i) => {
            const last = i === LEARNING_STEPS.length - 1;
            const label = `${String(i + 1).padStart(2, "0")}  /  ${step}`;
            return last ? (
              <p key={step} aria-current="step" className="text-[11px] leading-[1.5] font-semibold whitespace-pre text-[#ff5e7a]">
                {label}
              </p>
            ) : (
              <div key={step} className="flex items-center gap-2.5 leading-[1.5] text-[#9496bf]">
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
