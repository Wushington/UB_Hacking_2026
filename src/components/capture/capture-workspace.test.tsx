import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CaptureWorkspace } from "./capture-workspace";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const id = (n: number) => `8a3f1d2e-4b5c-4d6e-8f70-${String(n).padStart(12, "0")}`;
const categories = [
  { id: id(901), name: "Cell Biology" },
  { id: id(902), name: "Calculus II" },
];

type Call = { method: string; url: string; body?: unknown };

/** Fake backend. `processOk` decides whether each /process call succeeds. */
function backend(processOk: () => boolean) {
  const calls: Call[] = [];
  let lectures = 0;
  let uploads = 0;
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
    calls.push({ method, url, body });
    if (method === "PUT") return new Response(null, { status: 200 });
    if (method === "DELETE") return new Response(null, { status: 204 });
    if (url === "/api/lectures") return json({ id: id(++lectures) }, 201);
    if (url === "/api/uploads/prepare") {
      uploads++;
      return json({ uploadId: id(100 + uploads), uploadUrl: `https://bucket.example/${uploads}`, expiresAt: new Date().toISOString() });
    }
    if (url === "/api/uploads/finalize") return json({ id: id(200 + uploads) }, 201);
    if (url.endsWith("/process")) {
      return processOk() ? json({ title: "Notes", sections: [] }) : json({ error: "Couldn't generate notes right now. Please try again." }, 502);
    }
    throw new Error(`Unexpected ${method} ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const photo = (name: string) => new File([new Uint8Array(16)], name, { type: "image/jpeg" });

async function addPhotos(user: ReturnType<typeof userEvent.setup>, ...names: string[]) {
  await user.upload(screen.getByTestId("photo-input"), names.map(photo));
}

beforeEach(() => push.mockClear());
afterEach(() => vi.unstubAllGlobals());

describe("CaptureWorkspace", () => {
  it("keeps the class picker, new-class field and photos editable after a failed attempt", async () => {
    let ok = false;
    backend(() => ok);
    const user = userEvent.setup();
    render(<CaptureWorkspace categories={categories} signedIn />);

    await addPhotos(user, "board1.jpg");
    await user.click(screen.getByRole("button", { name: /organize notes/i }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't generate notes right now");

    const picker = screen.getByLabelText(/assign to class/i);
    expect(picker).toBeEnabled();
    await user.selectOptions(picker, "+ New class…");
    const name = screen.getByPlaceholderText(/cell biology/i);
    expect(name).toBeEnabled();
    await user.type(name, "Organic Chemistry");
    expect(name).toHaveValue("Organic Chemistry");

    expect(screen.getByRole("button", { name: /remove board1.jpg/i })).toBeEnabled();
    await addPhotos(user, "board2.jpg");
    expect(screen.getByText("board2.jpg")).toBeInTheDocument();
    ok = true;
  });

  it("retries with the same class by reusing the attempt and only uploading new photos", async () => {
    let ok = false;
    const calls = backend(() => ok);
    const user = userEvent.setup();
    render(<CaptureWorkspace categories={categories} signedIn />);

    await addPhotos(user, "board1.jpg");
    await user.click(screen.getByRole("button", { name: /organize notes/i }));
    await screen.findByRole("alert");

    await addPhotos(user, "board2.jpg");
    ok = true;
    await user.click(screen.getByRole("button", { name: /try again/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/lectures/${id(1)}`));

    expect(calls.filter((c) => c.url === "/api/lectures")).toHaveLength(1);
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(2); // board1 once, board2 once
    expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    expect(calls.at(-1)?.body).toEqual({ imageIds: [id(201), id(202)] });
  });

  it("switching class after a failure discards the old attempt and starts fresh", async () => {
    let ok = false;
    const calls = backend(() => ok);
    const user = userEvent.setup();
    render(<CaptureWorkspace categories={categories} signedIn />);

    await addPhotos(user, "board1.jpg");
    await user.click(screen.getByRole("button", { name: /organize notes/i }));
    await screen.findByRole("alert");

    await user.selectOptions(screen.getByLabelText(/assign to class/i), "Calculus II");
    ok = true;
    await user.click(screen.getByRole("button", { name: /try again|organize notes/i }));
    await waitFor(() => expect(push).toHaveBeenCalledWith(`/lectures/${id(2)}`));

    expect(calls).toContainEqual({ method: "DELETE", url: `/api/lectures/${id(1)}`, body: undefined });
    expect(calls.filter((c) => c.url === "/api/lectures").map((c) => c.body)).toEqual([
      { category: { id: id(901) } },
      { category: { id: id(902) } },
    ]);
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(2); // re-uploaded to the new class
  });

  it("start over discards the attempt and clears the photos", async () => {
    const calls = backend(() => false);
    const user = userEvent.setup();
    render(<CaptureWorkspace categories={categories} signedIn />);

    await addPhotos(user, "board1.jpg");
    await user.click(screen.getByRole("button", { name: /organize notes/i }));
    await screen.findByRole("alert");
    await user.click(screen.getByRole("button", { name: /start over/i }));

    expect(calls).toContainEqual({ method: "DELETE", url: `/api/lectures/${id(1)}`, body: undefined });
    expect(screen.queryByText("board1.jpg")).toBeNull();
    expect(screen.getByRole("button", { name: /organize notes/i })).toBeDisabled();
  });
});
