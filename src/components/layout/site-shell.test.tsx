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
    const { container } = renderShell("/");
    expect(screen.getAllByRole("banner")).toHaveLength(1);
    expect(within(screen.getByRole("main")).getByText("Page content")).toBeInTheDocument();
    expect(screen.getAllByRole("contentinfo")).toHaveLength(1);
    expect(container.querySelectorAll("[data-star]")).toHaveLength(66);
  });

  it("shows the logo linking home", () => {
    renderShell("/");
    const brand = within(screen.getByRole("banner")).getByRole("link", { name: /orbit study/i });
    expect(brand).toHaveAttribute("href", "/");
    expect(within(brand).getByRole("img", { name: /orbit study logo/i })).toHaveAttribute("src", expect.stringContaining("orbit-study-logo.svg"));
  });

  it.each([
    ["/", "Home"],
    ["/weak-concepts", "Weak concepts"],
    ["/explain", "Weak concepts"],
    ["/quizzes", "Quizzes"],
    ["/lectures/abc/study", "Quizzes"],
  ])("marks the current section on %s", (pathname, label) => {
    renderShell(pathname);
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    expect(within(main).getAllByRole("link").filter((l) => l.getAttribute("aria-current"))).toHaveLength(1);
  });

  it("labels unbuilt sections and controls as coming soon instead of linking nowhere", () => {
    renderShell("/");
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).queryByRole("link", { name: /my classes/i })).toBeNull();
    expect(within(main).getByText("My classes").closest("[aria-disabled]")).toHaveAttribute("aria-disabled", "true");
    for (const name of [/search/i, /notifications/i]) {
      const control = screen.getByRole("button", { name });
      expect(control).toBeDisabled();
      expect(control).toHaveAccessibleName(/coming soon/i);
    }
  });

  it("links Quizzes to the flashcard decks page", () => {
    renderShell("/");
    const main = screen.getByRole("navigation", { name: "Main" });
    expect(within(main).getByRole("link", { name: "Quizzes" })).toHaveAttribute("href", "/quizzes");
  });

  it.each(["/quizzes", "/lectures/abc/study"])("highlights Take a quiz in the footer on %s", (pathname) => {
    renderShell(pathname);
    const loop = within(screen.getByRole("contentinfo")).getByRole("list", { name: /learning loop/i });
    expect(within(loop).getByText("Take a quiz", { exact: false }).closest("li")).toHaveAttribute("aria-current", "step");
  });

  it("shows the learning loop in the footer and highlights the current step", () => {
    renderShell("/explain");
    const loop = within(screen.getByRole("contentinfo")).getByRole("list", { name: /learning loop/i });
    expect(within(loop).getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "01  /  Capture a class→",
      "02  /  Organize notes→",
      "03  /  Take a quiz→",
      "04  /  Find the gaps→",
      "05  /  Explain & improve",
    ]);
    expect(within(loop).getByText("Explain & improve", { exact: false }).closest("li")).toHaveAttribute("aria-current", "step");
  });
});
