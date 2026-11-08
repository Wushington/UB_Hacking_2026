import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SelfRating, selfRatingMessage } from "./self-rating";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

const ID = "7d1f3c1e-2b8a-4c3e-9f4a-1a2b3c4d5e6f";
const MASTERED = [{ conceptKey: "oxygen-final-electron-acceptor", label: "Give oxygen its specific role" }];

describe("SelfRating", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    refresh.mockReset();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("names the mastered concept and saves the chosen rating", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ rating: 5, outcome: "removed", concepts: ["Give oxygen its specific role"] }),
    );
    render(<SelfRating recordingId={ID} mastered={MASTERED} selfRating={null} />);
    expect(screen.getByText("Give oxygen its specific role")).toBeInTheDocument();

    const save = screen.getByRole("button", { name: "Save rating" });
    expect(save).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "5, Nailed it" }));
    expect(screen.getByRole("radio", { name: "5, Nailed it" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(save);

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`/api/explanations/${ID}/self-rating`);
    expect(JSON.parse(init.body as string)).toEqual({ rating: 5 });
    expect(screen.getByRole("status")).toHaveTextContent("Rated 5/5 · Removed from your weak concepts.");
  });

  it("shows the saved outcome for an existing rating", () => {
    render(<SelfRating recordingId={ID} mastered={MASTERED} selfRating={2} />);
    expect(screen.getByRole("status")).toHaveTextContent("Rated 2/5 · Marked as resolved. We’ll bring it back if it trips you up again.");
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
  });

  it("shows the server's message when saving fails", async () => {
    fetchMock.mockResolvedValue(Response.json({ error: "You’ve already rated this attempt" }, { status: 409 }));
    render(<SelfRating recordingId={ID} mastered={MASTERED} selfRating={null} />);
    await userEvent.click(screen.getByRole("radio", { name: "3, Getting there" }));
    await userEvent.click(screen.getByRole("button", { name: "Save rating" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("You’ve already rated this attempt");
    expect(refresh).not.toHaveBeenCalled();
  });

  it("words the outcome for one or several concepts", () => {
    expect(selfRatingMessage(4, 2)).toBe("Removed from your weak concepts.");
    expect(selfRatingMessage(1, 2)).toBe("Marked as resolved. We’ll bring them back if they trip you up again.");
  });
});
