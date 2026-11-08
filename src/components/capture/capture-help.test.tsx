import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { CaptureHelpButton } from "./capture-help";

describe("CaptureHelpButton", () => {
  it("opens the help popup over a backdrop and focuses its close button", async () => {
    const user = userEvent.setup();
    render(<CaptureHelpButton />);
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: /how it works/i }));
    const dialog = screen.getByRole("dialog", { name: /less transcribing/i });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("modal-backdrop")).toContainElement(dialog);
    expect(within(dialog).getByText(/a clearer source, a better start/i)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it.each([
    ["the ✕ button", async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Close" }))],
    ["Got it", async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Got it" }))],
    ["Escape", async (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
    ["a click on the backdrop", async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByTestId("modal-backdrop"))],
  ])("closes with %s and returns focus to the button", async (_how, close) => {
    const user = userEvent.setup();
    render(<CaptureHelpButton />);
    const open = screen.getByRole("button", { name: /how it works/i });
    await user.click(open);
    await close(user);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(open).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps Tab inside the popup", async () => {
    const user = userEvent.setup();
    render(<CaptureHelpButton />);
    await user.click(screen.getByRole("button", { name: /how it works/i }));
    await user.tab(); // Close -> Got it
    expect(screen.getByRole("button", { name: "Got it" })).toHaveFocus();
    await user.tab(); // wraps back to Close
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("doesn't close when clicking inside the popup", async () => {
    const user = userEvent.setup();
    render(<CaptureHelpButton />);
    await user.click(screen.getByRole("button", { name: /how it works/i }));
    await user.click(screen.getByText(/less transcribing/i));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
