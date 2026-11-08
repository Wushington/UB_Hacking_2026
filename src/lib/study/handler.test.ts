import { describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/auth";
import { handleCompleteSession, handleStartSession, type CompleteSessionDeps, type StartSessionDeps } from "./handler";

const USER = "user_123";
const DECK = "44444444-4444-4444-8444-444444444401";
const SESSION = "55555555-5555-4555-8555-555555555501";
const CARD_A = "66666666-6666-4666-8666-666666666601";
const CARD_B = "66666666-6666-4666-8666-666666666602";
const CARD_C = "66666666-6666-4666-8666-666666666603";

const signedOut = vi.fn(async (): Promise<string> => { throw new UnauthorizedError(); });

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/x", {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function json(response: Response) {
  return { status: response.status, body: await response.json() };
}

describe("POST /api/decks/[id]/sessions", () => {
  const deps = (o: Partial<StartSessionDeps> = {}): StartSessionDeps => ({
    getUserId: vi.fn(async () => USER),
    createSession: vi.fn(async () => ({ sessionId: SESSION })),
    ...o,
  });

  it("starts a session on the user's deck", async () => {
    const d = deps();
    const { status, body } = await json(await handleStartSession(post({}), DECK, d));
    expect(status).toBe(201);
    expect(body).toEqual({ sessionId: SESSION });
    expect(d.createSession).toHaveBeenCalledWith(USER, DECK);
  });

  it("rejects signed-out users", async () => {
    const d = deps({ getUserId: signedOut });
    expect((await handleStartSession(post({}), DECK, d)).status).toBe(401);
    expect(d.createSession).not.toHaveBeenCalled();
  });

  it("rejects cross-site requests", async () => {
    const d = deps();
    expect((await handleStartSession(post({}, { origin: "https://evil.example" }), DECK, d)).status).toBe(403);
    expect(d.createSession).not.toHaveBeenCalled();
  });

  it("returns 404 for a malformed id or a deck that isn't the user's", async () => {
    expect((await handleStartSession(post({}), "nope", deps())).status).toBe(404);
    const d = deps({ createSession: vi.fn(async () => null) });
    expect((await handleStartSession(post({}), DECK, d)).status).toBe(404);
  });
});

describe("POST /api/study-sessions/[id]/complete", () => {
  const deps = (o: Partial<CompleteSessionDeps> = {}): CompleteSessionDeps => ({
    getUserId: vi.fn(async () => USER),
    loadSession: vi.fn(async () => ({ cardIds: [CARD_A, CARD_B, CARD_C], completed: null })),
    completeSession: vi.fn(async () => undefined),
    ...o,
  });
  const allGraded = {
    results: [
      { flashcardId: CARD_A, result: "got_it" },
      { flashcardId: CARD_B, result: "missed" },
      { flashcardId: CARD_C, result: "got_it" },
    ],
  };

  it("saves every card's result and returns the server-computed score", async () => {
    const d = deps();
    const { status, body } = await json(await handleCompleteSession(post(allGraded), SESSION, d));
    expect(status).toBe(200);
    expect(body).toEqual({ correctCount: 2, missedCount: 1, totalCount: 3, percent: 67 });
    expect(d.completeSession).toHaveBeenCalledWith(USER, SESSION, allGraded.results, { correctCount: 2, missedCount: 1, totalCount: 3 });
  });

  it("is idempotent: an already completed session returns its saved totals without writing", async () => {
    const d = deps({ loadSession: vi.fn(async () => ({ cardIds: [CARD_A, CARD_B, CARD_C], completed: { correctCount: 3, missedCount: 0, totalCount: 3 } })) });
    const { status, body } = await json(await handleCompleteSession(post(allGraded), SESSION, d));
    expect(status).toBe(200);
    expect(body).toEqual({ correctCount: 3, missedCount: 0, totalCount: 3, percent: 100 });
    expect(d.completeSession).not.toHaveBeenCalled();
  });

  it("rejects signed-out users and cross-site requests", async () => {
    expect((await handleCompleteSession(post(allGraded), SESSION, deps({ getUserId: signedOut }))).status).toBe(401);
    expect((await handleCompleteSession(post(allGraded, { origin: "https://evil.example" }), SESSION, deps())).status).toBe(403);
  });

  it("returns 404 for a malformed id or a session that isn't the user's", async () => {
    expect((await handleCompleteSession(post(allGraded), "nope", deps())).status).toBe(404);
    expect((await handleCompleteSession(post(allGraded), SESSION, deps({ loadSession: vi.fn(async () => null) }))).status).toBe(404);
  });

  it.each([
    ["non-JSON", "not json"],
    ["empty results", { results: [] }],
    ["duplicate cards", { results: [{ flashcardId: CARD_A, result: "got_it" }, { flashcardId: CARD_A, result: "missed" }] }],
    ["bad result value", { results: [{ flashcardId: CARD_A, result: "maybe" }] }],
  ])("rejects %s", async (_, body) => {
    const d = deps();
    expect((await handleCompleteSession(post(body), SESSION, d)).status).toBe(400);
    expect(d.completeSession).not.toHaveBeenCalled();
  });

  it("rejects results that skip a card or include a card from another deck", async () => {
    const d = deps();
    const partial = { results: allGraded.results.slice(0, 2) };
    expect((await handleCompleteSession(post(partial), SESSION, d)).status).toBe(400);
    const foreign = { results: [...allGraded.results.slice(0, 2), { flashcardId: "66666666-6666-4666-8666-666666666699", result: "got_it" }] };
    expect((await handleCompleteSession(post(foreign), SESSION, d)).status).toBe(400);
    expect(d.completeSession).not.toHaveBeenCalled();
  });

  it("returns 500 when saving fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = deps({ completeSession: vi.fn(async () => { throw new Error("db down"); }) });
    expect((await handleCompleteSession(post(allGraded), SESSION, d)).status).toBe(500);
    error.mockRestore();
  });
});
