import { requireUserId } from "@/lib/auth";
import { generateFlashcardsWithGemini } from "@/lib/flashcards/gemini";
import { handleGenerateFlashcards } from "@/lib/flashcards/handler";
import { createRateLimiter } from "@/lib/flashcards/rate-limit";
import { loadLectureNotes, saveFlashcardDeck } from "@/lib/flashcards/store";

/** Each generation is a paid Gemini call: at most 5 per user per 10 minutes. */
const allowRequest = createRateLimiter({ limit: 5, windowMs: 10 * 60_000 });

/** Story #19: generate a new flashcard deck from the lecture's latest saved notes. */
export async function POST(request: Request, ctx: RouteContext<"/api/lectures/[id]/flashcards">) {
  const { id } = await ctx.params;
  return handleGenerateFlashcards(request, id, {
    getUserId: requireUserId,
    allowRequest,
    loadNotes: loadLectureNotes,
    generate: generateFlashcardsWithGemini,
    saveDeck: saveFlashcardDeck,
  });
}
