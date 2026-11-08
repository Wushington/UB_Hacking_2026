import type { StudyCard } from "@/lib/study/session";

const cards: StudyCard[] = [
  {
    id: "8cdf2bb3-119c-40d3-b25a-711f90e51101",
    question: "Where does glycolysis take place?",
    answer: "In the cytosol, the fluid portion of the cytoplasm.",
    conceptLabel: "Glycolysis · Location",
  },
  {
    id: "8cdf2bb3-119c-40d3-b25a-711f90e51102",
    question: "What is the net ATP yield of glycolysis per glucose molecule?",
    answer: "2 ATP: glycolysis produces 4 ATP but uses 2 ATP to get started.",
    conceptLabel: "Glycolysis · Energy yield",
  },
  {
    id: "8cdf2bb3-119c-40d3-b25a-711f90e51103",
    question: "What role does NADH play in cellular respiration?",
    answer: "NADH carries high-energy electrons to the electron transport chain, where their energy helps build a proton gradient.",
    conceptLabel: "Electron carriers",
  },
  {
    id: "8cdf2bb3-119c-40d3-b25a-711f90e51104",
    question: "What powers ATP synthase?",
    answer: "Protons flowing down their electrochemical gradient through ATP synthase drive the formation of ATP from ADP and phosphate.",
    conceptLabel: "Oxidative phosphorylation",
  },
  {
    id: "8cdf2bb3-119c-40d3-b25a-711f90e51105",
    question: "What is the final electron acceptor in aerobic respiration?",
    answer: "Oxygen accepts electrons and combines with protons to form water at the end of the electron transport chain.",
    conceptLabel: "Electron transport chain",
  },
  {
    id: "8cdf2bb3-119c-40d3-b25a-711f90e51106",
    question: "Where does the citric acid cycle take place in eukaryotic cells?",
    answer: "In the mitochondrial matrix.",
    conceptLabel: "Citric acid cycle · Location",
  },
];

export const SAMPLE_DECK = {
  title: "Cellular respiration & ATP",
  subtitle: "Cell Biology · Sample deck",
  cards,
};
