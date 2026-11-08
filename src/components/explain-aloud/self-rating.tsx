"use client";

import { LoaderCircle, CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  selfRatingOutcome,
  selfRatingResponseSchema,
  type MasteredConcept,
  type SelfRating as SelfRatingInput,
} from "@/contracts/explanations";
import { cn } from "@/lib/utils";

const SCALE: { value: number; hint?: string }[] = [
  { value: 1, hint: "Not yet" },
  { value: 2 },
  { value: 3, hint: "Getting there" },
  { value: 4 },
  { value: 5, hint: "Nailed it" },
];

function joinLabels(labels: string[]) {
  if (labels.length <= 1) return labels[0] ?? "";
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/** What happened (or will happen) to the mastered concepts for a given rating. */
export function selfRatingMessage(rating: number, count: number) {
  const them = count === 1 ? "it" : "them";
  return selfRatingOutcome(rating) === "removed"
    ? `Removed from your weak concepts.`
    : `Marked as resolved. We’ll bring ${them} back if ${them === "it" ? "it trips" : "they trip"} you up again.`;
}

/**
 * Shown when grading judged the explanation sound on some of the student's open weak concepts.
 * The student rates their own explanation 1–5 to confirm: 4–5 removes the concepts, 1–3 marks
 * them resolved. Nothing changes until they save a rating.
 */
export function SelfRating({
  recordingId,
  mastered,
  selfRating,
}: {
  recordingId: string;
  mastered: MasteredConcept[];
  selfRating: number | null;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const rated = selfRating ?? saved;
  const labels = mastered.map((m) => m.label);

  async function save() {
    if (choice === null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/explanations/${encodeURIComponent(recordingId)}/self-rating`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: choice } satisfies SelfRatingInput),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof body.error === "string" && res.status < 500 ? body.error : "Couldn’t save your rating.");
      }
      setSaved(selfRatingResponseSchema.parse(await res.json()).rating);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t save your rating.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-label="Rate your explanation"
      className="flex w-full flex-col gap-3 rounded-[12px] border border-[#4ecba0]/30 bg-[#142b30] p-5"
    >
      <div className="flex items-start gap-[9px]">
        <CircleCheck aria-hidden className="mt-0.5 size-[18px] shrink-0 text-[#4ecba0]" />
        <h3 className="text-[13px] leading-[1.5] font-semibold text-[#4ecba0]">Concept Mastered</h3>
      </div>
      <p className="text-[13px] leading-[1.5] text-[#e8e6ff]">
        Your explanation shows you now understand <strong className="font-semibold text-white">{joinLabels(labels)}</strong>.
      </p>

      {rated !== null ? (
        <p role="status" className="text-[13px] leading-[1.5] text-[#c1bedf]">
          <span className="font-semibold text-white">Rated {rated}/5</span> · {selfRatingMessage(rated, labels.length)}
        </p>
      ) : (
        <>
          <p id={`rate-${recordingId}`} className="text-[13px] leading-[1.5] text-[#c1bedf]">
            How well do you think you explained it? Rate 4 or 5 to remove {labels.length === 1 ? "it" : "them"} from your
            weak concepts; 1–3 marks {labels.length === 1 ? "it" : "them"} resolved for now.
          </p>
          <div role="radiogroup" aria-labelledby={`rate-${recordingId}`} className="flex flex-wrap gap-2">
            {SCALE.map(({ value, hint }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={choice === value}
                aria-label={hint ? `${value}, ${hint}` : String(value)}
                onClick={() => setChoice(value)}
                disabled={saving}
                className={cn(
                  "flex min-w-[52px] flex-col items-center rounded-[10px] border px-3 py-2 text-[13px] leading-[1.3] transition-colors disabled:opacity-60",
                  choice === value
                    ? "border-[#4ecba0] bg-[#4ecba0]/15 text-white"
                    : "border-[#2c4a4c] text-[#c1bedf] hover:border-[#4ecba0]/60",
                )}
              >
                <span className="font-semibold">{value}</span>
                {hint ? <span className="text-[10px] text-[#9496bf]">{hint}</span> : null}
              </button>
            ))}
          </div>
          {error ? (
            <p role="alert" className="text-[12px] leading-[1.5] text-[#ff5e7a]">
              {error}
            </p>
          ) : null}
          <div>
            <button
              type="button"
              onClick={() => void save()}
              disabled={choice === null || saving}
              className="inline-flex h-[38px] items-center gap-2 rounded-[10px] bg-[#4ecba0] px-4 text-[13px] font-semibold text-[#0d0e2a] transition-colors hover:bg-[#6ad8b2] disabled:cursor-default disabled:opacity-50"
            >
              {saving ? <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" /> : null}
              {saving ? "Saving…" : "Save Rating"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
