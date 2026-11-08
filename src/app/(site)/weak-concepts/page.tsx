import type { Metadata } from "next";
import { Suspense } from "react";
import { HowItWorks } from "@/components/orbit/how-it-works";
import { OrbitPage, OrbitPageHeading } from "@/components/orbit/shell";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { listWeakConcepts } from "@/lib/weak-concepts/store";
import { WeakConceptsList } from "./weak-concepts-list";

export const metadata: Metadata = {
  title: "Weak Concepts · Orbit Study",
};

const HOW_IT_WORKS = ["Review the concepts you missed.", "Open the related flashcards or notes.", "Study the material again or record an explanation."];

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
    <OrbitPage>
      <OrbitPageHeading title="Weak Concepts" subtitle="Review concepts you missed." aside={<HowItWorks steps={HOW_IT_WORKS} />} />
      <Suspense fallback={<p role="status" className="text-muted-foreground">Loading your weak concepts…</p>}>
        <WeakConcepts />
      </Suspense>
    </OrbitPage>
  );
}
