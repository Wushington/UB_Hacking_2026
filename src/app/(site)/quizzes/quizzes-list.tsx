import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { QuizRow } from "@/lib/quizzes/view";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** One card per lecture, linking to its flashcard study page. Server-renderable: no client state. */
export function QuizzesList({ quizzes }: { quizzes: QuizRow[] }) {
  if (quizzes.length === 0) {
    return <p className="text-muted-foreground">No lectures yet. Save notes from a class, then generate flashcards to quiz yourself.</p>;
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
                {q.cardCount === null ? "Generate flashcards" : "Study flashcards"}
              </Link>
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
