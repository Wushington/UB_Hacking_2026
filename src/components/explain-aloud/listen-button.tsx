"use client";

import { LoaderCircle, Pause, RotateCcw, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Status = "idle" | "loading" | "playing" | "paused" | "error";

const LABELS: Record<Status, string> = {
  idle: "Listen",
  loading: "Loading…",
  playing: "Pause",
  paused: "Resume",
  error: "Audio unavailable",
};

/**
 * Plays the AI feedback read aloud (ElevenLabs, via /api/explanations/[id]/feedback-audio).
 * The audio element is created on first click, so speech is only generated when asked for.
 */
export function ListenButton({ recordingId }: { recordingId: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  function createAudio() {
    const audio = new Audio(`/api/explanations/${encodeURIComponent(recordingId)}/feedback-audio`);
    audio.preload = "auto";
    audio.addEventListener("playing", () => setStatus("playing"));
    audio.addEventListener("pause", () => {
      if (!audio.ended) setStatus("paused");
    });
    audio.addEventListener("ended", () => {
      audio.currentTime = 0;
      setStatus("idle");
    });
    audio.addEventListener("error", () => setStatus("error"));
    return audio;
  }

  async function onClick() {
    if (status === "playing") {
      audioRef.current?.pause();
      return;
    }
    let audio = audioRef.current;
    if (status === "error" || !audio) {
      audio?.pause();
      audio = createAudio();
      audioRef.current = audio;
    }
    if (status !== "paused") setStatus("loading");
    try {
      await audio.play();
    } catch (error) {
      // The user pausing before playback starts rejects play() with AbortError; that's not a failure.
      if (!(error instanceof DOMException && error.name === "AbortError")) setStatus("error");
    }
  }

  const Icon = status === "playing" ? Pause : status === "loading" ? LoaderCircle : status === "error" ? RotateCcw : Volume2;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={status === "error" ? "Audio unavailable, retry" : `${LABELS[status]} feedback read aloud`}
      aria-pressed={status === "playing"}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-[5px] text-[11px] leading-[1.5] font-medium whitespace-nowrap transition-colors",
        status === "error"
          ? "bg-[#281d35] text-[#ff5e7a] hover:bg-[#33223f]"
          : "bg-[#1e1f45] text-[#e8e6ff] hover:bg-[#2a2b5a]",
      )}
    >
      <Icon aria-hidden className={cn("size-3.5", status === "loading" && "animate-spin")} />
      {LABELS[status]}
    </button>
  );
}
