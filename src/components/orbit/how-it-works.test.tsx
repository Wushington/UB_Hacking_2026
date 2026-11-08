import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { HowItWorks } from "./how-it-works";

const props = { steps: ["Add photos.", "Choose a subject.", "Generate notes."], tip: { title: "Photo tips", body: "Avoid glare." } };

describe("HowItWorks", () => {
  it("keeps instructions behind a button until asked for", () => {
    render(<HowItWorks {...props} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByText("Add photos.")).toBeNull();
  });

  it("opens a dialog with the numbered steps and tip, and focuses its close button", async () => {
    const user = userEvent.setup();
    render(<HowItWorks {...props} />);
    await user.click(screen.getByRole("button", { name: "How It Works" }));
    const dialog = screen.getByRole("dialog", { name: "How It Works" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByTestId("modal-backdrop")).toContainElement(dialog);
    expect(within(within(dialog).getByRole("list")).getAllByRole("listitem").map((li) => li.textContent)).toEqual(["1Add photos.", "2Choose a subject.", "3Generate notes."]);
    expect(within(dialog).getByRole("heading", { name: "Photo tips" })).toBeInTheDocument();
    expect(within(dialog).getByText("Avoid glare.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Close" })).toHaveFocus();
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("works without a tip", async () => {
    const user = userEvent.setup();
    render(<HowItWorks steps={["One."]} />);
    await user.click(screen.getByRole("button", { name: "How It Works" }));
    expect(screen.getAllByRole("heading")).toHaveLength(1);
  });

  it.each([
    ["the ✕ button", async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Close" }))],
    ["Got It", async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByRole("button", { name: "Got It" }))],
    ["Escape", async (user: ReturnType<typeof userEvent.setup>) => user.keyboard("{Escape}")],
    ["a click on the backdrop", async (user: ReturnType<typeof userEvent.setup>) => user.click(screen.getByTestId("modal-backdrop"))],
  ])("closes with %s and returns focus to the button", async (_how, close) => {
    const user = userEvent.setup();
    render(<HowItWorks {...props} />);
    const open = screen.getByRole("button", { name: "How It Works" });
    await user.click(open);
    await close(user);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(open).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
  });

  it("keeps Tab inside the popup", async () => {
    const user = userEvent.setup();
    render(<HowItWorks {...props} />);
    await user.click(screen.getByRole("button", { name: "How It Works" }));
    await user.tab();
    expect(screen.getByRole("button", { name: "Got It" })).toHaveFocus();
    await user.tab();
    expect(screen.getByRole("button", { name: "Close" })).toHaveFocus();
  });

  it("doesn't close when clicking inside the popup", async () => {
    const user = userEvent.setup();
    render(<HowItWorks {...props} />);
    await user.click(screen.getByRole("button", { name: "How It Works" }));
    await user.click(screen.getByText("Add photos."));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
