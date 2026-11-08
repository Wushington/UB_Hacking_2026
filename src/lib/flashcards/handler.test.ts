import { describe, expect, it, vi } from "vitest";
import { UnauthorizedError } from "@/lib/auth";
import { handleGenerateFlashcards, StaleNotesError, type GenerateFlashcardsDeps } from "./handler";
import { card, LECTURE_ID, NOTES_FIXTURE, VALID_CARDS } from "./test-fixtures";

const USER = "user_123";
const DECK_ID = "44444444-4444-4444-8444-444444444401";

function deps(overrides: Partial<GenerateFlashcardsDeps> = {}): GenerateFlashcardsDeps {
  return {
    getUserId: vi.fn(async () => USER),
    allowRequest: vi.fn(() => true),
    loadNotes: vi.fn(async () => NOTES_FIXTURE),
    generate: vi.fn(async () => ({ cards: VALID_CARDS })),
    saveDeck: vi.fn(async () => ({ deckId: DECK_ID })),
    ...overrides,
  };
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request(`http://localhost:3000/api/lectures/${LECTURE_ID}/flashcards`, {
    method: "POST",
    headers: { "content-type": "application/json", host: "localhost:3000", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

async function call(d: GenerateFlashcardsDeps, request = post({ count: 3 }), lectureId = LECTURE_ID) {
  const response = await handleGenerateFlashcards(request, lectureId, d);
  return { status: response.status, body: await response.json() };
}

describe("POST /api/lectures/[id]/flashcards", () => {
  it("rejects signed-out users without touching notes or Gemini", async () => {
    const d = deps({ getUserId: vi.fn(async () => { throw new UnauthorizedError(); }) });
    const { status, body } = await call(d);
    expect(status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
    expect(d.loadNotes).not.toHaveBeenCalled();
    expect(d.generate).not.toHaveBeenCalled();
  });

  it("rejects cross-site requests and non-JSON bodies", async () => {
    const d = deps();
    expect((await call(d, post({ count: 3 }, { origin: "https://evil.example" }))).status).toBe(403);
    expect((await call(d, post({ count: 3 }, { origin: "null" }))).status).toBe(403);
    expect((await call(d, post({ count: 3 }, { origin: "http://localhost:3000" }))).status).toBe(201);
    vi.mocked(d.generate).mockClear();
    expect((await call(d, post({ count: 3 }, { "content-type": "text/plain" }))).status).toBe(415);
    expect(d.generate).not.toHaveBeenCalled();
  });

  it.each([[0], [51], [2.5], ["10"], [null], [-1]])("rejects count %s", async (count) => {
    const d = deps();
    const { status, body } = await call(d, post({ count }));
    expect(status).toBe(400);
    expect(body.error.code).toBe("invalid_count");
    expect(d.loadNotes).not.toHaveBeenCalled();
  });

  it("rejects an unparsable body", async () => {
    expect((await call(deps(), post("{not json"))).status).toBe(400);
  });

  it("defaults to 10 cards when no count is given", async () => {
    const d = deps();
    const { status, body } = await call(d, post({}));
    expect(status).toBe(201);
    expect(body.requestedCount).toBe(10);
    expect(vi.mocked(d.generate).mock.calls[0][0]).toContain("at most 10");
  });

  it("returns 404 for a malformed id or a lecture the user doesn't own", async () => {
    const d = deps({ loadNotes: vi.fn(async () => null) });
    expect((await call(d, post({ count: 3 }), "not-a-uuid")).status).toBe(404);
    expect((await call(d)).status).toBe(404);
    expect(d.loadNotes).toHaveBeenCalledWith(USER, LECTURE_ID);
    expect(d.generate).not.toHaveBeenCalled();
  });

  it("asks for notes first when the lecture has none", async () => {
    const d = deps({ loadNotes: vi.fn(async () => ({ revision: 0, notes: { title: "Empty", sections: [] } })) });
    const { status, body } = await call(d);
    expect(status).toBe(422);
    expect(body.error.code).toBe("no_notes");
    expect(d.generate).not.toHaveBeenCalled();
  });

  it("rate-limits per user", async () => {
    const d = deps({ allowRequest: vi.fn(() => false) });
    const { status } = await call(d);
    expect(status).toBe(429);
    expect(d.allowRequest).toHaveBeenCalledWith(USER);
    expect(d.generate).not.toHaveBeenCalled();
  });

  it("saves the requested number of grounded cards for the user's lecture and latest notes revision", async () => {
    const d = deps();
    const { status, body } = await call(d);
    expect(status).toBe(201);
    expect(body).toEqual({ deckId: DECK_ID, requestedCount: 3, actualCount: 3, shortfall: null });
    expect(d.saveDeck).toHaveBeenCalledWith({
      userId: USER,
      lectureId: LECTURE_ID,
      requestedCount: 3,
      notesRevision: NOTES_FIXTURE.revision,
      cards: VALID_CARDS,
    });
  });

  it("saves fewer cards and explains the shortfall when the notes can't support the request", async () => {
    const dupe = card({ question: "Where does glycolysis take place" });
    const d = deps({ generate: vi.fn(async () => ({ cards: [...VALID_CARDS.slice(0, 2), dupe] })) });
    const { status, body } = await call(d, post({ count: 5 }));
    expect(status).toBe(201);
    expect(body.actualCount).toBe(2);
    expect(body.shortfall).toContain("only had enough distinct material for 2");
    expect(vi.mocked(d.saveDeck).mock.calls[0][0].cards).toHaveLength(2);
  });

  it("retries once when Gemini fails or returns an invalid shape", async () => {
    const generate = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce({ cards: VALID_CARDS });
    const d = deps({ generate });
    expect((await call(d)).status).toBe(201);
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("keeps the existing deck (saves nothing) when generation fails twice", async () => {
    const d = deps({ generate: vi.fn().mockRejectedValueOnce(new Error("x")).mockResolvedValueOnce({ cards: "bad" }) });
    const { status, body } = await call(d);
    expect(status).toBe(502);
    expect(body.error.code).toBe("generation_failed");
    expect(d.saveDeck).not.toHaveBeenCalled();
  });

  it.each([[429], [401], [403]])("does not retry when Gemini answers %s, and says the AI is unavailable", async (status) => {
    const generate = vi.fn().mockRejectedValue(Object.assign(new Error(`gemini ${status}`), { status }));
    const d = deps({ generate });
    const { status: code, body } = await call(d);
    expect(code).toBe(503);
    expect(body.error).toEqual({
      code: "ai_unavailable",
      message: "Flashcards are busy right now. Please try again in a few minutes.",
    });
    expect(generate).toHaveBeenCalledTimes(1);
    expect(d.saveDeck).not.toHaveBeenCalled();
  });

  it("logs why generation failed, without the prompt", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const d = deps({ generate: vi.fn().mockRejectedValue(Object.assign(new Error("quota exceeded"), { status: 429 })) });
      await call(d);
      expect(log).toHaveBeenCalledTimes(1);
      const logged = log.mock.calls[0].map(String).join(" ");
      expect(logged).toContain("quota exceeded");
      expect(logged).not.toContain(NOTES_FIXTURE.notes.title);
    } finally {
      log.mockRestore();
    }
  });

  it("saves nothing when no generated card is supported by the notes", async () => {
    const d = deps({ generate: vi.fn(async () => ({ cards: [card({ sourceNoteBlockIds: [] })] })) });
    const { status, body } = await call(d);
    expect(status).toBe(422);
    expect(body.error.code).toBe("no_supported_cards");
    expect(d.saveDeck).not.toHaveBeenCalled();
  });

  it("reports notes edited during generation and other save failures honestly", async () => {
    const stale = await call(deps({ saveDeck: vi.fn(async () => { throw new StaleNotesError(); }) }));
    expect(stale.status).toBe(409);
    expect(stale.body.error.code).toBe("notes_changed");
    const failed = await call(deps({ saveDeck: vi.fn(async () => { throw new Error("db down"); }) }));
    expect(failed.status).toBe(500);
    expect(failed.body.error.code).toBe("save_failed");
  });
});
