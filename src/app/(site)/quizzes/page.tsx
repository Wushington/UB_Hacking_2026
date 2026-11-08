import type { Metadata } from "next";
import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { listQuizzes } from "@/lib/quizzes/queries";
import { QuizzesList } from "./quizzes-list";

export const metadata: Metadata = {
  title: "Quizzes · Orbit Study",
};

async function Quizzes() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) return <p className="text-muted-foreground">Sign in to see your flashcard quizzes.</p>;
    throw error;
  }
  return <QuizzesList quizzes={await listQuizzes(userId)} />;
}

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="Quizzes" description="Flashcard decks from your lectures. Generate a deck, study it, and missed cards become weak concepts." />
      <Suspense fallback={<p role="status" className="text-muted-foreground">Loading your quizzes…</p>}>
        <Quizzes />
      </Suspense>
    </PageContainer>
  );
}
