import { Suspense } from "react";
import { z } from "zod";
import { HowItWorks } from "@/components/orbit/how-it-works";
import { OrbitPage, OrbitPageHeading } from "@/components/orbit/shell";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { loadLatestDeck } from "@/lib/flashcards/store";
import { DeckStudy } from "./deck-study";
import { FlashcardGenerator } from "./flashcard-generator";
import { SAMPLE_DECK } from "./sample-deck";
import { StudySessionView } from "./study-session";

const GENERATE_STEPS = ["Open your notes.", "Choose the number of cards.", "Generate and review."];

/** The signed-in user's lecture + latest deck, or null (signed out, malformed id, or not their lecture). */
async function loadOwnedDeck(lectureId: string) {
  if (!z.uuid().safeParse(lectureId).success) return null;
  try {
    return await loadLatestDeck(await requireUserId(), lectureId);
  } catch (error) {
    if (error instanceof UnauthorizedError) return null;
    throw error;
  }
}

async function StudyPage({ params }: PageProps<"/lectures/[id]/study">) {
  const { id } = await params;
  const data = await loadOwnedDeck(id);
  if (!data) {
    return <StudySessionView deckTitle={SAMPLE_DECK.title} subtitle={SAMPLE_DECK.subtitle} cards={SAMPLE_DECK.cards} isSample />;
  }

  const { lectureTitle, deck } = data;
  if (!deck) {
    return (
      <OrbitPage>
        <OrbitPageHeading title="Generate Flashcards" subtitle={`Create study cards from ${lectureTitle}.`} aside={<HowItWorks steps={GENERATE_STEPS} />} />
        <FlashcardGenerator lectureId={id} hasExistingDeck={false} />
      </OrbitPage>
    );
  }

  const { cards } = deck;
  return (
    <div className="flex flex-1 flex-col text-[#e8e6ff]">
      <DeckStudy
        key={deck.id}
        deckId={deck.id}
        deckTitle={lectureTitle}
        subtitle={`${cards.length} of ${deck.requestedCount} requested cards · generated ${deck.createdAt.toLocaleDateString("en-US")}`}
        cards={cards}
      />
      <div className="mx-auto flex w-full max-w-[1328px] flex-col gap-4 px-4 pb-10 sm:px-14">
        <details className="rounded-[22px] bg-[#161730] p-6">
          <summary className="cursor-pointer text-sm font-medium text-white">Review all {cards.length} cards in this deck</summary>
          <ol className="mt-4 flex flex-col gap-3">
            {cards.map((card, index) => (
              <li key={card.id} className="border-b border-[#333564] pb-3">
                <p className="text-[10px] font-semibold tracking-[1.5px] text-[#9496bf] uppercase">{card.conceptLabel}</p>
                <p className="text-sm font-medium break-words text-white">{index + 1}. {card.question}</p>
                <p className="text-[13px] break-words text-[#c1bedf]">{card.answer}</p>
              </li>
            ))}
          </ol>
        </details>
        <details className="rounded-[22px] bg-[#161730] p-6">
          <summary className="cursor-pointer text-sm font-medium text-white">Generate a new deck from these notes</summary>
          <div className="mt-2 -mx-6 -mb-6">
            <FlashcardGenerator lectureId={id} hasExistingDeck />
          </div>
        </details>
      </div>
    </div>
  );
}

export default function Page(props: PageProps<"/lectures/[id]/study">) {
  return (
    <Suspense fallback={<p role="status" className="p-8 text-[#c1bedf]">Loading your flashcards…</p>}>
      <StudyPage {...props} />
    </Suspense>
  );
}
