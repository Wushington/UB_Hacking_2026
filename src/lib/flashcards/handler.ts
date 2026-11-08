import { z } from "zod";
import { flashcardCountSchema, type GeneratedCard } from "@/contracts/flashcards";
import { UnauthorizedError } from "@/lib/auth";
import { buildFlashcardPrompt, hasNoteBlocks, notesCharCount, selectValidCards, shortfallMessage, type LectureNotes } from "./generate";

/** Thrown by saveDeck when the lecture's notes were edited after they were read for generation. */
export class StaleNotesError extends Error {
  constructor() {
    super("Notes changed during generation");
    this.name = "StaleNotesError";
  }
}

export type SaveDeckInput = {
  userId: string;
  lectureId: string;
  requestedCount: number;
  notesRevision: number;
  cards: GeneratedCard[];
};

export type GenerateFlashcardsDeps = {
  getUserId(): Promise<string>;
  allowRequest(userId: string): boolean;
  /** Latest saved notes of a lecture owned by userId, or null. */
  loadNotes(userId: string, lectureId: string): Promise<LectureNotes | null>;
  /** Raw (unvalidated) Gemini JSON. */
  generate(prompt: string): Promise<unknown>;
  /** Inserts a new deck + cards in one transaction; never modifies existing decks. */
  saveDeck(input: SaveDeckInput): Promise<{ deckId: string }>;
};

/** 201 body of POST /api/lectures/[id]/flashcards. */
export type GenerateFlashcardsResponse = { deckId: string; requestedCount: number; actualCount: number; shortfall: string | null };

/** Keeps the prompt bounded; roughly a long lecture's worth of notes. */
export const MAX_NOTES_CHARS = 60_000;
const GENERATION_ATTEMPTS = 2;

const bodySchema = z.object({ count: flashcardCountSchema });

function isSameHost(origin: string, host: string | null): boolean {
  try {
    return new URL(origin).host === host;
  } catch {
    return false; // e.g. "Origin: null" from sandboxed or privacy-redirected contexts
  }
}

const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

export async function handleGenerateFlashcards(request: Request, lectureId: string, deps: GenerateFlashcardsDeps): Promise<Response> {
  let userId: string;
  try {
    userId = await deps.getUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail(401, "unauthorized", "Sign in to generate flashcards.");
    throw error;
  }

  // CSRF: browsers always send Origin on cross-site POSTs, and a JSON content type can't be sent by a plain form.
  const origin = request.headers.get("origin");
  if (origin && !isSameHost(origin, request.headers.get("host"))) return fail(403, "forbidden", "Cross-site request blocked.");
  if (!request.headers.get("content-type")?.startsWith("application/json")) return fail(415, "unsupported_media_type", "Send JSON.");

  const body = bodySchema.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return fail(400, "invalid_count", "Choose a whole number of flashcards from 1 to 50.");
  const count = body.data.count;

  if (!z.uuid().safeParse(lectureId).success) return fail(404, "lecture_not_found", "Lecture not found.");
  if (!deps.allowRequest(userId)) return fail(429, "rate_limited", "Too many generations. Please wait a few minutes and try again.");

  const lecture = await deps.loadNotes(userId, lectureId);
  if (!lecture) return fail(404, "lecture_not_found", "Lecture not found.");
  if (!hasNoteBlocks(lecture.notes)) return fail(422, "no_notes", "Save notes for this lecture before generating flashcards.");
  if (notesCharCount(lecture.notes) > MAX_NOTES_CHARS) return fail(413, "notes_too_long", "These notes are too long to generate flashcards from at once.");

  const prompt = buildFlashcardPrompt(lecture.notes, count);
  let cards: GeneratedCard[] | null = null;
  for (let attempt = 0; attempt < GENERATION_ATTEMPTS && cards === null; attempt++) {
    try {
      cards = selectValidCards(await deps.generate(prompt), lecture.notes, count);
    } catch {
      cards = null;
    }
  }
  if (cards === null) return fail(502, "generation_failed", "Flashcard generation failed. Please try again.");
  if (cards.length === 0) return fail(422, "no_supported_cards", "Your notes don't have enough material to make flashcards yet.");

  try {
    const { deckId } = await deps.saveDeck({ userId, lectureId, requestedCount: count, notesRevision: lecture.revision, cards });
    const response: GenerateFlashcardsResponse = { deckId, requestedCount: count, actualCount: cards.length, shortfall: shortfallMessage(count, cards.length) };
    return Response.json(response, { status: 201 });
  } catch (error) {
    if (error instanceof StaleNotesError) return fail(409, "notes_changed", "Your notes changed while generating. Please try again.");
    console.error("Saving flashcard deck failed", error);
    return fail(500, "save_failed", "Couldn't save your flashcards. Please try again.");
  }
}
