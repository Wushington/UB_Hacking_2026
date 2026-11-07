import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ExplainAloudScreen } from "./explain-aloud-screen";
import { sampleExplainAloud } from "./sample-data";

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: false, user: null }),
  useClerk: () => ({ openUserProfile: vi.fn(), signOut: vi.fn() }),
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}));

describe("ExplainAloudScreen", () => {
  it("renders the heading, concept and feedback from props", () => {
    render(<ExplainAloudScreen {...sampleExplainAloud} />);
    expect(screen.getByRole("heading", { level: 1, name: /you’re making the connections/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Oxidative phosphorylation" })).toBeInTheDocument();
    for (const item of sampleExplainAloud.feedback.covered) {
      expect(screen.getByText(item, { exact: false })).toBeInTheDocument();
    }
    for (const gap of sampleExplainAloud.feedback.gaps) {
      expect(screen.getByText(gap.title)).toBeInTheDocument();
    }
    expect(screen.getByText("0:00 / 0:48")).toBeInTheDocument();
  });

  it("calls onRecordAgain when recording another attempt", async () => {
    const onRecordAgain = vi.fn();
    render(<ExplainAloudScreen {...sampleExplainAloud} onRecordAgain={onRecordAgain} />);
    await userEvent.click(screen.getByRole("button", { name: /record another attempt/i }));
    expect(onRecordAgain).toHaveBeenCalledOnce();
  });
});
