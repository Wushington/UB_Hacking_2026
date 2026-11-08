import { createEvent, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubjectsScreen } from "./subjects-screen";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const id = (n: number) => `8a3f1d2e-4b5c-4d6e-8f70-${String(n).padStart(12, "0")}`;
const at = new Date("2026-11-07T15:00:00Z");
const BIO = id(9);
const CALC = id(8);
const FALL = id(50);
const SPRING = id(51);

const lectures = [
  { id: id(1), title: "Cellular respiration", status: "ready" as const, updatedAt: at, categoryId: BIO, categoryName: "Cell Biology" },
  { id: id(2), title: "Untitled notes", status: "failed" as const, updatedAt: at, categoryId: null, categoryName: null },
];
const subjects = [
  { id: BIO, name: "Cell Biology", dividerId: FALL },
  { id: CALC, name: "Calculus II", dividerId: null },
];
const dividers = [
  { id: FALL, name: "Fall 2026", position: 0, collapsed: false },
  { id: SPRING, name: "Spring 2027", position: 1, collapsed: false },
];

type Call = { url: string; method: string; body?: unknown };
function stubFetch(respond: (call: Call) => Response = () => new Response(null, { status: 204 })) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      const call = { url, method: init?.method ?? "GET", body: init?.body ? JSON.parse(String(init.body)) : undefined };
      calls.push(call);
      return respond(call);
    }),
  );
  return calls;
}

const renderScreen = () => render(<SubjectsScreen signedIn lectures={lectures} subjects={subjects} dividers={dividers} />);
const divider = (name: string) => screen.getByRole("region", { name: `${name} divider` });

beforeEach(() => refresh.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe("SubjectsScreen", () => {
  it("titles the page My Subjects without decorative copy", () => {
    stubFetch();
    const { container } = renderScreen();
    expect(screen.getByRole("heading", { level: 1, name: "My Subjects" })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/everything you’ve captured/i);
  });

  it("shows No subject first, subjects outside dividers, then each divider with its subjects", () => {
    renderScreen();
    const regions = screen.getAllByRole("region").map((r) => r.getAttribute("aria-label"));
    expect(regions).toEqual(["No subject", "Calculus II", "Fall 2026 divider", "Cell Biology", "Spring 2027 divider"]);

    const bio = screen.getByRole("region", { name: "Cell Biology" });
    expect(within(bio).getByRole("link", { name: /cellular respiration/i })).toHaveAttribute("href", `/lectures/${id(1)}`);
    expect(within(bio).getByRole("link", { name: "Flashcards" })).toHaveAttribute("href", `/lectures/${id(1)}/study`);
    expect(within(screen.getByRole("region", { name: "Calculus II" })).getByText(/no notes in this subject yet/i)).toBeInTheDocument();
    expect(within(divider("Spring 2027")).getByText(/drag subjects here/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /capture notes/i })).toHaveAttribute("href", "/capture");
  });

  it("adds a divider", async () => {
    const calls = stubFetch(() => Response.json({ id: id(52), name: "Summer", position: 2, collapsed: false }, { status: 201 }));
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole("button", { name: /add divider/i }));
    await user.type(screen.getByLabelText(/new divider/i), "Summer{Enter}");
    expect(calls[0]).toEqual({ url: "/api/dividers", method: "POST", body: { name: "Summer" } });
    expect(await screen.findByRole("region", { name: "Summer divider" })).toBeInTheDocument();
    expect(screen.queryByLabelText(/new divider/i)).toBeNull();
  });

  it("collapses and expands a divider, saving the state", async () => {
    const calls = stubFetch();
    const user = userEvent.setup();
    renderScreen();
    const toggle = within(divider("Fall 2026")).getByRole("button", { name: /^fall 2026/i });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("region", { name: "Cell Biology" })).toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("region", { name: "Cell Biology" })).toBeNull(); // hidden subtree
    expect(calls[0]).toEqual({ url: `/api/dividers/${FALL}`, method: "PATCH", body: { collapsed: true } });
  });

  it("moves a subject with the Move to… menu", async () => {
    const calls = stubFetch();
    const user = userEvent.setup();
    renderScreen();
    await user.click(screen.getByRole("button", { name: "Move Calculus II to a divider" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Spring 2027" }));
    expect(calls[0]).toEqual({ url: `/api/subjects/${CALC}`, method: "PATCH", body: { dividerId: SPRING } });
    expect(within(divider("Spring 2027")).getByRole("region", { name: "Calculus II" })).toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("moves a subject by dragging it onto a divider", () => {
    const calls = stubFetch();
    renderScreen();
    const card = screen.getByRole("region", { name: "Calculus II" });
    const data = new Map<string, string>();
    const dataTransfer = { setData: (k: string, v: string) => data.set(k, v), getData: (k: string) => data.get(k) ?? "", types: [] as string[], effectAllowed: "", dropEffect: "" };

    fireEvent.dragStart(card, { dataTransfer });
    const target = divider("Spring 2027");
    const over = createEvent.dragOver(target, { dataTransfer });
    fireEvent(target, over);
    expect(over.defaultPrevented).toBe(true); // accepted as a drop target
    expect(target).toHaveAttribute("data-drop-active", "true");
    fireEvent.drop(target, { dataTransfer });

    expect(calls[0]).toEqual({ url: `/api/subjects/${CALC}`, method: "PATCH", body: { dividerId: SPRING } });
    expect(within(divider("Spring 2027")).getByRole("region", { name: "Calculus II" })).toBeInTheDocument();
  });

  it("renames, reorders and deletes dividers", async () => {
    const calls = stubFetch();
    const user = userEvent.setup();
    renderScreen();

    await user.click(screen.getByRole("button", { name: "Divider options for Fall 2026" }));
    expect(screen.getByRole("menuitem", { name: "Move up" })).toBeDisabled();
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    const field = screen.getByLabelText("Divider name");
    await user.clear(field);
    await user.type(field, "Fall 2026 (done){Enter}");
    expect(calls.at(-1)).toEqual({ url: `/api/dividers/${FALL}`, method: "PATCH", body: { name: "Fall 2026 (done)" } });

    await user.click(screen.getByRole("button", { name: "Divider options for Spring 2027" }));
    await user.click(screen.getByRole("menuitem", { name: "Move up" }));
    expect(calls.at(-1)).toEqual({ url: `/api/dividers/${SPRING}`, method: "PATCH", body: { move: "up" } });
    const names = () => screen.getAllByRole("region", { name: / divider$/ }).map((r) => r.getAttribute("aria-label"));
    expect(names()).toEqual(["Spring 2027 divider", "Fall 2026 (done) divider"]);

    await user.click(screen.getByRole("button", { name: "Divider options for Fall 2026 (done)" }));
    await user.click(screen.getByRole("menuitem", { name: "Delete divider" }));
    expect(screen.getByRole("alertdialog")).toHaveTextContent(/no subjects or notes are deleted/i);
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(calls.at(-1)).toEqual({ url: `/api/dividers/${FALL}`, method: "DELETE", body: undefined });
    expect(names()).toEqual(["Spring 2027 divider"]);
    // Its subject moved back above the dividers.
    expect(screen.getAllByRole("region").map((r) => r.getAttribute("aria-label")).slice(0, 3)).toEqual(["No subject", "Cell Biology", "Calculus II"]);
  });

  it("undoes a change and explains when saving fails", async () => {
    stubFetch(() => Response.json({ error: "Divider not found" }, { status: 404 }));
    const user = userEvent.setup();
    renderScreen();
    await user.click(within(divider("Fall 2026")).getByRole("button", { name: /^fall 2026/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Divider not found");
    expect(within(divider("Fall 2026")).getByRole("button", { name: /^fall 2026/i })).toHaveAttribute("aria-expanded", "true");
  });

  it("shows an empty state, and a sign-in prompt when signed out", () => {
    const { unmount } = render(<SubjectsScreen signedIn lectures={[]} />);
    expect(screen.getByText(/no subjects yet/i)).toBeInTheDocument();
    unmount();
    render(<SubjectsScreen signedIn={false} lectures={[]} />);
    expect(screen.getByText(/sign in to see your subjects/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /add divider/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /capture notes/i })).toBeNull();
  });
});
