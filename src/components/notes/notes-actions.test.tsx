import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotesActions } from "./notes-actions";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

const id = (n: number) => `8a3f1d2e-4b5c-4d6e-8f70-${String(n).padStart(12, "0")}`;
const subjects = [
  { id: id(1), name: "Cell Biology" },
  { id: id(2), name: "Calculus II" },
];

function stubFetch(response: () => Response) {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => response());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  push.mockClear();
  refresh.mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe("NotesActions", () => {
  it("moves the notes to another subject", async () => {
    const fetchMock = stubFetch(() => Response.json({ subjectName: "Calculus II" }));
    const user = userEvent.setup();
    render(<NotesActions lectureId={id(9)} subjects={subjects} subjectId={id(1)} />);

    const change = screen.getByRole("button", { name: "Change subject" });
    expect(change).toBeDisabled(); // nothing changed yet
    await user.selectOptions(screen.getByLabelText("Subject"), "Calculus II");
    await user.click(change);

    expect(fetchMock).toHaveBeenCalledWith(`/api/lectures/${id(9)}`, expect.objectContaining({ method: "PATCH" }));
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({ category: { id: id(2) } });
    expect(await screen.findByText("Subject changed.")).toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("creates a new subject by name, and asks for a name first", async () => {
    const fetchMock = stubFetch(() => Response.json({ subjectName: "Physics" }));
    const user = userEvent.setup();
    render(<NotesActions lectureId={id(9)} subjects={subjects} subjectId={null} />);

    await user.selectOptions(screen.getByLabelText("Subject"), "+ New subject…");
    await user.click(screen.getByRole("button", { name: "Change subject" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/name your new subject/i);
    expect(fetchMock).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("New subject name"), "Physics");
    await user.click(screen.getByRole("button", { name: "Change subject" }));
    expect(JSON.parse(String((fetchMock.mock.calls[0][1] as RequestInit).body))).toEqual({ category: { name: "Physics" } });
  });

  it("deletes only after confirming, then goes to My subjects", async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
    const user = userEvent.setup();
    render(<NotesActions lectureId={id(9)} subjects={subjects} subjectId={id(1)} />);

    await user.click(screen.getByRole("button", { name: /delete notes/i }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/flashcards, quiz history and explanations/i);
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetchMock).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /delete notes/i }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(fetchMock).toHaveBeenCalledWith(`/api/lectures/${id(9)}`, { method: "DELETE" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/subjects"));
  });

  it("shows the server's reason when a delete is refused", async () => {
    stubFetch(() => Response.json({ error: "These notes are still being organized. Try again in a minute." }, { status: 409 }));
    const user = userEvent.setup();
    render(<NotesActions lectureId={id(9)} subjects={subjects} subjectId={id(1)} />);
    await user.click(screen.getByRole("button", { name: /delete notes/i }));
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/still being organized/i);
    expect(push).not.toHaveBeenCalled();
  });

  it("hides delete while the notes are being generated", () => {
    render(<NotesActions lectureId={id(9)} subjects={subjects} subjectId={id(1)} canDelete={false} />);
    expect(screen.queryByRole("button", { name: /delete notes/i })).toBeNull();
  });
});
