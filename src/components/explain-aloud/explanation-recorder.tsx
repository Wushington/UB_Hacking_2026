"use client";

import { LoaderCircle, Mic, RotateCcw, Square, Upload } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { MAX_RECORDING_MS } from "@/contracts/audio";
import { MAX_UPLOAD_BYTES } from "@/contracts/uploads";
import { baseAudioMimeType, formatClock, pickRecorderMimeType, type AudioMimeType } from "@/lib/recording";
import { cn } from "@/lib/utils";
import { uploadExplanation, UploadError } from "./upload-explanation";

export type LectureOption = { id: string; title: string };

/** "opening": uploaded; navigating to the new attempt (kept visible so the old attempt isn't mistaken for it). */
type Phase = "idle" | "setup" | "requesting" | "recording" | "recorded" | "uploading" | "opening";
type Take = { blob: Blob; url: string; mimeType: AudioMimeType; durationMs: number };

const MAX_MS = MAX_RECORDING_MS.explanation;
const LEVEL_BARS = 32;
const quietLevels = () => Array.from({ length: LEVEL_BARS }, () => 4);

const primaryButton =
  "flex h-[46px] items-center justify-center gap-[9px] rounded-[12px] bg-[#ff5e7a] px-[18px] text-[13px] leading-[1.5] font-semibold whitespace-nowrap text-white transition-colors hover:bg-[#ff7790] disabled:cursor-default disabled:opacity-50 disabled:hover:bg-[#ff5e7a]";
const secondaryButton =
  "flex h-[46px] items-center justify-center gap-2 rounded-[12px] bg-[#1e1f45] px-[18px] text-[13px] leading-[1.5] font-medium whitespace-nowrap text-[#e8e6ff] transition-colors hover:bg-[#2a2b5a] disabled:cursor-default disabled:opacity-50";

function micErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone access is blocked. Allow it in your browser’s site settings, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone was found.";
  if (name === "NotReadableError") return "Your microphone is in use by another app.";
  return "Couldn’t start recording. Please try again.";
}

/**
 * Records a spoken explanation (up to 2 minutes), lets the student review it, then uploads it
 * and opens the new attempt. Replaces the design's "Record another attempt" button.
 */
export function ExplanationRecorder({
  lectures,
  defaultLectureId,
  disabled,
  hasAttempt,
  backHref,
}: {
  lectures: LectureOption[];
  defaultLectureId: string | null;
  disabled: boolean;
  hasAttempt: boolean;
  backHref: string;
}) {
  const router = useRouter();
  const [navigating, startNavigation] = useTransition();
  const [rawPhase, setPhase] = useState<Phase>("idle");
  // Once the navigation transition settles, the new attempt is on screen: treat "opening" as idle.
  const phase: Phase = rawPhase === "opening" && !navigating ? "idle" : rawPhase;
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [levels, setLevels] = useState(quietLevels);
  const [take, setTake] = useState<Take | null>(null);
  const [lectureId, setLectureId] = useState<string>(
    defaultLectureId && lectures.some((l) => l.id === defaultLectureId) ? defaultLectureId : (lectures[0]?.id ?? ""),
  );

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const takeUrlRef = useRef<string | null>(null);
  /** Bumped by cancel/unmount so a late microphone grant doesn't start a recording nobody wants. */
  const attemptRef = useRef(0);

  const lecture = lectures.find((l) => l.id === lectureId) ?? null;
  const noClasses = lectures.length === 0;

  function stopMeters() {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (tickRef.current !== null) clearInterval(tickRef.current);
    tickRef.current = null;
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }

  function releaseMic() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function clearTake() {
    if (takeUrlRef.current) URL.revokeObjectURL(takeUrlRef.current);
    takeUrlRef.current = null;
    setTake(null);
  }

  useEffect(() => {
    const attempts = attemptRef;
    return () => {
      attempts.current++;
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      stopMeters();
      releaseMic();
      if (takeUrlRef.current) URL.revokeObjectURL(takeUrlRef.current);
    };
  }, []);

  function startLevelMeter(stream: MediaStream) {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    ctx.createMediaStreamSource(stream).connect(analyser);
    audioCtxRef.current = ctx;
    const samples = new Uint8Array(analyser.fftSize);
    let last = 0;
    const frame = (now: number) => {
      if (now - last > 80) {
        last = now;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (const s of samples) sum += ((s - 128) / 128) ** 2;
        const rms = Math.sqrt(sum / samples.length);
        const height = Math.round(4 + Math.min(1, rms * 4) * 38);
        setLevels((prev) => [...prev.slice(1), height]);
      }
      rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
  }

  async function startRecording() {
    setError(null);
    if (!lectureId) {
      setError("Choose a class first.");
      return;
    }
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Recording isn’t supported in this browser.");
      return;
    }
    const recorderType = pickRecorderMimeType((t) => MediaRecorder.isTypeSupported(t));
    const mimeType = baseAudioMimeType(recorderType);
    if (!recorderType || !mimeType) {
      setError("This browser can’t record in a supported audio format.");
      return;
    }

    clearTake();
    setPhase("requesting");
    const attempt = ++attemptRef.current;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      if (attempt !== attemptRef.current) return;
      setError(micErrorMessage(e));
      setPhase(lectures.length > 1 ? "setup" : "idle");
      return;
    }
    if (attempt !== attemptRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    streamRef.current = stream;

    const chunks: Blob[] = [];
    const recorder = new MediaRecorder(stream, { mimeType: recorderType });
    recorderRef.current = recorder;
    const startedAt = performance.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const durationMs = Math.min(performance.now() - startedAt, MAX_MS);
      stopMeters();
      releaseMic();
      recorderRef.current = null;
      const blob = new Blob(chunks, { type: mimeType });
      if (blob.size === 0) {
        setError("Nothing was recorded. Check your microphone and try again.");
        setPhase("idle");
        return;
      }
      if (blob.size > MAX_UPLOAD_BYTES.explanation_audio) {
        setError("That recording is too large to upload. Please try a shorter take.");
        setPhase("idle");
        return;
      }
      const url = URL.createObjectURL(blob);
      takeUrlRef.current = url;
      setTake({ blob, url, mimeType, durationMs });
      setPhase("recorded");
    };

    recorder.start(250);
    setElapsedMs(0);
    setLevels(quietLevels());
    setPhase("recording");
    startLevelMeter(stream);
    tickRef.current = setInterval(() => {
      const elapsed = performance.now() - startedAt;
      setElapsedMs(Math.min(elapsed, MAX_MS));
      if (elapsed >= MAX_MS && recorder.state === "recording") recorder.stop();
    }, 200);
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  function cancel() {
    attemptRef.current++;
    clearTake();
    setError(null);
    setPhase("idle");
  }

  async function submit() {
    if (!take || !lectureId) return;
    setError(null);
    setPhase("uploading");
    try {
      const id = await uploadExplanation({ blob: take.blob, mimeType: take.mimeType, lectureId, durationMs: take.durationMs });
      clearTake();
      // Stay in "opening" until the new attempt has rendered (see the effect below).
      setPhase("opening");
      startNavigation(() => {
        router.push(`/explain?recording=${id}`);
        router.refresh();
      });
    } catch (e) {
      setError(e instanceof UploadError ? e.message : "Couldn’t upload your recording. Please try again.");
      setPhase("recorded");
    }
  }

  function onRecordClick() {
    setError(null);
    // Ask which class only when it isn't obvious from the current attempt.
    if (lectures.length > 1 && !(defaultLectureId && lectures.some((l) => l.id === defaultLectureId))) {
      setPhase("setup");
    } else {
      void startRecording();
    }
  }

  const panelOpen = phase !== "idle";

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full flex-col-reverse items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Link href={backHref} className="text-[12px] leading-[1.5] text-[#ff5e7a] hover:underline">
          ← Back to weak concepts
        </Link>
        {!panelOpen ? (
          <button
            type="button"
            onClick={onRecordClick}
            disabled={disabled || noClasses}
            className={cn(primaryButton, "w-full sm:w-auto")}
          >
            <Image
              src="/figma/explain-aloud/mic.svg"
              alt=""
              width={18}
              height={18}
              style={{ width: 18, height: 18 }}
              className="block max-w-none"
            />
            {hasAttempt ? "Record another attempt" : "Record an explanation"}
          </button>
        ) : null}
      </div>

      {!panelOpen && noClasses && !disabled ? (
        <p className="text-[12px] leading-[1.5] text-[#9496bf] sm:text-right">
          Add a class first. Explanations are checked against that class’s notes.
        </p>
      ) : null}
      {!panelOpen && error ? (
        <p role="alert" className="text-[12px] leading-[1.5] text-[#ff5e7a] sm:text-right">
          {error}
        </p>
      ) : null}

      {panelOpen ? (
        <section
          aria-label="Record your explanation"
          className="flex w-full flex-col gap-4 rounded-[18px] bg-[#161730] p-5 shadow-[0px_6px_24px_0px_rgba(0,0,0,0.13)] sm:rounded-[22px] sm:p-7"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[17px] leading-[1.5] font-medium sm:text-[19px]">
              {phase === "recorded"
                ? "Review your explanation"
                : phase === "uploading"
                  ? "Uploading…"
                  : phase === "opening"
                    ? "Uploaded"
                    : "Explain it out loud"}
            </h2>
            <span className="text-[12px] leading-[1.5] text-[#9496bf]">Up to {formatClock(MAX_MS)}</span>
          </div>

          {phase === "setup" ? (
            <label className="flex flex-col gap-1.5 text-[12px] leading-[1.5] text-[#9496bf]">
              Which class is this for?
              <select
                value={lectureId}
                onChange={(e) => setLectureId(e.target.value)}
                className="h-[42px] rounded-[10px] border border-[#333564] bg-[#0d0e2a] px-3 text-[14px] text-white"
              >
                {lectures.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </label>
          ) : lecture ? (
            <p className="text-[12px] leading-[1.5] text-[#9496bf]">For {lecture.title}</p>
          ) : null}

          {phase === "requesting" ? (
            <p className="text-[13px] leading-[1.5] text-[#c1bedf]">Waiting for microphone permission…</p>
          ) : null}

          {phase === "opening" ? (
            <p role="status" className="flex items-center gap-2.5 text-[13px] leading-[1.5] text-[#c1bedf]">
              <LoaderCircle aria-hidden className="size-4 shrink-0 text-[#ff5e7a] motion-safe:animate-spin" />
              Opening your attempt…
            </p>
          ) : null}

          {phase === "recording" ? (
            <div className="flex w-full items-center gap-4">
              <span className="relative flex size-3 shrink-0" aria-hidden>
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#ff5e7a] opacity-60" />
                <span className="relative inline-flex size-3 rounded-full bg-[#ff5e7a]" />
              </span>
              <div className="flex h-[42px] min-w-0 flex-1 items-center gap-1 overflow-clip" aria-hidden>
                {levels.map((h, i) => (
                  <div key={i} className="w-[3px] shrink-0 rounded-[3px] bg-[#ff5e7a]" style={{ height: h }} />
                ))}
              </div>
              <p className="shrink-0 text-[12px] leading-[1.5] text-[#9496bf] tabular-nums" aria-live="off">
                <span className="sr-only">Recording, </span>
                {formatClock(elapsedMs)} / {formatClock(MAX_MS)}
              </p>
            </div>
          ) : null}

          {(phase === "recorded" || phase === "uploading") && take ? (
            <div className="flex flex-col gap-2">
              <audio controls src={take.url} className="w-full" aria-label="Your recorded explanation" />
              <p className="text-[11px] leading-[1.5] text-[#9496bf]">
                {formatClock(take.durationMs)} recorded · Only you can see this practice
              </p>
            </div>
          ) : null}

          {error ? (
            <p role="alert" className="text-[12px] leading-[1.5] text-[#ff5e7a]">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            {phase === "setup" ? (
              <>
                <button type="button" onClick={cancel} className={secondaryButton}>
                  Cancel
                </button>
                <button type="button" onClick={() => void startRecording()} className={primaryButton}>
                  <Mic aria-hidden className="size-[18px]" />
                  Start recording
                </button>
              </>
            ) : null}
            {phase === "requesting" ? (
              <button type="button" onClick={cancel} className={secondaryButton}>
                Cancel
              </button>
            ) : null}
            {phase === "recording" ? (
              <button type="button" onClick={stopRecording} className={primaryButton}>
                <Square aria-hidden className="size-4 fill-current" />
                Stop
              </button>
            ) : null}
            {phase === "recorded" || phase === "uploading" ? (
              <>
                <button type="button" onClick={cancel} disabled={phase === "uploading"} className={secondaryButton}>
                  Discard
                </button>
                <button
                  type="button"
                  onClick={() => void startRecording()}
                  disabled={phase === "uploading"}
                  className={secondaryButton}
                >
                  <RotateCcw aria-hidden className="size-4" />
                  Re-record
                </button>
                <button type="button" onClick={() => void submit()} disabled={phase === "uploading"} className={primaryButton}>
                  {phase === "uploading" ? (
                    <LoaderCircle aria-hidden className="size-[18px] animate-spin" />
                  ) : (
                    <Upload aria-hidden className="size-[18px]" />
                  )}
                  {phase === "uploading" ? "Uploading…" : "Submit for feedback"}
                </button>
              </>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
