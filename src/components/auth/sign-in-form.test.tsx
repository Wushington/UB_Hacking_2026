import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignInForm } from "./sign-in-form";

const mocks = vi.hoisted(() => ({
  password: vi.fn(), create: vi.fn(), sso: vi.fn(), finalize: vi.fn(),
  sendCode: vi.fn(), verifyCode: vi.fn(), submitPassword: vi.fn(), push: vi.fn(),
  state: { status: "complete", loaded: true, signedIn: false },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: mocks.state.loaded, isSignedIn: mocks.state.signedIn }),
  useSignIn: () => ({ fetchStatus: "idle", signIn: {
    get status() { return mocks.state.status; },
    password: mocks.password, create: mocks.create, sso: mocks.sso, finalize: mocks.finalize,
    resetPasswordEmailCode: { sendCode: mocks.sendCode, verifyCode: mocks.verifyCode, submitPassword: mocks.submitPassword },
  } }),
}));

beforeEach(() => {
  vi.resetAllMocks(); localStorage.clear();
  mocks.state.status = "complete"; mocks.state.loaded = true; mocks.state.signedIn = false;
  for (const fn of [mocks.password, mocks.create, mocks.sso, mocks.finalize, mocks.sendCode, mocks.verifyCode, mocks.submitPassword]) fn.mockResolvedValue({ error: null });
});

async function credentials() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email address"), "student@example.com");
  await user.type(screen.getByLabelText("Password", { exact: true }), "a-test-password");
  return user;
}

describe("custom Clerk authentication", () => {
  it("submits credentials and finalizes the session without storing passwords", async () => {
    render(<SignInForm />);
    const user = await credentials();
    await user.click(screen.getByLabelText("Remember me"));
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.finalize).toHaveBeenCalled());
    expect(mocks.password).toHaveBeenCalledWith({ emailAddress: "student@example.com", password: "a-test-password" });
    expect(localStorage.getItem("orbit-remembered-email")).toBe("student@example.com");
    expect(localStorage.length).toBe(1);
  });
  it("shows Clerk errors and allows retry", async () => {
    mocks.password.mockResolvedValueOnce({ error: { longMessage: "Incorrect email or password." } });
    render(<SignInForm />); const user = await credentials();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect email or password.");
    expect(mocks.finalize).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });
  it("continues additional security checks with Clerk", async () => {
    mocks.state.status = "needs_second_factor";
    render(<SignInForm />); const user = await credentials();
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/auth"));
    expect(mocks.finalize).not.toHaveBeenCalled();
  });
  it("starts Google OAuth with the local callback", async () => {
    render(<SignInForm />);
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }));
    expect(mocks.sso).toHaveBeenCalledWith({ strategy: "oauth_google", redirectCallbackUrl: "/sso-callback", redirectUrl: "/" });
  });
  it("recovers a password through email code verification", async () => {
    render(<SignInForm recovery />); const user = userEvent.setup();
    await user.type(screen.getByLabelText("Email address"), "student@example.com");
    await user.click(screen.getByRole("button", { name: /send reset code/i }));
    await user.type(await screen.findByLabelText("Reset code"), "123456");
    expect(mocks.create).toHaveBeenCalledWith({ identifier: "student@example.com" });
    expect(mocks.sendCode).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Verify code" }));
    await user.type(await screen.findByLabelText("New password"), "new-test-password");
    await user.click(screen.getByRole("button", { name: "Reset password" }));
    await waitFor(() => expect(mocks.finalize).toHaveBeenCalled());
    expect(mocks.verifyCode).toHaveBeenCalledWith({ code: "123456" });
    expect(mocks.submitPassword).toHaveBeenCalledWith({ password: "new-test-password", signOutOfOtherSessions: true });
  });
  it("toggles password visibility and disables submission before Clerk loads", async () => {
    mocks.state.loaded = false; render(<SignInForm />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute("type", "text");
  });
});

