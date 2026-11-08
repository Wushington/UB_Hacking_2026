import type { GeneratedCard } from "@/contracts/flashcards";
import type { LectureNotes } from "./generate";

/** Typed stand-in for saved lecture notes until the notes feature (#14/#16) writes real ones. */
export const BLOCK = {
  glycolysisWhere: "11111111-1111-4111-8111-111111111101",
  glycolysisYield: "11111111-1111-4111-8111-111111111102",
  krebsWhere: "11111111-1111-4111-8111-111111111103",
} as const;

export const LECTURE_ID = "22222222-2222-4222-8222-222222222201";

export const NOTES_FIXTURE: LectureNotes = {
  revision: 3,
  notes: {
    title: "Cellular respiration",
    sections: [
      {
        id: "33333333-3333-4333-8333-333333333301",
        heading: "Glycolysis",
        position: 0,
        blocks: [
          { id: BLOCK.glycolysisWhere, kind: "paragraph", text: "Glycolysis takes place in the cytosol.", sourceRefs: [] },
          { id: BLOCK.glycolysisYield, kind: "bullet", text: "Net yield: 2 ATP per glucose.", sourceRefs: [] },
        ],
      },
      {
        id: "33333333-3333-4333-8333-333333333302",
        heading: "Citric acid cycle",
        position: 1,
        blocks: [{ id: BLOCK.krebsWhere, kind: "paragraph", text: "The citric acid cycle runs in the mitochondrial matrix.", sourceRefs: [] }],
      },
    ],
  },
};

export function card(overrides: Partial<GeneratedCard> = {}): GeneratedCard {
  return {
    question: "Where does glycolysis take place?",
    answer: "In the cytosol.",
    sourceNoteBlockIds: [BLOCK.glycolysisWhere],
    conceptKey: "glycolysis-location",
    conceptLabel: "Glycolysis · Location",
    ...overrides,
  };
}

/** Three distinct, grounded cards. */
export const VALID_CARDS: GeneratedCard[] = [
  card(),
  card({ question: "What is the net ATP yield of glycolysis?", answer: "2 ATP per glucose.", sourceNoteBlockIds: [BLOCK.glycolysisYield], conceptKey: "glycolysis-yield", conceptLabel: "Glycolysis · Yield" }),
  card({ question: "Where does the citric acid cycle run?", answer: "In the mitochondrial matrix.", sourceNoteBlockIds: [BLOCK.krebsWhere], conceptKey: "krebs-location", conceptLabel: "Citric acid cycle" }),
];
