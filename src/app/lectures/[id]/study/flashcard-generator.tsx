"use client";

import { useId, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_FLASHCARDS, MAX_FLASHCARDS, MIN_FLASHCARDS, flashcardCountSchema } from "@/contracts/flashcards";

const fallbackError = "Couldn't generate flashcards. Please try again.";

export function FlashcardGenerator({ lectureId, hasExistingDeck }: { lectureId: string; hasExistingDeck: boolean }) {
  const router = useRouter();
  const inputId = useId();
  const [value, setValue] = useState(String(DEFAULT_FLASHCARDS));
  const [error, setError] = useState<string | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [success, setSuccess] = useState<{ actualCount: number; shortfall: string | null } | null>(null);
  const inFlight = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setSuccess(null);
    setRequestFailed(false);
    const count = flashcardCountSchema.safeParse(value.trim() ? Number(value) : NaN);
    if (!count.success) {
      setError("Enter a whole number from 1 to 50.");
      return;
    }
    setError(null);
    inFlight.current = true;
    setGenerating(true);
    try {
      const response = await fetch(`/api/lectures/${lectureId}/flashcards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: count.data }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(typeof body?.error?.message === "string" && body.error.message.trim() ? body.error.message : fallbackError);
        setRequestFailed(true);
        return;
      }
      setSuccess({ actualCount: body.actualCount, shortfall: body.shortfall });
      router.refresh();
    } catch {
      setError(fallbackError);
      setRequestFailed(true);
    } finally {
      inFlight.current = false;
      setGenerating(false);
    }
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4 rounded-[22px] bg-[#161730] p-6 text-[#e8e6ff]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Label htmlFor={inputId}>Number of flashcards</Label>
          <Input id={inputId} type="number" min={MIN_FLASHCARDS} max={MAX_FLASHCARDS} step={1}
            value={value} onChange={(event) => setValue(event.target.value)}
            aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined}
            className="h-[46px] rounded-[12px] border-[#333564] bg-[#0d0e2a] text-white" />
        </div>
        <Button type="submit" disabled={generating} className="h-[46px] rounded-[12px] bg-[#ff5e7a] px-[18px] text-[13px] font-semibold text-white hover:bg-[#ff5e7a]/90 disabled:opacity-45">
          {generating ? "Generating…" : hasExistingDeck ? "Generate a new deck" : "Generate flashcards"}
        </Button>
      </div>
      {error && <p id={`${inputId}-error`} role="alert" className="text-sm text-[#ff5e7a]">{error}</p>}
      {requestFailed && hasExistingDeck && <p className="text-sm text-[#9496bf]">Your existing deck was kept.</p>}
      <div aria-live="polite" className="text-sm text-[#9496bf]">
        {success && <>
          <p>Generated {success.actualCount} {success.actualCount === 1 ? "flashcard" : "flashcards"} from your notes.</p>
          {success.shortfall && <p>{success.shortfall}</p>}
        </>}
      </div>
    </form>
  );
}
