import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WeakConceptView } from "@/contracts/weak-concepts";
import type { SubjectLecture } from "@/components/subjects/subjects-layout";
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

const lecture = (id: string, categoryId: string | null, d: number): SubjectLecture => ({
  id, title: `Notes ${id}`, status: "ready", updatedAt: new Date(Date.UTC(2026, 10, d)), categoryId, categoryName: categoryId,
});
const concept = (id: string, lectureId: string, label = `Concept ${id}`): WeakConceptView => ({ ...base, id, lectureId, lectureTitle: `Notes ${lectureId}`, label });

const dividers = [
  { id: "spring", name: "Spring 2027", position: 1, collapsed: false },
  { id: "fall", name: "Fall 2026", position: 0, collapsed: true },
  { id: "empty", name: "Study Abroad", position: 2, collapsed: false },
];
const subjects = [
  { id: "bio", name: "Biology", dividerId: "fall" },
  { id: "calc", name: "Calculus", dividerId: "fall" },
  { id: "chem", name: "Chemistry", dividerId: "spring" },
  { id: "art", name: "Art History", dividerId: null },
  { id: "strong", name: "Physics", dividerId: "fall" },
];
const lectures = [lecture("l-bio", "bio", 9), lecture("l-calc", "calc", 8), lecture("l-bio2", "bio", 7), lecture("l-chem", "chem", 6), lecture("l-art", "art", 5), lecture("l-none", null, 4), lecture("l-strong", "strong", 3)];
const concepts = [concept("c1", "l-bio2"), concept("c2", "l-bio"), concept("c3", "l-calc"), concept("c4", "l-chem"), concept("c5", "l-art"), concept("c6", "l-none")];

const renderList = (props: Partial<Parameters<typeof WeakConceptsList>[0]> = {}) => render(<WeakConceptsList concepts={concepts} lectures={lectures} subjects={subjects} dividers={dividers} {...props} />);
/** One concept in a single subject, for the per-concept details. */
const renderOne = (...items: WeakConceptView[]) => render(<WeakConceptsList concepts={items} lectures={[{ ...lecture(LECTURE, "bio", 9), title: "Cellular respiration" }]} subjects={[subjects[0]]} dividers={[]} />);
const selector = () => screen.getByRole("group", { name: "Filter weak concepts by divider" });
const select = (name: string) => userEvent.setup().click(within(selector()).getByRole("button", { name }));
const subject = (name: string) => screen.getByRole("region", { name });
const labels = (name: string) => within(subject(name)).getAllByRole("heading", { level: 4 }).map((h) => h.textContent);

afterEach(() => vi.unstubAllGlobals());

describe("Weak concepts list", () => {
  describe("organization", () => {
    it("offers All, Unorganized and the saved dividers in My Subjects order", () => {
      renderList();
      expect(within(selector()).getAllByRole("button").map((b) => b.textContent)).toEqual(["All", "Unorganized", "Fall 2026", "Spring 2027", "Study Abroad"]);
    });

    it("groups concepts by divider, then subject, under All", () => {
      renderList();
      expect(screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent)).toEqual(["Unorganized", "Fall 2026", "Spring 2027"]);
      expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["No Subject", "Art History", "Biology", "Calculus", "Chemistry"]);
    });

    it("shows only the selected divider's subjects and concepts", async () => {
      renderList();
      await select("Fall 2026");
      expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Biology", "Calculus"]);
      expect(screen.queryByText("Concept c4")).toBeNull();
    });

    it("puts each concept under its lecture's subject, most recent first", () => {
      renderList();
      expect(labels("Biology")).toEqual(["Concept c1", "Concept c2"]);
      expect(within(subject("Biology")).getByText("2 concepts")).toBeInTheDocument();
    });

    it("keeps concepts without a divider or subject reachable", async () => {
      renderList();
      await select("Unorganized");
      expect(labels("Art History")).toEqual(["Concept c5"]);
      expect(labels("No Subject")).toEqual(["Concept c6"]);
    });

    it("leaves out subjects with nothing to review", async () => {
      renderList();
      await select("Fall 2026");
      expect(screen.queryByRole("region", { name: "Physics" })).toBeNull();
    });

    it("explains a divider with no weak concepts", async () => {
      renderList();
      await select("Study Abroad");
      expect(screen.getByText(/no weak concepts in study abroad/i)).toBeInTheDocument();
      expect(screen.queryByRole("heading", { level: 3 })).toBeNull();
    });

    it("omits Unorganized when nothing outside a divider needs review", () => {
      renderList({ concepts: [concept("c4", "l-chem")] });
      expect(within(selector()).queryByRole("button", { name: "Unorganized" })).toBeNull();
    });

    it("never loses a concept whose lecture wasn't loaded", async () => {
      renderList({ concepts: [concept("c9", "l-older", "Old concept")] });
      await select("Unorganized");
      expect(labels("No Subject")).toEqual(["Old concept"]);
    });

    it("changes no saved data when switching dividers", async () => {
      const fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      renderList();
      await select("Fall 2026");
      await select("All");
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it("announces the result of a filter", async () => {
      renderList();
      await select("Spring 2027");
      expect(screen.getByRole("status")).toHaveTextContent("Showing 1 weak concept in Spring 2027");
    });

    it("leaves out the selector when the student has no dividers", () => {
      renderOne(base);
      expect(screen.queryByRole("group", { name: "Filter weak concepts by divider" })).toBeNull();
      expect(labels("Biology")).toEqual(["Glycolysis · Location"]);
    });
  });

  describe("empty state", () => {
    it("shows an empty state with a next step", () => {
      renderList({ concepts: [] });
      expect(screen.getByText(/No weak concepts yet/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Study Flashcards" })).toHaveAttribute("href", "/quizzes");
      expect(screen.queryByRole("group", { name: "Filter weak concepts by divider" })).toBeNull();
    });
  });

  describe("each concept", () => {
    it("gives each concept one primary action, easy to tap", () => {
      renderOne(base);
      const primary = screen.getAllByRole("link").filter((a) => a.className.includes("bg-[#ff5e7a]"));
      expect(primary.map((a) => a.textContent)).toEqual(["Study Flashcards"]);
      expect(primary[0]).toHaveClass("h-11");
    });

    it("shows the lecture, where it was identified and a link to study the missed flashcards", async () => {
      renderOne(base);
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
      renderOne(recordingOnly);
      const [item] = screen.getAllByRole("listitem");
      expect(within(item).getByText("Weak point in 1 explanation recording")).toBeInTheDocument();
      expect(within(item).getByRole("link", { name: "View Feedback" })).toHaveAttribute("href", `/explain?recording=${RECORDING}`);
      expect(within(item).getByRole("link", { name: "View Notes" })).toHaveAttribute("href", `/lectures/${LECTURE}`);
      expect(within(item).queryByRole("link", { name: "Study Flashcards" })).not.toBeInTheDocument();
      expect(within(item).queryByText(/missed card/)).not.toBeInTheDocument();
    });

    it("lets the student pick any weak concept to explain out loud", () => {
      renderOne(base, recordingOnly);
      expect(screen.getAllByRole("link", { name: "Record Explanation" }).map((a) => a.getAttribute("href"))).toEqual([
        `/explain?concept=${base.id}`,
        `/explain?concept=${recordingOnly.id}`,
      ]);
    });

    it("keeps the given order (most recent first)", () => {
      renderOne(recordingOnly, base);
      expect(labels("Biology")).toEqual(["ATP yield", "Glycolysis · Location"]);
    });

    it("formats the date the same on the server and in the browser", () => {
      renderOne({ ...base, lastSeenAt: "2026-11-07T23:30:00.000Z" });
      expect(screen.getByText("11/7/2026")).toBeInTheDocument();
    });
  });
});
