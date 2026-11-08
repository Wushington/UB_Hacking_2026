import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CompleteSession } from "@/contracts/study";
import { saveStudyResultsFor } from "./persistence";

const fetchMock = vi.fn<typeof fetch>();
const DECK = "deck-1";
const input: CompleteSession = { results: [{ flashcardId: "00000000-0000-4000-8000-000000000001", result: "missed" }] };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

const started = () => Response.json({ sessionId: "s-1" }, { status: 201 });
const saved = () => Response.json({ correctCount: 0, missedCount: 1, totalCount: 1, percent: 0 });

describe("saveStudyResultsFor", () => {
  it("starts a session on the deck, then completes it with the results", async () => {
    fetchMock.mockResolvedValueOnce(started()).mockResolvedValueOnce(saved());
    await saveStudyResultsFor(DECK)(input);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/decks/deck-1/sessions", expect.objectContaining({ method: "POST" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/study-sessions/s-1/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
  });

  it("throws when either request fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(saveStudyResultsFor(DECK)(input)).rejects.toThrow();
    fetchMock.mockResolvedValueOnce(started()).mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(saveStudyResultsFor(DECK)(input)).rejects.toThrow();
  });

  it("retrying the same results reuses the started session instead of opening another", async () => {
    const save = saveStudyResultsFor(DECK);
    fetchMock.mockResolvedValueOnce(started()).mockResolvedValueOnce(new Response(null, { status: 500 }));
    await expect(save(input)).rejects.toThrow();
    fetchMock.mockResolvedValueOnce(saved());
    await save(input);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenLastCalledWith("/api/study-sessions/s-1/complete", expect.anything());
  });
});
