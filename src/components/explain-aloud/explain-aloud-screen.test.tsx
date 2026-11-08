import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { emptyView, type ExplainAloudView } from "@/lib/explain-aloud/view";
import { ExplainAloudScreen } from "./explain-aloud-screen";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isLoaded: true, isSignedIn: false, user: null }),
  useClerk: () => ({ openUserProfile: vi.fn(), signOut: vi.fn() }),
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
}));

const readyView: ExplainAloudView = {
  state: "ready",
  recordingId: "7d1f3c1e-2b8a-4c3e-9f4a-1a2b3c4d5e6f",
  lectureId: "0b6f5c2a-9d3e-4f1a-8c7b-2e1d0f9a8b7c",
  course: "Biology",
  concept: {
    title: "Cellular respiration",
    breadcrumb: "Biology · Cellular respiration",
    prompt: null,
    attemptLabel: "Attempt 2 · Complete",
  },
  recording: { durationSeconds: 48, audioSrc: null },
  transcript: "Electrons move along the chain.",
  recordedLabel: "Nov 7",
  feedback: {
    summary: null,
    covered: [],
    gaps: [{ title: "Role of oxygen", detail: "Oxygen is the final electron acceptor." }],
    nextStep: null,
  },
};

const FIGMA_FILLER = [/oxidative phosphorylation/i, /jamie/i, /BIO 201/];

describe("ExplainAloudScreen", () => {
  it("renders the user's attempt and feedback", () => {
    render(<ExplainAloudScreen view={readyView} />);
    expect(screen.getByRole("heading", { level: 1, name: /you’re making the connections/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cellular respiration" })).toBeInTheDocument();
    expect(screen.getByText("Biology")).toBeInTheDocument();
    expect(screen.getByText("Attempt 2 · Complete")).toBeInTheDocument();
    expect(screen.getByText("“Electrons move along the chain.”")).toBeInTheDocument();
    expect(screen.getByText("Role of oxygen")).toBeInTheDocument();
    expect(screen.getByText("0:00 / 0:48")).toBeInTheDocument();
    expect(screen.getByText(/Recorded Nov 7/)).toBeInTheDocument();
    // Sections with no stored data show placeholders.
    expect(screen.getByText("Ideas you explained well will show up here.")).toBeInTheDocument();
    expect(screen.getByText("A suggested next attempt will appear here.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play recording" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /listen feedback read aloud/i })).toBeInTheDocument();
  });

  it("hides Listen when there is no feedback to read", () => {
    render(<ExplainAloudScreen view={{ ...readyView, state: "processing", feedback: null }} />);
    expect(screen.queryByRole("button", { name: /listen/i })).not.toBeInTheDocument();
  });

  it("says no gaps were found when feedback has no weak points", () => {
    render(<ExplainAloudScreen view={{ ...readyView, feedback: { ...readyView.feedback!, gaps: [] } }} />);
    expect(screen.getByText(/no gaps found/i)).toBeInTheDocument();
  });

  it.each(["empty", "signed-out", "loading"] as const)("shows placeholders and no Figma filler when %s", (state) => {
    const { container } = render(<ExplainAloudScreen view={emptyView(state)} />);
    // Empty/signed-out sections show static placeholders; while loading they show spinners/skeletons.
    expect(container.querySelectorAll("[data-placeholder], [data-analyzing], [data-skeleton]").length).toBeGreaterThanOrEqual(4);
    for (const filler of FIGMA_FILLER) expect(container.textContent).not.toMatch(filler);
    expect(screen.queryByRole("button", { name: /listen/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/Recorded/)).not.toBeInTheDocument();
  });

  it("prompts a signed-out visitor to sign in", () => {
    render(<ExplainAloudScreen view={emptyView("signed-out")} />);
    expect(screen.getByText("Sign in to see your explanations and feedback.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /record an explanation/i })).toBeDisabled();
  });

  it("shows spinners and skeletons while the attempt is analyzed", () => {
    const { container } = render(
      <ExplainAloudScreen
        view={{ ...readyView, state: "processing", transcript: null, feedback: null, recordedLabel: null }}
      />,
    );
    expect(screen.getByText("Analyzing…")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Transcribing your explanation…" })).toBeInTheDocument();
    expect(screen.getByText(/comparing your explanation with your class notes/i)).toBeInTheDocument();
    expect(container.querySelectorAll("[data-skeleton]")).toHaveLength(3);
    // None of the static "will show up here" placeholders while work is in progress.
    expect(container.textContent).not.toMatch(/will (show up|appear) here/);
    // The attempt itself is already shown.
    expect(screen.getByRole("heading", { name: "Cellular respiration" })).toBeInTheDocument();
  });

  it("shows loading spinners in the Suspense fallback", () => {
    render(<ExplainAloudScreen view={emptyView("loading")} />);
    expect(screen.getByRole("status", { name: "Loading your explanation…" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Loading…" })).toBeInTheDocument();
    expect(screen.getByText("Loading your feedback…")).toBeInTheDocument();
  });

  it("drops the analyzing indicators once feedback is ready", () => {
    const { container } = render(<ExplainAloudScreen view={readyView} />);
    expect(container.querySelectorAll("[data-analyzing], [data-skeleton]")).toHaveLength(0);
    expect(screen.queryByText(/comparing your explanation/i)).not.toBeInTheDocument();
  });

  it("enables recording another attempt when the user has a class", () => {
    render(<ExplainAloudScreen view={readyView} lectures={[{ id: readyView.lectureId!, title: "Cellular respiration" }]} />);
    expect(screen.getByRole("button", { name: /record another attempt/i })).toBeEnabled();
  });

  it("disables recording until the user has a class", () => {
    render(<ExplainAloudScreen view={emptyView("empty")} lectures={[]} />);
    expect(screen.getByRole("button", { name: /record an explanation/i })).toBeDisabled();
    expect(screen.getByText(/add a class first/i)).toBeInTheDocument();
  });
});
