import { type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import { emptyDashboard } from "@/lib/dashboard/view";
import HomePage from "./page";

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
  auth: vi.fn(),
  currentUser: vi.fn(),
  getDashboardView: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth, currentUser: mocks.currentUser }));
vi.mock("@/lib/dashboard/queries", () => ({ getDashboardView: mocks.getDashboardView }));

/** HomePage is <Suspense><Dashboard /></Suspense>; resolve the async Dashboard server component. */
async function resolveDashboard() {
  const page = HomePage() as ReactElement<{ children: ReactElement }>;
  const dashboard = page.props.children;
  const render = dashboard.type as () => Promise<ReactElement<{ children: ReactElement<{ view: unknown }> }>>;
  return render();
}

describe("root page (/)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends signed-out visitors to the sign-up flow", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    await expect(resolveDashboard()).rejects.toThrow("NEXT_REDIRECT");
    expect(mocks.redirect).toHaveBeenCalledWith("/sign-up");
    expect(mocks.getDashboardView).not.toHaveBeenCalled();
  });

  it("shows the signed-in user's dashboard", async () => {
    const view = { ...emptyDashboard(true), firstName: "Ada" };
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.currentUser.mockResolvedValue({ firstName: " Ada " });
    mocks.getDashboardView.mockResolvedValue(view);
    const element = await resolveDashboard();
    expect(element.props.children.type).toBe(DashboardScreen);
    expect(mocks.getDashboardView).toHaveBeenCalledWith("user_1", "Ada");
    expect(element.props.children.props.view).toBe(view);
  });
});
