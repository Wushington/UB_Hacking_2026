import { z } from "zod";
import { completeSessionSchema, type CompleteSession } from "@/contracts/study";
import { UnauthorizedError } from "@/lib/auth";

export type SessionTotals = { correctCount: number; missedCount: number; totalCount: number };

export type StartSessionDeps = {
  getUserId(): Promise<string>;
  /** Creates an in-progress session on a deck owned by userId; null when the deck isn't theirs. */
  createSession(userId: string, deckId: string): Promise<{ sessionId: string } | null>;
};

export type CompleteSessionDeps = {
  getUserId(): Promise<string>;
  /** The session's deck card ids and, once completed, its saved totals; null when the session isn't the user's. */
  loadSession(userId: string, sessionId: string): Promise<{ cardIds: string[]; completed: SessionTotals | null } | null>;
  /** Saves the results, totals and weak concepts in one transaction; safe to repeat. */
  completeSession(userId: string, sessionId: string, results: CompleteSession["results"], totals: SessionTotals): Promise<void>;
};

/** 200 body of POST /api/study-sessions/[id]/complete. */
export type CompleteSessionResponse = SessionTotals & { percent: number };

const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

function isSameHost(origin: string, host: string | null): boolean {
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/** Auth + CSRF guard shared by both routes: a user id, or the error Response to return. */
async function guard(request: Request, getUserId: () => Promise<string>): Promise<string | Response> {
  let userId: string;
  try {
    userId = await getUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail(401, "unauthorized", "Sign in to save your study session.");
    throw error;
  }
  const origin = request.headers.get("origin");
  if (origin && !isSameHost(origin, request.headers.get("host"))) return fail(403, "forbidden", "Cross-site request blocked.");
  return userId;
}

const withPercent = (t: SessionTotals): CompleteSessionResponse => ({ ...t, percent: t.totalCount ? Math.round((t.correctCount / t.totalCount) * 100) : 0 });

export async function handleStartSession(request: Request, deckId: string, deps: StartSessionDeps): Promise<Response> {
  const userId = await guard(request, deps.getUserId);
  if (userId instanceof Response) return userId;
  if (!z.uuid().safeParse(deckId).success) return fail(404, "deck_not_found", "Deck not found.");
  const created = await deps.createSession(userId, deckId);
  if (!created) return fail(404, "deck_not_found", "Deck not found.");
  return Response.json(created, { status: 201 });
}

export async function handleCompleteSession(request: Request, sessionId: string, deps: CompleteSessionDeps): Promise<Response> {
  const userId = await guard(request, deps.getUserId);
  if (userId instanceof Response) return userId;
  if (!request.headers.get("content-type")?.startsWith("application/json")) return fail(415, "unsupported_media_type", "Send JSON.");

  const body = completeSessionSchema.safeParse(await request.json().catch(() => undefined));
  if (!body.success) return fail(400, "invalid_results", "Grade each card once before saving.");
  if (!z.uuid().safeParse(sessionId).success) return fail(404, "session_not_found", "Study session not found.");

  const session = await deps.loadSession(userId, sessionId);
  if (!session) return fail(404, "session_not_found", "Study session not found.");
  if (session.completed) return Response.json(withPercent(session.completed));

  const { results } = body.data;
  const deckCards = new Set(session.cardIds);
  if (results.length !== deckCards.size || !results.every((r) => deckCards.has(r.flashcardId))) {
    return fail(400, "invalid_results", "Grade every card in this deck exactly once.");
  }

  const correctCount = results.filter((r) => r.result === "got_it").length;
  const totals: SessionTotals = { correctCount, missedCount: results.length - correctCount, totalCount: results.length };
  try {
    await deps.completeSession(userId, sessionId, results, totals);
  } catch (error) {
    console.error("Saving study session failed", error);
    return fail(500, "save_failed", "Couldn't save this session. Please try again.");
  }
  return Response.json(withPercent(totals));
}
