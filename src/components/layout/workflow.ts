/** The primary journey through Orbit Study. `matches` marks the step a page belongs to. */
export const STUDY_WORKFLOW: { label: string; matches: (pathname: string) => boolean }[] = [
  { label: "Upload Notes", matches: (p) => p === "/capture" },
  { label: "Generate Flashcards", matches: (p) => /^\/lectures\/[^/]+$/.test(p) },
  { label: "Study", matches: (p) => p.startsWith("/quizzes") || /^\/lectures\/[^/]+\/study$/.test(p) },
  { label: "Review Weak Concepts", matches: (p) => p.startsWith("/weak-concepts") || p.startsWith("/explain") },
];
