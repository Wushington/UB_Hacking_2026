import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountMenu } from "./account-menu";

const clerk = { openUserProfile: vi.fn(), signOut: vi.fn() };
let userState: { isLoaded: boolean; isSignedIn: boolean; user: unknown };

vi.mock("@clerk/nextjs", () => ({
  useUser: () => userState,
  useClerk: () => clerk,
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}));

function oauthUser(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Eunsu",
    lastName: "Kim",
    fullName: "Eunsu Kim",
    username: null,
    hasImage: true,
    imageUrl: "https://img.clerk.com/oauth-google-photo",
    primaryEmailAddress: { emailAddress: "eunsu@example.com" },
    ...overrides,
  };
}

describe("AccountMenu", () => {
  beforeEach(() => {
    clerk.openUserProfile.mockReset();
    clerk.signOut.mockReset();
  });

  it("shows the OAuth profile photo and first name when signed in", () => {
    userState = { isLoaded: true, isSignedIn: true, user: oauthUser() };
    const { container } = render(<AccountMenu />);
    expect(screen.getByText("Eunsu")).toBeInTheDocument();
    const avatar = container.querySelector('img[src="https://img.clerk.com/oauth-google-photo"]');
    expect(avatar).not.toBeNull();
  });

  it("falls back to initials when the user has no profile photo", () => {
    userState = { isLoaded: true, isSignedIn: true, user: oauthUser({ hasImage: false }) };
    render(<AccountMenu />);
    expect(screen.getByText("EK")).toBeInTheDocument();
  });

  it("uses the email when no name is set", () => {
    userState = {
      isLoaded: true,
      isSignedIn: true,
      user: oauthUser({ firstName: null, lastName: null, fullName: null, hasImage: false }),
    };
    render(<AccountMenu />);
    expect(screen.getByText("eunsu")).toBeInTheDocument();
    expect(screen.getByText("EU")).toBeInTheDocument();
  });

  it("shows a Sign in button when signed out", () => {
    userState = { isLoaded: true, isSignedIn: false, user: null };
    render(<AccountMenu />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });

  it("opens the menu and signs out", async () => {
    userState = { isLoaded: true, isSignedIn: true, user: oauthUser() };
    render(<AccountMenu />);
    await userEvent.click(screen.getByRole("button", { name: /account menu for eunsu/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Manage account" }));
    expect(clerk.openUserProfile).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: /account menu for eunsu/i }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    expect(clerk.signOut).toHaveBeenCalledWith({ redirectUrl: "/" });
  });
});
