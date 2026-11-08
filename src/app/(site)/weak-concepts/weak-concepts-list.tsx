import { Mic } from "lucide-react";
import Link from "next/link";
import type { WeakConceptView } from "@/contracts/weak-concepts";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Weak concepts in the order given (most recent first). Server-renderable: no client state. */
export function WeakConceptsList({ concepts }: { concepts: WeakConceptView[] }) {
  if (concepts.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">No weak concepts yet. Cards you mark Missed and weak points from your explanations will appear here.</p>
        <Link href="/quizzes" className={buttonVariants({ size: "sm" })}>Study Flashcards</Link>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-4">
      {concepts.map((c) => (
        <li key={c.id}>
          <Card>
            <CardHeader className="gap-2">
              <h2 className="text-lg font-semibold break-words">{c.label}</h2>
              <p className="text-sm text-muted-foreground">
                <span>{c.lectureTitle}</span> · last seen <time dateTime={c.lastSeenAt}>{new Date(c.lastSeenAt).toLocaleDateString("en-US")}</time>
              </p>
              <div className="flex flex-wrap gap-2">
                {c.missedCardCount > 0 && <Badge variant="secondary">{`Missed ${plural(c.missedCardCount, "flashcard")}`}</Badge>}
                {c.explanationFeedbackCount > 0 && <Badge variant="outline">{`Weak point in ${plural(c.explanationFeedbackCount, "explanation recording")}`}</Badge>}
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {c.relatedCards.length > 0 && (
                <details>
                  <summary className="cursor-pointer text-sm font-medium">{`Review ${plural(c.relatedCards.length, "missed card")}`}</summary>
                  <ol className="mt-3 flex flex-col gap-3">
                    {c.relatedCards.map((card) => (
                      <li key={card.id} className="border-b pb-3 last:border-b-0">
                        <p className="text-sm font-medium break-words">{card.question}</p>
                        <p className="text-sm break-words text-muted-foreground">{card.answer}</p>
                      </li>
                    ))}
                  </ol>
                </details>
              )}
              <div className="flex flex-wrap gap-2">
                {c.missedCardCount > 0 && (
                  <Link href={`/lectures/${c.lectureId}/study`} className={buttonVariants({ size: "sm" })}>Study Flashcards</Link>
                )}
                <Link href={`/explain?concept=${c.id}`} className={buttonVariants({ size: "sm", variant: c.missedCardCount > 0 ? "outline" : "default" })}>
                  <Mic aria-hidden />
                  Record Explanation
                </Link>
                {c.explanationFeedbackCount > 0 && (
                  <>
                    {c.feedbackRecordingId && (
                      <Link href={`/explain?recording=${c.feedbackRecordingId}`} className={buttonVariants({ size: "sm", variant: "outline" })}>View Feedback</Link>
                    )}
                    <Link href={`/lectures/${c.lectureId}`} className={buttonVariants({ size: "sm", variant: "outline" })}>View Notes</Link>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
