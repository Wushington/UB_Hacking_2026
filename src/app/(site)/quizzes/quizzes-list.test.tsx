import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { QuizRow } from "@/lib/quizzes/view";
import { QuizzesList } from "./quizzes-list";

const at = (d: number) => new Date(Date.UTC(2026, 10, d));
const deck = (id: string, categoryId: string | null, d: number, stats: Partial<QuizRow> = {}): QuizRow => ({
  id,
  title: `Deck ${id}`,
  status: "ready",
  updatedAt: at(d),
  categoryId,
  categoryName: categoryId,
  cardCount: 6,
  sessionCount: 0,
  lastScore: null,
  ...stats,
});

const dividers = [
  { id: "spring", name: "Spring 2027", position: 1, collapsed: false },
  { id: "fall", name: "Fall 2026", position: 0, collapsed: true },
  { id: "empty", name: "Study Abroad", position: 2, collapsed: false },
  { id: "notes-only", name: "Summer", position: 3, collapsed: false },
];
const subjects = [
  { id: "algo", name: "CSE 250", dividerId: "fall" },
  { id: "ds", name: "CSE 116", dividerId: "fall" },
  { id: "sys", name: "CSE 220", dividerId: "spring" },
  { id: "art", name: "Art History", dividerId: null },
  { id: "no-notes", name: "Physics", dividerId: "fall" },
  { id: "summer", name: "Statistics", dividerId: "notes-only" },
];
const quizzes = [
  deck("hash", "ds", 9, { cardCount: 8, sessionCount: 2, lastScore: 75 }),
  deck("sort", "algo", 8, { cardCount: null }),
  deck("stacks", "ds", 7),
  deck("ptr", "sys", 6),
  deck("paint", "art", 5),
  deck("loose", null, 4),
  deck("prob", "summer", 3, { cardCount: null }),
];

const renderList = (props: Partial<Parameters<typeof QuizzesList>[0]> = {}) => render(<QuizzesList quizzes={quizzes} subjects={subjects} dividers={dividers} {...props} />);
const selector = () => screen.getByRole("group", { name: "Filter flashcards by divider" });
const option = (name: string) => within(selector()).getByRole("button", { name });
const select = (name: string) => userEvent.setup().click(option(name));
const subject = (name: string) => screen.getByRole("region", { name });
const deckTitles = (name: string) => within(subject(name)).queryAllByRole("heading", { level: 4 }).map((h) => h.textContent);

afterEach(() => vi.unstubAllGlobals());

describe("QuizzesList", () => {
  describe("selector", () => {
    it("offers All, Unorganized and the saved dividers in My Subjects order", () => {
      renderList();
      expect(within(selector()).getAllByRole("button").map((b) => b.textContent)).toEqual(["All", "Unorganized", "Fall 2026", "Spring 2027", "Study Abroad", "Summer"]);
    });

    it("starts on All and marks only the selected option", async () => {
      renderList();
      expect(option("All")).toHaveAttribute("aria-pressed", "true");
      await select("Spring 2027");
      expect(option("Spring 2027")).toHaveAttribute("aria-pressed", "true");
      expect(option("All")).toHaveAttribute("aria-pressed", "false");
    });

    it("can be operated from the keyboard", async () => {
      renderList();
      const user = userEvent.setup();
      await user.tab();
      await user.tab();
      await user.tab();
      expect(option("Fall 2026")).toHaveFocus();
      await user.keyboard("{Enter}");
      expect(option("Fall 2026")).toHaveAttribute("aria-pressed", "true");
    });

    it("truncates long names but keeps them available, and scrolls sideways on small screens", () => {
      const long = "A very long divider name that a student might reasonably type";
      renderList({ dividers: [{ id: "fall", name: long, position: 0, collapsed: false }] });
      expect(option(long)).toHaveClass("truncate");
      expect(option(long)).toHaveAttribute("title", long);
      expect(selector()).toHaveClass("overflow-x-auto");
    });

    it("is left out when the student has no dividers", () => {
      renderList({ dividers: [], subjects: subjects.map((s) => ({ ...s, dividerId: null })) });
      expect(screen.queryByRole("group", { name: "Filter flashcards by divider" })).toBeNull();
      expect(deckTitles("CSE 116")).toEqual(["Deck hash", "Deck stacks"]);
      expect(screen.getByRole("heading", { level: 2, name: "Unorganized" })).toHaveClass("sr-only");
    });

    it("omits Unorganized when everything is under a divider", () => {
      renderList({ quizzes: quizzes.filter((q) => q.categoryId && q.categoryId !== "art"), subjects: subjects.filter((s) => s.dividerId) });
      expect(within(selector()).queryByRole("button", { name: "Unorganized" })).toBeNull();
    });
  });

  describe("filtering", () => {
    it("shows only the selected divider's subjects and decks", async () => {
      renderList();
      await select("Fall 2026");
      expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["CSE 116", "CSE 250", "Physics"]);
      expect(screen.queryByText("Deck ptr")).toBeNull();
      expect(screen.queryByText("Deck loose")).toBeNull();
    });

    it("shows every group under All, in My Subjects order, skipping dividers with no subjects", () => {
      renderList();
      expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Unorganized", "Fall 2026", "Spring 2027", "Summer"]);
      expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["No Subject", "Art History", "CSE 116", "CSE 250", "Physics", "CSE 220", "Statistics"]);
    });

    it("returns to everything when All is selected again", async () => {
      renderList();
      await select("Spring 2027");
      await select("All");
      expect(screen.getByText("Deck hash")).toBeInTheDocument();
      expect(screen.getByText("Deck ptr")).toBeInTheDocument();
    });

    it("keeps subjects without a divider reachable", async () => {
      renderList();
      await select("Unorganized");
      expect(deckTitles("Art History")).toEqual(["Deck paint"]);
      expect(screen.queryByText("Deck hash")).toBeNull();
    });

    it("keeps notes without a subject reachable under No Subject", async () => {
      renderList();
      await select("Unorganized");
      expect(deckTitles("No Subject")).toEqual(["Deck loose"]);
    });

    it("keeps decks whose subject's divider was deleted", async () => {
      renderList({ subjects: [{ id: "ds", name: "CSE 116", dividerId: "deleted" }], quizzes: [deck("hash", "ds", 9)], dividers: [dividers[0]] });
      await select("Unorganized");
      expect(deckTitles("CSE 116")).toEqual(["Deck hash"]);
    });

    it("shows a divider's content even if it is collapsed on My Subjects", async () => {
      renderList();
      await select("Fall 2026");
      expect(screen.getByText("Deck hash")).toBeVisible();
    });

    it("changes no saved data when switching dividers", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      renderList();
      await select("Fall 2026");
      await select("Unorganized");
      await select("All");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("announces the result of a filter", async () => {
      renderList();
      await select("Spring 2027");
      expect(screen.getByRole("status")).toHaveTextContent("Showing 1 deck in Spring 2027");
    });
  });

  describe("empty states", () => {
    it("explains an empty divider and links to My Subjects", async () => {
      renderList();
      await select("Study Abroad");
      expect(screen.getByText(/no flashcards in study abroad yet/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "My Subjects" })).toHaveAttribute("href", "/subjects");
      expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
    });

    it("says when a divider has notes but no decks, and still offers Generate", async () => {
      renderList();
      await select("Summer");
      expect(screen.getByText(/no flashcards in summer yet/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Generate Flashcards" })).toHaveAttribute("href", "/lectures/prob/study");
    });

    it("shows a subject with no notes without any statistics", async () => {
      renderList();
      await select("Fall 2026");
      expect(within(subject("Physics")).getByText("No notes in this subject yet.")).toBeInTheDocument();
      expect(within(subject("Physics")).queryByText(/studied|last score/i)).toBeNull();
      expect(within(subject("Physics")).queryByRole("link")).toBeNull();
    });

    it("explains what to do when there are no notes at all", () => {
      renderList({ quizzes: [] });
      expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Capture Notes" })).toHaveAttribute("href", "/capture");
      expect(screen.queryByRole("group", { name: "Filter flashcards by divider" })).toBeNull();
    });
  });

  describe("decks", () => {
    it("lists decks under their subject, newest first", () => {
      renderList();
      expect(deckTitles("CSE 116")).toEqual(["Deck hash", "Deck stacks"]);
      expect(deckTitles("CSE 250")).toEqual(["Deck sort"]);
    });

    it("counts only real decks on the subject", () => {
      renderList();
      expect(within(subject("CSE 116")).getByText("2 decks")).toBeInTheDocument();
      expect(within(subject("CSE 250")).getByText("0 decks")).toBeInTheDocument();
    });

    it("shows saved statistics for a deck", () => {
      renderList();
      const item = within(subject("CSE 116")).getAllByRole("listitem")[0];
      expect(within(item).getByText("8 cards")).toBeInTheDocument();
      expect(within(item).getByText("Studied 2 times")).toBeInTheDocument();
      expect(within(item).getByText("Last score 75%")).toBeInTheDocument();
    });

    it("shows no statistics or score that don't exist", () => {
      renderList();
      const noDeck = within(subject("CSE 250")).getByRole("listitem");
      expect(within(noDeck).getByText("No flashcards yet")).toBeInTheDocument();
      expect(within(noDeck).queryByText(/studied|last score|^\d+ cards?$/i)).toBeNull();
      const unstudied = within(subject("CSE 116")).getAllByRole("listitem")[1];
      expect(within(unstudied).getByText("Not studied yet")).toBeInTheDocument();
      expect(within(unstudied).queryByText(/last score/i)).toBeNull();
    });

    it.each([
      ["Continue Studying", "CSE 116", 0, "hash"],
      ["Start Studying", "CSE 116", 1, "stacks"],
      ["Generate Flashcards", "CSE 250", 0, "sort"],
    ])("links %s to the deck's own lecture", (name, inSubject, index, lectureId) => {
      renderList();
      const item = within(subject(inSubject)).getAllByRole("listitem")[index];
      expect(within(item).getByRole("link", { name })).toHaveAttribute("href", `/lectures/${lectureId}/study`);
    });

    it("gives every study action a full-width, easily tapped target", () => {
      renderList();
      for (const name of ["Continue Studying", "Generate Flashcards"]) {
        expect(screen.getAllByRole("link", { name })[0]).toHaveClass("w-full", "h-11");
      }
    });
  });
});
