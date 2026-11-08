import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { emptyDashboard, type DashboardView } from "@/lib/dashboard/view";
import { DashboardScreen } from "./dashboard-screen";

const LECTURE = "0b6f5c2a-9d3e-4f1a-8c7b-2e1d0f9a8b7c";

const fullView: DashboardView = {
  signedIn: true,
  firstName: "Ada",
  stats: { quizAccuracy: 74, notesSaved: 3, quizzesTaken: 2, streakDays: 4, decksGenerated: 1 },
  classes: [{ id: "c1", name: "Organic Chemistry", noteCount: 3 }],
  recentNotes: [{ id: LECTURE, title: "Stereochemistry", className: "Organic Chemistry", source: "Handwritten", dayLabel: "Today", hasFlashcards: true }],
  weakConcepts: [{ id: "w1", label: "Chirality centers", detail: "Stereochemistry · Missed on 2 flashcards" }],
  weakConceptCount: 1,
};
const newUser: DashboardView = { ...emptyDashboard(true), firstName: "Ada" };
const notesOnly: DashboardView = {
  ...fullView,
  stats: { quizAccuracy: null, notesSaved: 1, quizzesTaken: 0, streakDays: 0, decksGenerated: 0 },
  recentNotes: [{ ...fullView.recentNotes[0], hasFlashcards: false }],
  weakConcepts: [],
  weakConceptCount: 0,
};

const steps = () => within(screen.getByRole("list", { name: "Study workflow" })).getAllByRole("listitem");

describe("DashboardScreen", () => {
  it("renders only page content; the site shell owns the navbar, footer and background", () => {
    const { container } = render(<DashboardScreen view={fullView} />);
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
    expect(screen.queryByRole("main")).toBeNull();
    expect(container.querySelector("[data-star]")).toBeNull();
  });

  it("greets returning users by name and first-time users without 'back'", () => {
    const { unmount } = render(<DashboardScreen view={fullView} />);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome back, Ada." })).toBeInTheDocument();
    unmount();
    render(<DashboardScreen view={newUser} />);
    expect(screen.getByRole("heading", { level: 1, name: "Welcome, Ada." })).toBeInTheDocument();
  });

  it("uses functional headings, in priority order", () => {
    render(<DashboardScreen view={fullView} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual([
      "Capture Notes",
      "Recent Notes",
      "Study Flashcards",
      "Weak Concepts",
      "Explain a Concept",
      "Study Progress",
      "My Subjects",
    ]);
  });

  it("has no decorative copy, sign-up link or 'quiz' wording", () => {
    const { container } = render(<DashboardScreen view={fullView} />);
    for (const text of [/your space to understand/i, /small sessions/i, /less transcribing/i, /wrong answer/i, /make it click/i, /little challenge/i, /pick up where/i, /no pressure/i, /quiz/i, /back to sign up/i]) {
      expect(container.textContent).not.toMatch(text);
    }
    expect(screen.queryByRole("link", { name: /sign up/i })).toBeNull();
  });

  it("makes uploading photos the one dominant action", () => {
    render(<DashboardScreen view={fullView} />);
    const upload = screen.getByRole("link", { name: "Upload Whiteboard Photos" });
    expect(upload).toHaveAttribute("href", "/capture");
    expect(upload).toHaveClass("bg-orbit-accent");
    const solid = [...screen.getAllByRole("link"), ...screen.getAllByRole("button")].filter((el) => el.classList.contains("bg-orbit-accent"));
    expect(solid).toEqual([upload]);
    expect(screen.getByText(/JPG, PNG or HEIC/)).toBeInTheDocument();
  });

  it("keeps unbuilt audio capture visible as a disabled, coming-soon secondary option", () => {
    render(<DashboardScreen view={fullView} />);
    const audio = screen.getByRole("button", { name: /upload lecture audio/i });
    expect(audio).toBeDisabled();
    expect(audio).toHaveAccessibleName(/coming soon/i);
    for (const button of screen.getAllByRole("button")) expect(button).toHaveAccessibleName();
    for (const link of screen.getAllByRole("link")) expect(link).toHaveAccessibleName();
  });

  it("shows the workflow in order and marks steps from real progress", () => {
    render(<DashboardScreen view={newUser} />);
    expect(steps().map((li) => li.textContent)).toEqual(["1Upload Notes", "2Generate Flashcards", "3Study", "4Review Weak Concepts"]);
    expect(steps()[0]).toHaveAttribute("aria-current", "step");
  });

  it("advances the workflow as the user progresses", () => {
    const { unmount } = render(<DashboardScreen view={notesOnly} />);
    expect(steps()[0]).toHaveTextContent("Completed");
    expect(steps()[1]).toHaveAttribute("aria-current", "step");
    unmount();
    render(<DashboardScreen view={fullView} />);
    expect(steps().filter((li) => li.getAttribute("aria-current"))).toEqual([steps()[3]]);
  });

  it("links recent notes to the notes, with subject and date", () => {
    render(<DashboardScreen view={fullView} />);
    const note = screen.getByRole("link", { name: /^stereochemistry/i });
    expect(note).toHaveAttribute("href", `/lectures/${LECTURE}`);
    expect(note).toHaveTextContent("Organic Chemistry · Handwritten · Today");
  });

  it("offers Generate Flashcards when the latest notes have no deck", () => {
    render(<DashboardScreen view={notesOnly} />);
    expect(screen.getByRole("link", { name: "Generate Flashcards" })).toHaveAttribute("href", `/lectures/${LECTURE}/study`);
    expect(screen.queryByRole("link", { name: "Continue Studying" })).toBeNull();
  });

  it("offers Continue Studying and View Flashcards when a deck exists", () => {
    render(<DashboardScreen view={fullView} />);
    expect(screen.getByRole("link", { name: "Continue Studying" })).toHaveAttribute("href", `/lectures/${LECTURE}/study`);
    expect(screen.getByRole("link", { name: "View Flashcards" })).toHaveAttribute("href", "/quizzes");
    expect(screen.queryByRole("link", { name: "Generate Flashcards" })).toBeNull();
  });

  it("links weak concepts to practising that concept and to the full list", () => {
    render(<DashboardScreen view={fullView} />);
    expect(screen.getByRole("link", { name: /chirality centers/i })).toHaveAttribute("href", "/explain?concept=w1");
    expect(screen.getByRole("link", { name: "Review Weak Concepts" })).toHaveAttribute("href", "/weak-concepts");
    expect(screen.getByRole("link", { name: "Record Explanation" })).toHaveAttribute("href", "/explain?concept=w1");
  });

  it("shows real study statistics with low emphasis", () => {
    render(<DashboardScreen view={fullView} />);
    expect(screen.getByText("74%")).toBeInTheDocument();
    expect(screen.getByText("Flashcard accuracy")).toBeInTheDocument();
    expect(screen.getByText("Saved notes")).toBeInTheDocument();
    expect(screen.getByText("Completed sessions")).toBeInTheDocument();
    expect(screen.getByText("4-day study streak")).toBeInTheDocument();
    expect(screen.getByText("Organic Chemistry", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View All Subjects" })).toHaveAttribute("href", "/subjects");
  });

  it("doesn't invent an accuracy before any study session", () => {
    render(<DashboardScreen view={notesOnly} />);
    expect(screen.getByText("Flashcard accuracy").closest("div")).toHaveTextContent("No data");
    expect(screen.queryByText(/%/)).toBeNull();
  });

  it("keeps a first-time dashboard short, with honest empty states and no sample data", () => {
    const { container } = render(<DashboardScreen view={newUser} />);
    expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    expect(screen.getByText(/upload notes first/i)).toBeInTheDocument();
    expect(screen.getByText(/no weak concepts yet/i)).toBeInTheDocument();
    expect(screen.getByText(/appear after your first study session/i)).toBeInTheDocument();
    expect(screen.queryByText("Flashcard accuracy")).toBeNull();
    expect(screen.queryByRole("heading", { name: "My Subjects" })).toBeNull();
    expect(screen.queryByText(/study streak/i)).toBeNull();
    expect(screen.queryByRole("link", { name: "Generate Flashcards" })).toBeNull();
    for (const filler of [/jamie/i, /82%/, /cell biology/i, /BIO 201/]) expect(container.textContent).not.toMatch(filler);
  });

  it("asks signed-out visitors to sign in instead of greeting a user", () => {
    render(<DashboardScreen view={emptyDashboard(false)} />);
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent(/,\s*\w+\./);
    expect(screen.getAllByText(/sign in/i).length).toBeGreaterThan(0);
  });
});
