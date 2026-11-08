import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { groupBlocks, NotesView } from "./notes-view";

const id = (n: number) => `8a3f1d2e-4b5c-4d6e-8f70-${String(n).padStart(12, "0")}`;
const block = (n: number, kind: "paragraph" | "bullet" | "definition" | "example" | "equation", text: string) => ({
  id: id(n),
  kind,
  text,
  sourceRefs: [],
});

describe("groupBlocks", () => {
  it("merges consecutive bullets into one list", () => {
    const groups = groupBlocks([block(1, "bullet", "a"), block(2, "bullet", "b"), block(3, "paragraph", "p"), block(4, "bullet", "c")]);
    expect(groups.map((g) => (g.kind === "bullets" ? g.items.map((i) => i.text) : g.block.text))).toEqual([["a", "b"], "p", ["c"]]);
  });
});

describe("NotesView", () => {
  it("renders headings, Markdown, labeled blocks, bullet lists and LaTeX", () => {
    const { container } = render(
      <NotesView
        sections={[
          {
            id: id(10),
            heading: "Glycolysis",
            position: 0,
            blocks: [
              block(1, "definition", "**Glycolysis** splits glucose"),
              block(2, "equation", "\\frac{a}{b}"),
              block(3, "paragraph", "Energy yield is $2\\,ATP$ per glucose"),
              block(4, "bullet", "first"),
              block(5, "bullet", "second"),
              block(6, "example", "A runner's muscles"),
            ],
          },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { name: "Glycolysis" })).toBeInTheDocument();
    expect(screen.getByText("Definition")).toBeInTheDocument();
    expect(screen.getByText("Glycolysis", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("Example")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(container.querySelector(".katex-display .mfrac")).not.toBeNull(); // display equation
    expect(container.querySelectorAll(".katex").length).toBeGreaterThanOrEqual(2); // + inline math
  });

  it("shows bad LaTeX as text instead of crashing, and never renders raw HTML from the notes", () => {
    const { container } = render(
      <NotesView
        sections={[
          {
            id: id(10),
            heading: "H",
            position: 0,
            blocks: [block(1, "equation", "\\frac{a"), block(2, "paragraph", '<img src=x onerror="alert(1)"> hi')],
          },
        ]}
      />,
    );
    expect(container.querySelector(".katex-error")).not.toBeNull();
    expect(container.querySelector("img")).toBeNull();
  });
});
