import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotesEditor, toNotesUpdate, type NotesDraft } from "./notes-editor";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const id = (n: number) => `8a3f1d2e-4b5c-4d6e-8f70-${String(n).padStart(12, "0")}`;
const draft: NotesDraft = {
  title: "Cellular respiration",
  sections: [
    {
      id: id(1),
      heading: "Glycolysis",
      blocks: [{ id: id(10), kind: "definition", text: "Glucose → 2 pyruvate", sourceRefs: [{ imageId: id(99) }] }],
    },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe("toNotesUpdate", () => {
  it("drops blank blocks, fills blank headings and numbers positions", () => {
    const update = toNotesUpdate(
      {
        title: "  ",
        sections: [
          { id: id(1), heading: " ", blocks: [{ id: id(10), kind: "paragraph", text: "  ", sourceRefs: [] }] },
          { id: id(2), heading: "B", blocks: [{ id: id(11), kind: "bullet", text: " keep ", sourceRefs: [] }] },
        ],
      },
      4,
    );
    expect(update).toEqual({
      baseRevision: 4,
      sections: [
        { id: id(1), heading: "Untitled section", position: 0, blocks: [] },
        { id: id(2), heading: "B", position: 1, blocks: [{ id: id(11), kind: "bullet", text: "keep", sourceRefs: [] }] },
      ],
    });
  });
});

describe("NotesEditor", () => {
  it("saves edits with the base revision and refreshes", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ revision: 3 }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<NotesEditor lectureId={id(5)} revision={2} initial={draft} />);

    expect(screen.getByRole("button", { name: "Save notes" })).toBeDisabled();
    await user.type(screen.getByLabelText("Block 1 text"), " (in cytoplasm)");
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save notes" }));

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`/api/lectures/${id(5)}`);
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(String(init.body));
    expect(body.baseRevision).toBe(2);
    expect(body.sections[0].blocks[0]).toEqual({
      id: id(10),
      kind: "definition",
      text: "Glucose → 2 pyruvate (in cytoplasm)",
      sourceRefs: [{ imageId: id(99) }],
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("shows a conflict with a reload option when someone else saved first", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "These notes changed since you opened them.", revision: 5 }), { status: 409 })),
    );
    const user = userEvent.setup();
    render(<NotesEditor lectureId={id(5)} revision={2} initial={draft} />);
    await user.click(screen.getByRole("button", { name: "Add section" }));
    await user.click(screen.getByRole("button", { name: "Save notes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("These notes changed");
    expect(screen.getByRole("button", { name: "Reload" })).toBeInTheDocument();
  });
});
