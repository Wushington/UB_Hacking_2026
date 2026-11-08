import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FlashcardGenerator } from "./flashcard-generator";

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
const fetchMock = vi.fn<typeof fetch>();
const props = { lectureId: "lecture-123", hasExistingDeck: false };

beforeEach(() => {
  refresh.mockReset();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("flashcard generator", () => {
  it("renders the labelled count input with defaults and submit button", () => {
    render(<FlashcardGenerator {...props} />);
    const input = screen.getByRole("spinbutton", { name: "Number of flashcards" });
    expect(input).toHaveValue(10);
    expect(input).toHaveAttribute("min", "1");
    expect(input).toHaveAttribute("max", "50");
    expect(input).toHaveAttribute("step", "1");
    expect(screen.getByRole("button", { name: "Generate flashcards" })).toHaveAttribute("type", "submit");
  });

  it.each(["", "2.5", "0", "51"])("rejects invalid count %j without fetching", async (value) => {
    const user = userEvent.setup();
    render(<FlashcardGenerator {...props} />);
    const input = screen.getByRole("spinbutton", { name: "Number of flashcards" });
    await user.clear(input);
    if (value) await user.type(input, value);
    await user.click(screen.getByRole("button", { name: "Generate flashcards" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a whole number from 1 to 50.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts a numeric count once and prevents in-flight double clicks and submissions", async () => {
    const user = userEvent.setup();
    let resolve!: (response: Response) => void;
    fetchMock.mockImplementation(() => new Promise<Response>((done) => { resolve = done; }));
    render(<FlashcardGenerator {...props} />);
    const input = screen.getByRole("spinbutton", { name: "Number of flashcards" });
    await user.clear(input);
    await user.type(input, "7");
    await user.dblClick(screen.getByRole("button", { name: "Generate flashcards" }));
    expect(screen.getByRole("button", { name: "Generating…" })).toBeDisabled();
    fireEvent.submit(input.closest("form")!);
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith("/api/lectures/lecture-123/flashcards", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: '{"count":7}',
    });
    await act(async () => resolve(Response.json({ deckId: "deck-1", requestedCount: 7, actualCount: 7, shortfall: null }, { status: 201 })));
    expect(screen.getByRole("button", { name: "Generate flashcards" })).toBeEnabled();
  });

  it.each([
    { actualCount: 10, shortfall: null, wording: "10 flashcards" },
    { actualCount: 4, shortfall: "Your notes only supported four distinct cards.", wording: "4 flashcards" },
    { actualCount: 1, shortfall: "", wording: "1 flashcard" },
  ])("announces success with $wording and refreshes once", async ({ actualCount, shortfall, wording }) => {
    const user = userEvent.setup();
    fetchMock.mockResolvedValue(Response.json({ deckId: "deck-1", requestedCount: 10, actualCount, shortfall }, { status: 201 }));
    render(<FlashcardGenerator {...props} />);
    await user.click(screen.getByRole("button", { name: "Generate flashcards" }));
    const message = await screen.findByText(`Generated ${wording} from your notes.`);
    expect(message.closest('[aria-live="polite"]')).not.toBeNull();
    if (shortfall) expect(screen.getByText(shortfall)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it.each([
    { label: "server message", response: () => Promise.resolve(Response.json({ error: { code: "NO_NOTES", message: "Add notes first." } }, { status: 422 })), message: "Add notes first." },
    { label: "missing error body", response: () => Promise.resolve(Response.json({}, { status: 500 })), message: "Couldn't generate flashcards. Please try again." },
    { label: "null error body", response: () => Promise.resolve(Response.json(null, { status: 500 })), message: "Couldn't generate flashcards. Please try again." },
    { label: "unparsable body", response: () => Promise.resolve(new Response("Unavailable", { status: 503 })), message: "Couldn't generate flashcards. Please try again." },
    { label: "network failure", response: () => Promise.reject(new Error("Offline")), message: "Couldn't generate flashcards. Please try again." },
  ])("shows $label, preserves an existing deck and allows retry without refresh", async ({ response, message }) => {
    const user = userEvent.setup();
    fetchMock.mockImplementation(response);
    render(<FlashcardGenerator {...props} hasExistingDeck />);
    await user.click(screen.getByRole("button", { name: "Generate a new deck" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(message);
    expect(screen.getByText("Your existing deck was kept.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Generate a new deck" })).toBeEnabled();
    expect(refresh).not.toHaveBeenCalled();
    fetchMock.mockResolvedValue(Response.json({ deckId: "deck-2", requestedCount: 10, actualCount: 10, shortfall: null }, { status: 201 }));
    await user.click(screen.getByRole("button", { name: "Generate a new deck" }));
    expect(await screen.findByText("Generated 10 flashcards from your notes.")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Your existing deck was kept.")).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("does not claim an existing deck was kept when there was none", async () => {
    const user = userEvent.setup();
    fetchMock.mockRejectedValue(new Error("Offline"));
    render(<FlashcardGenerator {...props} />);
    await user.click(screen.getByRole("button", { name: "Generate flashcards" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't generate flashcards. Please try again.");
    expect(screen.queryByText("Your existing deck was kept.")).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
