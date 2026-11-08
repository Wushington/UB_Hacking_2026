import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SiteShell } from "./site-shell";

const nav = vi.hoisted(() => ({ pathname: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: false, user: null }),
  useClerk: () => ({ openUserProfile: vi.fn(), signOut: vi.fn() }),
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}));

function renderShell(pathname: string) {
  nav.pathname = pathname;
  return render(
    <SiteShell>
      <p>Page content</p>
    </SiteShell>,
  );
}

describe("SiteShell", () => {
  beforeEach(() => {
    nav.pathname = "/";
  });

  it.each(["/sign-in", "/sign-up/verify-email-address", "/forgot-password", "/sso-callback", "/auth/factor-one"])(
    "leaves %s to the sign-in design: no site navbar, footer or star field",
    (pathname) => {
      const { container } = renderShell(pathname);
      expect(within(screen.getByRole("main")).getByText("Page content")).toBeInTheDocument();
      expect(screen.queryByRole("banner")).toBeNull();
      expect(screen.queryByRole("contentinfo")).toBeNull();
      expect(container.querySelectorAll("[data-star]")).toHaveLength(0);
    },
  );

  it("wraps every page in one navbar, main region, footer and starry background", () => {
    const { container } = renderShell("/capture");
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(within(screen.getByRole("main")).getByText("Page content")).toBeInTheDocument();
    expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
    expect(container.querySelectorAll("[data-star]")).toHaveLength(66);
  });

  it("leaves the workflow to the dashboard on the home page", () => {
    renderShell("/");
    expect(screen.queryByRole("contentinfo")).toBeNull();
  });

  it("shows the logo linking home", () => {
    renderShell("/");
    const brand = within(screen.getByRole("banner")).getByRole("link", { name: /orbit study/i });
    expect(brand).toHaveAttribute("href", "/");
    expect(within(brand).getByRole("img", { name: /orbit study logo/i })).toHaveAttribute("src", expect.stringContaining("orbit-study-logo.svg"));
  });

  it.each([
    ["/", "Home"],
    ["/weak-concepts", "Weak Concepts"],
    ["/explain", "Weak Concepts"],
    ["/subjects", "My Subjects"],
    ["/capture", "Capture Notes"],
    ["/lectures/abc", "My Subjects"],
    ["/quizzes", "Flashcards"],
    ["/lectures/abc/study", "Flashcards"],
  ])("marks the current section on %s", (pathname, label) => {
    renderShell(pathname);
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    expect(within(main).getAllByRole("link").filter((l) => l.getAttribute("aria-current"))).toHaveLength(1);
  });

  it("labels unbuilt sections and controls as coming soon instead of linking nowhere", () => {
    renderShell("/");
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { name: "My Subjects" })).toHaveAttribute("href", "/subjects");
    expect(within(main).getByRole("link", { name: "Flashcards" })).toHaveAttribute("href", "/quizzes");
    for (const name of [/search/i, /notifications/i]) {
      const control = screen.getByRole("button", { name });
      expect(control).toBeDisabled();
      expect(control).toHaveAccessibleName(/coming soon/i);
    }
  });

  // Page sections animate in with a lasting transform, which stacks them above an unpositioned header,
  // so the account menu (Sign out) would open underneath them and swallow the click.
  it("stacks the navbar above page content so its menus open on top", () => {
    renderShell("/");
    expect(screen.getByRole("banner")).toHaveClass("relative", "z-40");
  });

  it("links Weak Concepts to the weak concepts list", () => {
    renderShell("/");
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { name: "Weak Concepts" })).toHaveAttribute("href", "/weak-concepts");
  });

  it("links Flashcards to the flashcard decks page", () => {
    renderShell("/");
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { name: "Flashcards" })).toHaveAttribute("href", "/quizzes");
  });

  it("links Capture Notes in the main navigation", () => {
    renderShell("/");
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { name: "Capture Notes" })).toHaveAttribute("href", "/capture");
  });

  it("never calls flashcards quizzes in the navigation or footer", () => {
    renderShell("/quizzes");
    expect(screen.getByRole("banner").textContent).not.toMatch(/quiz/i);
    expect(screen.getByRole("contentinfo").textContent).not.toMatch(/quiz/i);
  });

  it("shows the study workflow in the footer and highlights the current step", () => {
    renderShell("/explain");
    const loop = within(screen.getByRole("contentinfo")).getByRole("list", { name: "Study workflow" });
    expect(within(loop).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "1. Upload Notes→",
      "2. Generate Flashcards→",
      "3. Study→",
      "4. Review Weak Concepts",
    ]);
    expect(within(loop).getByText("Review Weak Concepts", { exact: false }).closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByRole("contentinfo").textContent).not.toMatch(/it all connects/i);
  });

  it.each([
    ["/capture", "Upload Notes"],
    ["/lectures/abc", "Generate Flashcards"],
    ["/quizzes", "Study"],
    ["/lectures/abc/study", "Study"],
    ["/weak-concepts", "Review Weak Concepts"],
  ])("highlights the workflow step for %s", (pathname, step) => {
    renderShell(pathname);
    const loop = within(screen.getByRole("contentinfo")).getByRole("list", { name: "Study workflow" });
    const current = within(loop).getAllByRole("listitem").filter((li) => li.getAttribute("aria-current") === "step");
    expect(current.map((li) => li.textContent)).toEqual([expect.stringContaining(step)]);
  });
});
