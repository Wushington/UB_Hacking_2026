import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { QuizzesList } from "./quizzes-list";

describe("QuizzesList", () => {
  it("explains what to do when there are no notes", () => {
    render(<QuizzesList quizzes={[]} />);
    expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
  });

  it("links an empty page to Capture Notes", () => {
    render(<QuizzesList quizzes={[]} />);
    expect(screen.getByRole("link", { name: "Capture Notes" })).toHaveAttribute("href", "/capture");
  });

  it("offers Start Studying for a deck that hasn't been studied", () => {
    render(<QuizzesList quizzes={[{ lectureId: "l1", title: "Cells", cardCount: 8, sessionCount: 0, lastScore: null }]} />);
    expect(screen.getByRole("link", { name: "Start Studying" })).toHaveAttribute("href", "/lectures/l1/study");
  });

  it("links each lecture to its study page with deck stats", () => {
    render(
      <QuizzesList
        quizzes={[
          { lectureId: "l1", title: "Cells", cardCount: 8, sessionCount: 2, lastScore: 75 },
          { lectureId: "l2", title: "Genetics", cardCount: null, sessionCount: 0, lastScore: null },
        ]}
      />,
    );
    const [cells, genetics] = screen.getAllByRole("listitem");
    expect(within(cells).getByText("8 cards")).toBeInTheDocument();
    expect(within(cells).getByText("Studied 2 times")).toBeInTheDocument();
    expect(within(cells).getByText("Last score 75%")).toBeInTheDocument();
    expect(within(cells).getByRole("link", { name: "Continue Studying" })).toHaveAttribute("href", "/lectures/l1/study");
    expect(within(genetics).getByText("No flashcards yet")).toBeInTheDocument();
    expect(within(genetics).getByRole("link", { name: "Generate Flashcards" })).toHaveAttribute("href", "/lectures/l2/study");
  });
});
