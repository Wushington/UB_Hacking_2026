import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NotesWithPhotos, SourceTags, type NotePhoto } from "./photo-viewer";

const photos: NotePhoto[] = [1, 2, 3].map((n) => ({ id: `img-${n}`, url: `/api/lectures/L/images/img-${n}` }));

function renderNotes() {
  return render(
    <NotesWithPhotos photos={photos}>
      <p>Glycolysis happens in the cytoplasm</p>
      <SourceTags imageIds={["img-3", "unknown"]} />
    </NotesWithPhotos>,
  );
}

const panel = () => screen.getByRole("complementary", { name: "Your photos" });

afterEach(() => vi.unstubAllGlobals());

describe("NotesWithPhotos", () => {
  it("shows the photos panel with the first photo and thumbnails", () => {
    renderNotes();
    expect(within(panel()).getByText("Photo 1 of 3")).toBeInTheDocument();
    expect(within(panel()).getByRole("img", { name: /photo 1 of your handwritten notes/i })).toHaveAttribute("src", photos[0].url);
    expect(within(panel()).getAllByRole("button", { name: /^Photo \d$/ })).toHaveLength(3);
  });

  it("switches photos from the thumbnails", async () => {
    const user = userEvent.setup();
    renderNotes();
    await user.click(within(panel()).getByRole("button", { name: "Photo 2" }));
    expect(within(panel()).getByText("Photo 2 of 3")).toBeInTheDocument();
    expect(within(panel()).getByRole("button", { name: "Photo 2" })).toHaveAttribute("aria-pressed", "true");
  });

  it("tags a note with the photos it came from, ignoring unknown ids", () => {
    renderNotes();
    expect(screen.getAllByRole("button", { name: /where this note came from/i }).map((b) => b.textContent)).toEqual(["Photo 3"]);
  });

  it("on desktop, a tag shows that photo in the panel", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q.includes("1024px"), media: q }));
    Element.prototype.scrollIntoView = vi.fn();
    const user = userEvent.setup();
    renderNotes();
    await user.click(screen.getByRole("button", { name: /show photo 3/i }));
    expect(within(panel()).getByText("Photo 3 of 3")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("on phones, a tag opens that photo full screen; arrows and Escape work", async () => {
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: false, media: q }));
    const user = userEvent.setup();
    renderNotes();
    await user.click(screen.getByRole("button", { name: /show photo 3/i }));

    const dialog = screen.getByRole("dialog", { name: "Photo 3 of 3" });
    expect(within(dialog).getByRole("img")).toHaveAttribute("src", photos[2].url);
    await user.click(within(dialog).getByRole("button", { name: "Next photo" })); // wraps around
    expect(screen.getByRole("dialog", { name: "Photo 1 of 3" })).toBeInTheDocument();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("dialog", { name: "Photo 3 of 3" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("opens full screen from the panel and closes with the X", async () => {
    const user = userEvent.setup();
    renderNotes();
    await user.click(within(panel()).getByRole("button", { name: /view photo 1 full screen/i }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("explains when a photo can't be loaded", () => {
    renderNotes();
    fireEvent.error(within(panel()).getByRole("img", { name: /photo 1 of your handwritten notes/i }));
    expect(within(panel()).getByText(/can’t be shown right now/i)).toBeInTheDocument();
  });

  it("renders just the notes when there are no photos", () => {
    render(
      <NotesWithPhotos photos={[]}>
        <p>Only notes</p>
        <SourceTags imageIds={["img-1"]} />
      </NotesWithPhotos>,
    );
    expect(screen.getByText("Only notes")).toBeInTheDocument();
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
