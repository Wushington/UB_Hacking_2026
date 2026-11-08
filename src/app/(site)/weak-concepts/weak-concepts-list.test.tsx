import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import type { WeakConceptView } from "@/contracts/weak-concepts";
import { WeakConceptsList } from "./weak-concepts-list";

const LECTURE = "22222222-2222-4222-8222-222222222201";
const base: WeakConceptView = {
  id: "77777777-7777-4777-8777-777777777701", lectureId: LECTURE, lectureTitle: "Cellular respiration", label: "Glycolysis · Location",
  missedCardCount: 2, explanationFeedbackCount: 0, lastSeenAt: "2026-11-07T10:00:00.000Z",
  relatedCards: [{ id: "88888888-8888-4888-8888-888888888801", question: "Where does glycolysis take place?", answer: "In the cytosol." }],
  feedbackRecordingId: null,
};
const RECORDING = "99999999-9999-4999-8999-999999999901";
const recordingOnly: WeakConceptView = { ...base, id: "77777777-7777-4777-8777-777777777702", label: "ATP yield", missedCardCount: 0, explanationFeedbackCount: 1, relatedCards: [], feedbackRecordingId: RECORDING };

describe("Weak concepts list", () => {
  it("shows an empty state", () => {
    render(<WeakConceptsList concepts={[]} />);
    expect(screen.getByText(/No weak concepts yet/)).toBeInTheDocument();
  });

  it("gives the empty state a next step", () => {
    render(<WeakConceptsList concepts={[]} />);
    expect(screen.getByRole("link", { name: "Study Flashcards" })).toHaveAttribute("href", "/quizzes");
  });

  it("gives each concept one primary action", () => {
    render(<WeakConceptsList concepts={[base]} />);
    const solid = screen.getAllByRole("link").filter((a) => a.className.includes("bg-primary"));
    expect(solid.map((a) => a.textContent)).toEqual(["Study Flashcards"]);
  });

  it("shows the lecture, where it was identified and a link to study the missed flashcards", async () => {
    render(<WeakConceptsList concepts={[base]} />);
    const [item] = screen.getAllByRole("listitem");
    expect(within(item).getByRole("heading", { name: "Glycolysis · Location" })).toBeInTheDocument();
    expect(within(item).getByText("Cellular respiration")).toBeInTheDocument();
    expect(within(item).getByText("Missed 2 flashcards")).toBeInTheDocument();
    expect(within(item).queryByText(/explanation recording/)).not.toBeInTheDocument();
    expect(within(item).getByRole("link", { name: "Study Flashcards" })).toHaveAttribute("href", `/lectures/${LECTURE}/study`);

    await userEvent.setup().click(within(item).getByText("Review 1 missed card"));
    expect(within(item).getByText("Where does glycolysis take place?")).toBeVisible();
    expect(within(item).getByText("In the cytosol.")).toBeVisible();
  });

  it("links recording-only weaknesses to their feedback and notes instead of flashcards", () => {
    render(<WeakConceptsList concepts={[recordingOnly]} />);
    const [item] = screen.getAllByRole("listitem");
    expect(within(item).getByText("Weak point in 1 explanation recording")).toBeInTheDocument();
    expect(within(item).getByRole("link", { name: "View Feedback" })).toHaveAttribute("href", `/explain?recording=${RECORDING}`);
    expect(within(item).getByRole("link", { name: "View Notes" })).toHaveAttribute("href", `/lectures/${LECTURE}`);
    expect(within(item).queryByRole("link", { name: "Study Flashcards" })).not.toBeInTheDocument();
    expect(within(item).queryByText(/missed card/)).not.toBeInTheDocument();
  });

  it("lets the student pick any weak concept to explain out loud", () => {
    render(<WeakConceptsList concepts={[base, recordingOnly]} />);
    // Every concept (flashcard-based or recording-only) gets its own link, in list order.
    expect(screen.getAllByRole("link", { name: "Record Explanation" }).map((a) => a.getAttribute("href"))).toEqual([
      `/explain?concept=${base.id}`,
      `/explain?concept=${recordingOnly.id}`,
    ]);
  });

  it("keeps the given order (most recent first)", () => {
    render(<WeakConceptsList concepts={[recordingOnly, base]} />);
    expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["ATP yield", "Glycolysis · Location"]);
  });
});
