"use client";

import { LoaderCircle, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const POLL_MS = 3_000;
/** Stop polling after this long; the student can reload or retry. */
const GIVE_UP_MS = 3 * 60_000;

function startGrading(recordingId: string) {
  return fetch(`/api/explanations/${encodeURIComponent(recordingId)}/grade`, { method: "POST" });
}

/**
 * While an attempt is being analyzed: nudges grading once (recovers a job lost to a server
 * restart; the endpoint is idempotent) and refreshes the page until feedback arrives.
 */
export function GradingWatcher({ recordingId }: { recordingId: string }) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    void startGrading(recordingId).catch(() => {});
    const started = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - started > GIVE_UP_MS) {
        clearInterval(timer);
        setTimedOut(true);
        return;
      }
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [recordingId, router]);

  return timedOut ? (
    <p role="status" className="text-[12px] leading-[1.5] text-[#9496bf]">
      This is taking longer than usual.{" "}
      <button type="button" onClick={() => router.refresh()} className="text-[#ff5e7a] hover:underline">
        Check again
      </button>
    </p>
  ) : (
    <span className="sr-only" role="status">
      Analyzing your explanation
    </span>
  );
}

/** Retries grading for a failed attempt. */
export function RetryGradingButton({ recordingId }: { recordingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function retry() {
    setBusy(true);
    setError(false);
    try {
      const res = await startGrading(recordingId);
      if (!res.ok) throw new Error(String(res.status));
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void retry()}
      disabled={busy}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#1e1f45] px-3 py-[5px] text-[11px] leading-[1.5] font-medium whitespace-nowrap text-[#e8e6ff] transition-colors hover:bg-[#2a2b5a] disabled:opacity-60"
    >
      {busy ? <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> : <RotateCcw aria-hidden className="size-3.5" />}
      {error ? "Retry failed, try again" : busy ? "Retrying…" : "Try Analysis Again"}
    </button>
  );
}
