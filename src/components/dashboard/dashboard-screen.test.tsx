import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { emptyDashboard, type DashboardView } from "@/lib/dashboard/view";
import { DashboardScreen } from "./dashboard-screen";

const LECTURE = "0b6f5c2a-9d3e-4f1a-8c7b-2e1d0f9a8b7c";

const fullView: DashboardView = {
  signedIn: true,
  firstName: "Ada",
  stats: { quizAccuracy: 74, notesSaved: 3, quizzesTaken: 2, streakDays: 4 },
  classes: [{ id: "c1", name: "Organic Chemistry", noteCount: 3 }],
  recentNotes: [{ id: LECTURE, title: "Stereochemistry", className: "Organic Chemistry", source: "Handwritten", dayLabel: "Today" }],
  weakConcepts: [{ id: "w1", label: "Chirality centers", detail: "Stereochemistry · Missed on 2 flashcards" }],
  weakConceptCount: 1,
};

describe("DashboardScreen", () => {
  it("renders only page content; the site shell owns the navbar, footer and background", () => {
    const { container } = render(<DashboardScreen view={fullView} />);
    expect(screen.queryByRole("banner")).toBeNull();
    expect(screen.queryByRole("contentinfo")).toBeNull();
    expect(screen.queryByRole("main")).toBeNull();
    expect(container.querySelector("[data-star]")).toBeNull();
  });

  it("renders the user's own data", () => {
    render(<DashboardScreen view={fullView} />);
    expect(screen.getByRole("heading", { level: 1, name: /ada/i })).toBeInTheDocument();
    expect(screen.getByText("74%")).toBeInTheDocument();
    expect(screen.getByText("4-day study streak")).toBeInTheDocument();
    expect(screen.getByText("Organic Chemistry", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^stereochemistry/i })).toHaveAttribute("href", `/lectures/${LECTURE}/study`);
    expect(screen.getByRole("link", { name: /generate quiz/i })).toHaveAttribute("href", `/lectures/${LECTURE}/study`);
    expect(screen.getByRole("link", { name: /chirality centers/i })).toHaveAttribute("href", "/explain");
    expect(screen.getByRole("link", { name: /explain this concept/i })).toHaveAttribute("href", "/explain");
  });

  it("shows honest empty states for a new user, with no sample data", () => {
    const { container } = render(<DashboardScreen view={{ ...emptyDashboard(true), firstName: "Ada" }} />);
    expect(screen.getByText(/no quizzes yet/i)).toBeInTheDocument();
    expect(screen.getByText(/upload your first lecture/i)).toBeInTheDocument();
    expect(screen.getByText(/missed questions and explanation feedback will appear here/i)).toBeInTheDocument();
    expect(screen.queryByText(/study streak/i)).toBeNull();
    expect(screen.queryByRole("link", { name: /generate quiz/i })).toBeNull();
    for (const filler of [/jamie/i, /82%/, /cell biology/i, /BIO 201/]) expect(container.textContent).not.toMatch(filler);
  });

  it("asks signed-out visitors to sign in instead of greeting a user", () => {
    render(<DashboardScreen view={emptyDashboard(false)} />);
    expect(screen.getByRole("heading", { level: 1 })).not.toHaveTextContent(/,\s*\w+\./);
    expect(screen.getAllByText(/sign in/i).length).toBeGreaterThan(0);
  });

  it("links photo capture and all subjects, and marks unbuilt audio capture as coming soon", () => {
    render(<DashboardScreen view={fullView} />);
    expect(screen.getByRole("link", { name: /upload handwritten notes/i })).toHaveAttribute("href", "/capture");
    expect(screen.getByRole("link", { name: /view all subjects/i })).toHaveAttribute("href", "/subjects");
    const audio = screen.getByRole("button", { name: /upload lecture audio/i });
    expect(audio).toBeDisabled();
    expect(audio).toHaveAccessibleName(/coming soon/i);
    for (const button of screen.getAllByRole("button")) expect(button).toHaveAccessibleName();
    for (const link of screen.getAllByRole("link")) expect(link).toHaveAccessibleName();
  });
});
