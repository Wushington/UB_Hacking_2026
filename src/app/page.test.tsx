import { isValidElement, type ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import { emptyDashboard } from "@/lib/dashboard/view";
import HomePage from "./page";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  getDashboardView: vi.fn(),
}));
vi.mock("@clerk/nextjs/server", () => ({ auth: mocks.auth, currentUser: mocks.currentUser }));
vi.mock("@/lib/dashboard/queries", () => ({ getDashboardView: mocks.getDashboardView }));

/** HomePage is <Suspense><Dashboard /></Suspense>; resolve the async Dashboard server component. */
async function resolveDashboard() {
  const page = HomePage() as ReactElement<{ children: ReactElement }>;
  const dashboard = page.props.children;
  const render = dashboard.type as () => Promise<ReactElement<{ view: unknown }>>;
  return render();
}

describe("root page (/)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the signed-out dashboard, not the sign-in form", async () => {
    mocks.auth.mockResolvedValue({ userId: null });
    const element = await resolveDashboard();
    expect(isValidElement(element) && element.type).toBe(DashboardScreen);
    expect(element.props.view).toEqual(emptyDashboard(false));
    expect(mocks.getDashboardView).not.toHaveBeenCalled();
  });

  it("shows the signed-in user's dashboard", async () => {
    const view = { ...emptyDashboard(true), firstName: "Ada" };
    mocks.auth.mockResolvedValue({ userId: "user_1" });
    mocks.currentUser.mockResolvedValue({ firstName: " Ada " });
    mocks.getDashboardView.mockResolvedValue(view);
    const element = await resolveDashboard();
    expect(element.type).toBe(DashboardScreen);
    expect(mocks.getDashboardView).toHaveBeenCalledWith("user_1", "Ada");
    expect(element.props.view).toBe(view);
  });
});
