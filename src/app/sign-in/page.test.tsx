import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SignInPage from "./page";

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: false }),
  useSignIn: () => ({ signIn: {}, fetchStatus: "idle" }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("sign-in page", () => {
  it("shows the designed sign-in page at /sign-in", () => {
    render(<SignInPage />);
    expect(screen.getByRole("heading", { level: 1, name: /welcome back/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute("href", "/sign-up");
    expect(screen.getByRole("link", { name: /forgot password/i })).toHaveAttribute("href", "/forgot-password");
    // "Home" is the dashboard at /.
    expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/");
  });
});
