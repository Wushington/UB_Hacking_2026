import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { QuizRow } from "@/lib/quizzes/view";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** One card per lecture, linking to its flashcard study page. Server-renderable: no client state. */
export function QuizzesList({ quizzes }: { quizzes: QuizRow[] }) {
  if (quizzes.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-muted-foreground">No notes yet. Capture notes to generate flashcards.</p>
        <Link href="/capture" className={buttonVariants({ size: "sm" })}>Capture Notes</Link>
      </div>
    );
  }

  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {quizzes.map((q) => (
        <li key={q.lectureId}>
          <Card className="h-full">
            <CardHeader className="gap-2">
              <h2 className="text-lg font-semibold break-words">{q.title}</h2>
              <div className="flex flex-wrap gap-2">
                {q.cardCount === null ? (
                  <Badge variant="outline">No flashcards yet</Badge>
                ) : (
                  <>
                    <Badge variant="secondary">{plural(q.cardCount, "card")}</Badge>
                    <Badge variant="outline">{q.sessionCount === 0 ? "Not studied yet" : `Studied ${plural(q.sessionCount, "time")}`}</Badge>
                    {q.lastScore !== null && <Badge variant="outline">{`Last score ${q.lastScore}%`}</Badge>}
                  </>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <Link
                href={`/lectures/${q.lectureId}/study`}
                className={buttonVariants({ size: "sm", variant: q.cardCount === null ? "outline" : "default" })}
              >
                {q.cardCount === null ? "Generate Flashcards" : q.sessionCount === 0 ? "Start Studying" : "Continue Studying"}
              </Link>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
