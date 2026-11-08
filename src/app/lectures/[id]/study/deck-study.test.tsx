import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeckStudy } from "./deck-study";

const fetchMock = vi.fn<typeof fetch>();
const card = { id: "00000000-0000-4000-8000-000000000001", question: "Q?", answer: "A.", conceptLabel: "C" };

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

async function finish() {
  const user = userEvent.setup();
  render(<DeckStudy deckId="deck-1" deckTitle="Bio" subtitle="1 card" cards={[card]} />);
  await user.click(await screen.findByRole("button", { name: "Reveal answer" }));
  await user.click(screen.getByRole("button", { name: "Missed" }));
}

describe("DeckStudy", () => {
  it("saves the finished session and says so", async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ sessionId: "s-1" }, { status: 201 }))
      .mockResolvedValueOnce(Response.json({ correctCount: 0, missedCount: 1, totalCount: 1, percent: 0 }));
    await finish();
    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/study-sessions/s-1/complete", expect.objectContaining({
      body: JSON.stringify({ results: [{ flashcardId: card.id, result: "missed" }] }),
    }));
  });

  it("shows the retry state when saving fails", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    await finish();
    expect(await screen.findByText("Couldn't save this session. Please try again.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
