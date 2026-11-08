import { Suspense } from "react";
import { PageContainer, PageHeader } from "@/components/layout/page";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { listWeakConcepts } from "@/lib/weak-concepts/store";
import { WeakConceptsList } from "./weak-concepts-list";

async function WeakConcepts() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) return <p className="text-muted-foreground">Sign in to see your weak concepts.</p>;
    throw error;
  }
  return <WeakConceptsList concepts={await listWeakConcepts(userId)} />;
}

export default function Page() {
  return (
    <PageContainer>
      <PageHeader title="Weak concepts" description="Concepts you missed on flashcards or struggled to explain. Study these first." />
      <Suspense fallback={<p role="status" className="text-muted-foreground">Loading your weak concepts…</p>}>
        <WeakConcepts />
      </Suspense>
    </PageContainer>
  );
}
