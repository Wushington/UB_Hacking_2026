import type { ExplainAloudData } from "./explain-aloud-screen";

/** Sample content from the Figma "Orbit Study · Explain aloud" frame. Replace with real data. */
export const sampleExplainAloud: ExplainAloudData = {
  course: "Cell Biology · BIO 201",
  concept: {
    title: "Oxidative phosphorylation",
    breadcrumb: "Cell Biology · Cellular respiration & ATP · Quiz Q4",
    prompt: "How do electrons, H⁺ and ATP synthase work together to make ATP?",
    attemptLabel: "Attempt 1 · Complete",
  },
  recording: {
    durationSeconds: 48,
    waveform: [8, 14, 22, 12, 30, 20, 36, 27, 16, 24, 34, 18, 28, 12, 20, 31, 40, 26, 14, 22, 30, 16, 10, 24, 34, 20, 14, 26, 18, 10, 15, 8],
    initialProgress: 13 / 32,
  },
  transcript: {
    text: "Electrons from NADH and FADH₂ go along the electron transport chain in the inner mitochondrial membrane. The energy pumps protons across the membrane. Then ATP synthase uses that stored energy to turn ADP into ATP. Oxygen is involved near the end, but I’m not sure exactly what it does.",
    footnote: "Recorded today · Only you can see this practice",
  },
  feedback: {
    summary:
      "You’ve separated electron transport from ATP production. Now make the path of H⁺ and the role of oxygen explicit.",
    covered: [
      "NADH and FADH₂ supply electrons to the transport chain.",
      "Electron transport releases energy to pump protons.",
      "ATP synthase couples stored energy to making ATP.",
    ],
    gaps: [
      {
        title: "Name the direction of proton flow",
        detail: "H⁺ is pumped into the intermembrane space, then flows back into the matrix through ATP synthase.",
      },
      {
        title: "Give oxygen its specific role",
        detail:
          "O₂ is the final electron acceptor. It combines with electrons and H⁺ to form water, keeping the chain moving.",
      },
    ],
    nextStep: {
      label: "TRY THIS NEXT · 45–60 SECONDS",
      text: "Walk through the energy relay again: electrons → H⁺ gradient → ATP. Name both sides of the membrane, then finish with what oxygen does.",
      reviewLabel: "Review the note before retrying",
      listStatus: "Still in your practice list",
    },
  },
};
