import { Suspense } from "react";
import { SAMPLE_DECK } from "./sample-deck";
import { StudySessionView } from "./study-session";

async function StudyPage({ params }: PageProps<"/lectures/[id]/study">) {
  await params;
  return <StudySessionView deckTitle={SAMPLE_DECK.title} subtitle={SAMPLE_DECK.subtitle} cards={SAMPLE_DECK.cards} isSample />;
}

export default function Page(props: PageProps<"/lectures/[id]/study">) {
  return (
    <Suspense fallback={<p role="status" className="min-h-full bg-[#0d0e2a] p-8 text-[#c1bedf]">Loading your sample deck…</p>}>
      <StudyPage {...props} />
    </Suspense>
  );
}
