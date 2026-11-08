import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClassesScreen } from "./classes-screen";

const id = (n: number) => `8a3f1d2e-4b5c-4d6e-8f70-${String(n).padStart(12, "0")}`;
const at = new Date("2026-11-07T15:00:00Z");

describe("ClassesScreen", () => {
  it("lists each class's notes with links to the notes and, when ready, flashcards", () => {
    render(
      <ClassesScreen
        signedIn
        lectures={[
          { id: id(1), title: "Cellular respiration", status: "ready", updatedAt: at, categoryId: id(9), categoryName: "Cell Biology" },
          { id: id(2), title: "Untitled class", status: "failed", updatedAt: at, categoryId: null, categoryName: null },
        ]}
      />,
    );
    const bio = screen.getByRole("region", { name: "Cell Biology" });
    expect(within(bio).getByRole("link", { name: /cellular respiration/i })).toHaveAttribute("href", `/lectures/${id(1)}`);
    expect(within(bio).getByRole("link", { name: "Flashcards" })).toHaveAttribute("href", `/lectures/${id(1)}/study`);

    const none = screen.getByRole("region", { name: "No class yet" });
    expect(within(none).getByText("Needs another try")).toBeInTheDocument();
    expect(within(none).queryByRole("link", { name: "Flashcards" })).toBeNull();
    expect(screen.getByRole("link", { name: /capture a class/i })).toHaveAttribute("href", "/capture");
  });

  it("shows an empty state, and a sign-in prompt when signed out", () => {
    const { unmount } = render(<ClassesScreen signedIn lectures={[]} />);
    expect(screen.getByText(/no classes yet/i)).toBeInTheDocument();
    unmount();
    render(<ClassesScreen signedIn={false} lectures={[]} />);
    expect(screen.getByText(/sign in to see your classes/i)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /capture a class/i })).toBeNull();
  });
});
