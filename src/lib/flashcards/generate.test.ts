import { describe, expect, it } from "vitest";
import { buildFlashcardPrompt, selectValidCards, shortfallMessage } from "./generate";
import { BLOCK, card, NOTES_FIXTURE, VALID_CARDS } from "./test-fixtures";

const notes = NOTES_FIXTURE.notes;

describe("buildFlashcardPrompt", () => {
  it("asks for at most the requested count and includes every note block id and text", () => {
    const prompt = buildFlashcardPrompt(notes, 7);
    expect(prompt).toContain("at most 7");
    for (const block of notes.sections.flatMap((s) => s.blocks)) {
      expect(prompt).toContain(block.id);
      expect(prompt).toContain(block.text);
    }
    expect(prompt).toMatch(/only.*notes/i);
  });
});

describe("selectValidCards", () => {
  it("returns null when the response doesn't match the schema", () => {
    expect(selectValidCards({ cards: [{ question: "Q?" }] }, notes, 5)).toBeNull();
    expect(selectValidCards({ cards: "nope" }, notes, 5)).toBeNull();
    expect(selectValidCards(null, notes, 5)).toBeNull();
  });

  it("keeps grounded, distinct cards", () => {
    expect(selectValidCards({ cards: VALID_CARDS }, notes, 10)).toEqual(VALID_CARDS);
  });

  it("drops cards citing note blocks that aren't in these notes", () => {
    const foreign = card({ question: "Invented?", sourceNoteBlockIds: ["99999999-9999-4999-8999-999999999999"] });
    const mixed = card({ question: "Partly invented?", sourceNoteBlockIds: [BLOCK.krebsWhere, "99999999-9999-4999-8999-999999999999"] });
    expect(selectValidCards({ cards: [foreign, mixed, VALID_CARDS[1]] }, notes, 10)).toEqual([VALID_CARDS[1]]);
  });

  it("drops cards with no source note reference (unsupported by the notes)", () => {
    expect(selectValidCards({ cards: [card({ sourceNoteBlockIds: [] })] }, notes, 10)).toEqual([]);
  });

  it("drops duplicate questions ignoring case, spacing and trailing punctuation", () => {
    const dupe = card({ question: "  where does   GLYCOLYSIS take place ", answer: "Cytosol" });
    expect(selectValidCards({ cards: [VALID_CARDS[0], dupe] }, notes, 10)).toEqual([VALID_CARDS[0]]);
  });

  it("caps the result at the requested count", () => {
    expect(selectValidCards({ cards: VALID_CARDS }, notes, 2)).toEqual(VALID_CARDS.slice(0, 2));
  });

  it("normalizes concept keys and de-duplicates source ids", () => {
    const raw = card({ conceptKey: " Glycolysis Location! ", sourceNoteBlockIds: [BLOCK.glycolysisWhere, BLOCK.glycolysisWhere] });
    expect(selectValidCards({ cards: [raw] }, notes, 1)).toEqual([
      card({ conceptKey: "glycolysis-location", sourceNoteBlockIds: [BLOCK.glycolysisWhere] }),
    ]);
  });
});

describe("shortfallMessage", () => {
  it("is null when the requested number was generated", () => {
    expect(shortfallMessage(5, 5)).toBeNull();
  });

  it("explains how many the notes supported", () => {
    expect(shortfallMessage(10, 3)).toBe(
      "You asked for 10 flashcards, but your notes only had enough distinct material for 3. Add more detail to your notes to get more cards.",
    );
  });
});
