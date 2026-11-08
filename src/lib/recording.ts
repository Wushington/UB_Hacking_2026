import { AUDIO_MIME_TYPES } from "@/contracts/audio";

export type AudioMimeType = (typeof AUDIO_MIME_TYPES)[number];

/** Recorder formats to try, best first. Chrome/Firefox record WebM/Opus; Safari records MP4/AAC. */
const RECORDER_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus", "audio/ogg"];

/** "audio/webm;codecs=opus" → "audio/webm" if it's an allowed upload type, else null. */
export function baseAudioMimeType(type: string | null | undefined): AudioMimeType | null {
  const base = (type ?? "").split(";")[0].trim().toLowerCase();
  return (AUDIO_MIME_TYPES as readonly string[]).includes(base) ? (base as AudioMimeType) : null;
}

/** The first MediaRecorder format this browser supports whose base type we accept. */
export function pickRecorderMimeType(isTypeSupported: (type: string) => boolean): string | null {
  return RECORDER_CANDIDATES.find((t) => baseAudioMimeType(t) && isTypeSupported(t)) ?? null;
}

export function formatClock(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
