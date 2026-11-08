import type { CompleteSession } from "@/contracts/study";

/** Saves a finished session; rejects when it couldn't be saved. */
export type SaveStudyResults = (input: CompleteSession) => Promise<void>;

async function postJson(url: string, body: unknown): Promise<Response> {
  const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Saving study session failed (${response.status})`);
  return response;
}

/**
 * Saves a finished run through the deck: POST /api/decks/[id]/sessions, then
 * POST /api/study-sessions/[id]/complete. A retry of the same run reuses its session.
 */
export function saveStudyResultsFor(deckId: string): SaveStudyResults {
  const sessions = new WeakMap<CompleteSession["results"], string>();
  return async (input) => {
    let sessionId = sessions.get(input.results);
    if (!sessionId) {
      const response = await postJson(`/api/decks/${deckId}/sessions`, {});
      sessionId = ((await response.json()) as { sessionId: string }).sessionId;
      sessions.set(input.results, sessionId);
    }
    await postJson(`/api/study-sessions/${sessionId}/complete`, input);
  };
}
