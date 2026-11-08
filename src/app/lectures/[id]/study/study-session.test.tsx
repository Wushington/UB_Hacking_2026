import { StrictMode } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { completeSessionSchema } from "@/contracts/study";
import type { SaveStudyResults } from "@/lib/study/persistence";
import type { StudyCard } from "@/lib/study/session";
import { StudySessionView } from "./study-session";

const cards: StudyCard[] = [1, 2, 3].map((n) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  question: `Question ${n}?`, answer: `Answer ${n}.`, conceptLabel: `Concept ${n}`,
}));
const props = { deckTitle: "Test deck", subtitle: "Biology", cards, random: () => 0.99, isSample: true };
const unsaved = "Sample sessions aren't saved. Sign in and open one of your decks to track results.";

async function finish(user: ReturnType<typeof userEvent.setup>, total = 3) {
  for (let i = 0; i < total; i++) {
    await user.click(screen.getByRole("button", { name: "Reveal Answer" }));
    await user.click(screen.getByRole("button", { name: i === 1 ? "Missed" : "Got It" }));
  }
}

describe("study session view", () => {
  it("shows one question, hides the answer and disables grading until reveal", () => {
    render(<StudySessionView {...props} />);
    expect(screen.getByRole("heading", { level: 2, name: "Question 1?" })).toBeInTheDocument();
    expect(screen.queryByText("Question 2?")).not.toBeInTheDocument();
    expect(screen.queryByText("Answer 1.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Got It" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Missed" })).toBeDisabled();
    expect(screen.getByText("Sample deck")).toBeInTheDocument();
  });

  it("reveals, enables grading, advances and hides the next answer", async () => {
    const user = userEvent.setup();
    render(<StudySessionView {...props} />);
    await user.click(screen.getByRole("button", { name: "Reveal Answer" }));
    expect(screen.getByText("Answer 1.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reveal Answer" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Missed" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Got It" }));
    expect(screen.getByText("Question 2?")).toBeInTheDocument();
    expect(screen.getByText("1 graded")).toBeInTheDocument();
    expect(screen.queryByText("Answer 2.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Got It" })).toBeDisabled();
  });

  it("records one result on a double click without skipping a card", async () => {
    const user = userEvent.setup();
    render(<StudySessionView {...props} />);
    await user.click(screen.getByRole("button", { name: "Reveal Answer" }));
    await user.dblClick(screen.getByRole("button", { name: "Got It" }));
    expect(screen.getByText("1 graded")).toBeInTheDocument();
    expect(screen.getByText("Question 2?")).toBeInTheDocument();
  });

  it("uses functional headings and offers help while studying", () => {
    const { container } = render(<StudySessionView {...props} />);
    expect(screen.getByRole("heading", { level: 1, name: "Study Flashcards" })).toBeInTheDocument();
    expect(screen.getByText("Test deck · Biology")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "How It Works" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/sticking|no pressure|a missed card is useful|quiz/i);
  });

  it("titles the finished screen Study Results without decorative copy or help", async () => {
    const user = userEvent.setup();
    const { container } = render(<StudySessionView {...props} />);
    await finish(user);
    expect(screen.getByRole("heading", { level: 1, name: "Study Results" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "How It Works" })).toBeNull();
    expect(container.textContent).not.toMatch(/a little clearer|a closer look/i);
  });

  it("points to Weak Concepts after saving a session with missed cards", async () => {
    const user = userEvent.setup();
    render(<StudySessionView {...props} isSample={false} onComplete={vi.fn().mockResolvedValue(undefined)} />);
    await finish(user);
    expect(screen.getByRole("link", { name: "Review Weak Concepts" })).toHaveAttribute("href", "/weak-concepts");
  });

  it("doesn't point to Weak Concepts from a sample deck, which saves nothing", async () => {
    const user = userEvent.setup();
    render(<StudySessionView {...props} />);
    await finish(user);
    expect(screen.queryByRole("link", { name: "Review Weak Concepts" })).toBeNull();
  });

  it("shows counts, rounded score and ordered per-card review without claiming a save", async () => {
    const user = userEvent.setup();
    render(<StudySessionView {...props} />);
    await finish(user);
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText("2 correct out of 3 cards")).toBeInTheDocument();
    expect(screen.getByText("2 got it")).toBeInTheDocument();
    expect(screen.getByText("1 missed")).toBeInTheDocument();
    const rows = within(screen.getByRole("list")).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    rows.forEach((row, i) => {
      expect(within(row).getByText(new RegExp(`Question ${i + 1}\\?`))).toBeInTheDocument();
      expect(within(row).getByText(`Answer ${i + 1}.`)).toBeInTheDocument();
    });
    expect(screen.getByText(unsaved)).toBeInTheDocument();
    expect(screen.queryByText("Saved", { exact: true })).not.toBeInTheDocument();
  });

  it("restarts with a new shuffle and empty results", async () => {
    const user = userEvent.setup();
    const random = vi.fn(() => 0.99);
    render(<StudySessionView {...props} random={random} />);
    await finish(user);
    random.mockReturnValue(0);
    await user.click(screen.getByRole("button", { name: "Study Again" }));
    expect(screen.getByText("Card 1 of 3")).toBeInTheDocument();
    expect(screen.getByText("0 graded")).toBeInTheDocument();
    expect(screen.getByText("Question 2?")).toBeInTheDocument();
    expect(screen.queryByText("Answer 2.")).not.toBeInTheDocument();
  });

  it("shows an empty state without study controls or saving", () => {
    const onComplete = vi.fn();
    render(<StudySessionView {...props} cards={[]} onComplete={onComplete} />);
    expect(screen.getByText("No flashcards in this deck yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("saves a schema-valid payload once per session in StrictMode and shows saving then saved", async () => {
    const user = userEvent.setup();
    let resolve!: () => void;
    const onComplete = vi.fn<SaveStudyResults>(() => new Promise<void>((done) => { resolve = done; }));
    const { rerender } = render(<StrictMode><StudySessionView {...props} onComplete={onComplete} /></StrictMode>);
    await finish(user);
    expect(screen.getByText("Saving…")).toBeInTheDocument();
    rerender(<StrictMode><StudySessionView {...props} onComplete={onComplete} /></StrictMode>);
    expect(onComplete).toHaveBeenCalledTimes(1);
    const payload = onComplete.mock.calls[0][0];
    expect(completeSessionSchema.parse(payload)).toEqual({ results: cards.map((card, i) => ({ flashcardId: card.id, result: i === 1 ? "missed" : "got_it" })) });
    await act(async () => resolve());
    expect(screen.getByText("Saved", { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Study Again" }));
    await finish(user);
    expect(onComplete).toHaveBeenCalledTimes(2);
    await act(async () => resolve());
  });

  it("shows a save error and retries the same payload", async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn().mockRejectedValueOnce(new Error("Offline")).mockResolvedValueOnce(undefined);
    render(<StudySessionView {...props} onComplete={onComplete} />);
    await finish(user);
    expect(await screen.findByText("Couldn't save this session. Please try again.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try Again" }));
    expect(await screen.findByText("Saved", { exact: true })).toBeInTheDocument();
    expect(onComplete).toHaveBeenCalledTimes(2);
    expect(onComplete.mock.calls[1][0]).toEqual(onComplete.mock.calls[0][0]);
  });

  it("ignores an old save response after restarting", async () => {
    const user = userEvent.setup();
    let reject!: (error: Error) => void;
    const onComplete = vi.fn<SaveStudyResults>(() => new Promise<void>((_, fail) => { reject = fail; }));
    render(<StudySessionView {...props} onComplete={onComplete} />);
    await finish(user);
    await user.click(screen.getByRole("button", { name: "Study Again" }));
    await act(async () => reject(new Error("Old request")));
    expect(screen.getByText("0 graded")).toBeInTheDocument();
    expect(screen.queryByText("Couldn't save this session. Please try again.")).not.toBeInTheDocument();
  });
});
