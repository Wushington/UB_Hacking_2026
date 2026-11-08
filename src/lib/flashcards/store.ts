import "server-only";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { StudyCard } from "@/lib/study/session";
import type { LectureNotes } from "./generate";
import { StaleNotesError, type SaveDeckInput } from "./handler";

const { flashcardDecks, flashcards, lectures, noteBlocks, noteSections } = schema;

/** Latest saved notes of a lecture the user owns, read in one consistent snapshot. */
export async function loadLectureNotes(userId: string, lectureId: string): Promise<LectureNotes | null> {
  return getDb().transaction(
    async (tx) => {
      const [lecture] = await tx
        .select({ title: lectures.title, revision: lectures.notesRevision })
        .from(lectures)
        .where(and(eq(lectures.id, lectureId), eq(lectures.userId, userId)));
      if (!lecture) return null;

      const sections = await tx.select().from(noteSections).where(eq(noteSections.lectureId, lectureId)).orderBy(asc(noteSections.position));
      const blocks = sections.length
        ? await tx.select().from(noteBlocks).where(inArray(noteBlocks.sectionId, sections.map((s) => s.id))).orderBy(asc(noteBlocks.position))
        : [];

      return {
        revision: lecture.revision,
        notes: {
          title: lecture.title,
          sections: sections.map((s) => ({
            id: s.id,
            heading: s.heading,
            position: s.position,
            blocks: blocks
              .filter((b) => b.sectionId === s.id)
              .map((b) => ({ id: b.id, kind: b.kind, text: b.text, sourceRefs: b.sourceRefs })),
          })),
        },
      };
    },
    { isolationLevel: "repeatable read" },
  );
}

/**
 * Inserts a NEW deck and its cards atomically. Existing decks are never updated or deleted, so a failed
 * generation or save leaves the previous deck untouched. Throws StaleNotesError if notes were edited meanwhile.
 */
export async function saveFlashcardDeck({ userId, lectureId, requestedCount, notesRevision, cards }: SaveDeckInput): Promise<{ deckId: string }> {
  return getDb().transaction(async (tx) => {
    const [lecture] = await tx
      .select({ revision: lectures.notesRevision })
      .from(lectures)
      .where(and(eq(lectures.id, lectureId), eq(lectures.userId, userId)))
      .for("update");
    if (!lecture || lecture.revision !== notesRevision) throw new StaleNotesError();

    const [deck] = await tx
      .insert(flashcardDecks)
      .values({ lectureId, userId, requestedCount, actualCount: cards.length, notesRevision })
      .returning({ id: flashcardDecks.id });
    await tx.insert(flashcards).values(cards.map((card, position) => ({ deckId: deck.id, position, ...card })));
    return { deckId: deck.id };
  });
}

export type StudyDeck = {
  lectureTitle: string;
  deck: { id: string; createdAt: Date; requestedCount: number; cards: StudyCard[] } | null;
};

/** The lecture's most recent deck (owned by userId), or null when the lecture isn't the user's. */
export async function loadLatestDeck(userId: string, lectureId: string): Promise<StudyDeck | null> {
  const db = getDb();
  const [lecture] = await db
    .select({ title: lectures.title })
    .from(lectures)
    .where(and(eq(lectures.id, lectureId), eq(lectures.userId, userId)));
  if (!lecture) return null;

  const [deck] = await db
    .select()
    .from(flashcardDecks)
    .where(and(eq(flashcardDecks.lectureId, lectureId), eq(flashcardDecks.userId, userId)))
    .orderBy(desc(flashcardDecks.createdAt))
    .limit(1);
  if (!deck) return { lectureTitle: lecture.title, deck: null };

  const cards = await db
    .select({ id: flashcards.id, question: flashcards.question, answer: flashcards.answer, conceptLabel: flashcards.conceptLabel })
    .from(flashcards)
    .where(eq(flashcards.deckId, deck.id))
    .orderBy(asc(flashcards.position));
  return { lectureTitle: lecture.title, deck: { id: deck.id, createdAt: deck.createdAt, requestedCount: deck.requestedCount, cards } };
}
