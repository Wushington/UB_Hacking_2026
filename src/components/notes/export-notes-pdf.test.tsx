import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportNotesPdf } from "./export-notes-pdf";

afterEach(() => vi.restoreAllMocks());

describe("Export PDF", () => {
  it("explains blocked popups and allows retry", () => {
    vi.spyOn(window, "open").mockReturnValue(null);
    render(<><div id="orbit-notes-content">Notes</div><ExportNotesPdf title="My notes" /></>);
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Allow pop-ups");
    expect(screen.getByRole("button", { name: "Export PDF" })).toBeEnabled();
  });

  it("prints notes with their title and subject after fonts are ready", async () => {
    const doc = document.implementation.createHTMLDocument();
    Object.defineProperty(doc, "fonts", { value: { ready: Promise.resolve() } });
    const print = vi.fn();
    const preview = { document: doc, focus: vi.fn(), print, closed: false, opener: window };
    vi.spyOn(window, "open").mockReturnValue(preview as unknown as Window);
    render(<><div id="orbit-notes-content"><h2>Energy</h2><p>E = mc²</p></div><ExportNotesPdf title="Lecture 1" subject="Physics" /></>);
    fireEvent.click(screen.getByRole("button", { name: "Export PDF" }));
    await waitFor(() => expect(print).toHaveBeenCalledOnce());
    expect(doc.querySelector("h1")?.textContent).toBe("Lecture 1");
    expect(doc.querySelector(".export-subject")?.textContent).toBe("Physics");
    expect(doc.querySelector("h2")?.textContent).toBe("Energy");
    expect(preview.opener).toBeNull();
  });
});