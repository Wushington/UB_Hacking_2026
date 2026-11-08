import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emptyDashboard, type DashboardView } from "@/lib/dashboard/view";
import { DashboardScreen } from "./dashboard-screen";

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: false, user: null }),
  useClerk: () => ({ openUserProfile: vi.fn(), signOut: vi.fn() }),
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}));

const LECTURE = "0b6f5c2a-9d3e-4f1a-8c7b-2e1d0f9a8b7c";

const fullView: DashboardView = {
  signedIn: true,
  firstName: "Ada",
  stats: { quizAccuracy: 74, notesSaved: 3, quizzesTaken: 2, streakDays: 4 },
  classes: [{ id: "c1", name: "Organic Chemistry", noteCount: 3 }],
  recentNotes: [{ id: LECTURE, title: "Stereochemistry", className: "Organic Chemistry", source: "Whiteboard", dayLabel: "Today" }],
  weakConcepts: [{ id: "w1", label: "Chirality centers", detail: "Stereochemistry · Missed on 2 flashcards" }],
  weakConceptCount: 1,
};

describe("DashboardScreen", () => {
  it("shows the logo linking home and the main navigation", () => {
    render(<DashboardScreen view={fullView} />);
    const header = screen.getByRole("banner");
    const brand = within(header).getByRole("link", { name: /orbit study/i });
    expect(brand).toHaveAttribute("href", "/");
    expect(within(brand).getByRole("img", { name: /orbit study logo/i })).toHaveAttribute("src", expect.stringContaining("orbit-study-logo.svg"));

    const nav = screen.getByRole("navigation", { name: "Main" });
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
    expect(within(nav).getByRole("link", { name: "Weak concepts" })).toHaveAttribute("href", "/weak-concepts");
    // No routes exist yet for classes or quizzes: they are labelled, not dead links.
    expect(within(nav).queryByRole("link", { name: /my classes|quizzes/i })).toBeNull();
    expect(within(nav).getByText("My classes").closest("[aria-disabled]")).toHaveAttribute("aria-disabled", "true");
  });

  it("renders the user's own data", () => {
    render(<DashboardScreen view={fullView} />);
    expect(screen.getByRole("heading", { level: 1, name: /ada/i })).toBeInTheDocument();
    expect(screen.getByText("74%")).toBeInTheDocument();
    expect(screen.getByText("4-day study streak")).toBeInTheDocument();
    expect(screen.getByText("Organic Chemistry", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^stereochemistry/i })).toHaveAttribute("href", `/lectures/${LECTURE}/study`);
    expect(screen.getByRole("link", { name: /generate quiz/i })).toHaveAttribute("href", `/lectures/${LECTURE}/study`);
    expect(screen.getByRole("link", { name: /chirality centers/i })).toHaveAttribute("href", "/weak-concepts");
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

  it("labels every control and marks unbuilt features as coming soon", () => {
    render(<DashboardScreen view={fullView} />);
    for (const name of [/search/i, /notifications/i, /upload whiteboard photo/i, /upload lecture audio/i]) {
      const control = screen.getByRole("button", { name });
      expect(control).toBeDisabled();
      expect(control).toHaveAccessibleName(/coming soon/i);
    }
    for (const button of screen.getAllByRole("button")) expect(button).toHaveAccessibleName();
    for (const link of screen.getAllByRole("link")) expect(link).toHaveAccessibleName();
  });

  it("shows the learning loop", () => {
    render(<DashboardScreen view={fullView} />);
    const loop = screen.getByRole("list", { name: /learning loop/i });
    expect(within(loop).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Capture a class",
      "Organize notes",
      "Take a quiz",
      "Find the gaps",
      "Explain & improve",
    ]);
  });
});
