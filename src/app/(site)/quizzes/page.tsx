import type { Metadata } from "next";
import { Suspense } from "react";
import { OrbitPage, OrbitPageHeading } from "@/components/orbit/shell";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { listQuizzes } from "@/lib/quizzes/queries";
import { listDividers, listSubjects } from "@/lib/subjects/store";
import { QuizzesList } from "./quizzes-list";

export const metadata: Metadata = {
  title: "Flashcards · Orbit Study",
};

async function Quizzes() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) return <p className="text-muted-foreground">Sign in to see your flashcards.</p>;
    throw error;
  }
  const [quizzes, subjects, dividers] = await Promise.all([listQuizzes(userId), listSubjects(userId), listDividers(userId)]);
  return <QuizzesList quizzes={quizzes} subjects={subjects} dividers={dividers} />;
}

export default function Page() {
  return (
    <OrbitPage>
      <OrbitPageHeading title="Flashcards" subtitle="Generate and study flashcards from your notes." />
      <Suspense fallback={<p role="status" className="text-muted-foreground">Loading your flashcards…</p>}>
        <Quizzes />
      </Suspense>
    </OrbitPage>
  );
}
