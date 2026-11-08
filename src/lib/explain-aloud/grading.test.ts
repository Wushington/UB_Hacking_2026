import { describe, expect, it } from "vitest";
import {
  buildGradingPrompt,
  formatNotes,
  GradingResponseError,
  MAX_WEAK_POINTS,
  normalizeConceptKey,
  parseGradingResponse,
  type GradingNotes,
} from "./grading";

const B1 = "11111111-1111-4111-8111-111111111111";
const B2 = "22222222-2222-4222-8222-222222222222";
const OTHER = "99999999-9999-4999-8999-999999999999";
const valid = new Set([B1, B2]);

const notes: GradingNotes = {
  lectureTitle: "Cellular respiration",
  sections: [
    { heading: "Electron transport chain", blocks: [{ id: B1, kind: "definition", text: "O₂ is the final electron acceptor." }] },
    { heading: "ATP synthase", blocks: [{ id: B2, kind: "bullet", text: "H⁺ flows back through ATP synthase." }] },
  ],
};

const wp = (overrides: Record<string, unknown> = {}) => ({
  conceptKey: "oxygen-final-electron-acceptor",
  label: "Give oxygen its specific role",
  explanation: "You said oxygen is involved; it is the final electron acceptor.",
  referenceNoteBlockIds: [B1],
  ...overrides,
});

describe("prompt", () => {
  it("lists every note block with its id so gaps can be grounded", () => {
    const text = formatNotes(notes);
    expect(text).toContain(`[${B1}] (definition) O₂ is the final electron acceptor.`);
    expect(text).toContain("## ATP synthase");
    expect(buildGradingPrompt(notes)).toContain(text);
  });
});

describe("normalizeConceptKey", () => {
  it("makes stable kebab-case keys", () => {
    expect(normalizeConceptKey("  Oxygen: Final Electron Acceptor! ")).toBe("oxygen-final-electron-acceptor");
    expect(normalizeConceptKey("H⁺ gradient")).toBe("h-gradient");
    expect(normalizeConceptKey("Café_flow")).toBe("cafe-flow");
  });
});

describe("parseGradingResponse", () => {
  it("returns the transcript and grounded weak points", () => {
    const result = parseGradingResponse(
      JSON.stringify({ transcriptText: "  Electrons go down the chain. ", weakPoints: [wp({ evidence: " involved near the end " })] }),
      valid,
    );
    expect(result).toEqual({
      transcriptText: "Electrons go down the chain.",
      weakPoints: [{ ...wp(), evidence: "involved near the end" }],
      covered: [],
    });
  });

  it("drops references to blocks outside this class, and weak points left ungrounded", () => {
    const result = parseGradingResponse(
      JSON.stringify({
        transcriptText: "text",
        weakPoints: [
          wp({ referenceNoteBlockIds: [OTHER, `[${B2}]`, B2] }),
          wp({ conceptKey: "made-up", referenceNoteBlockIds: [OTHER] }),
        ],
      }),
      valid,
    );
    expect(result.weakPoints).toHaveLength(1);
    expect(result.weakPoints[0].referenceNoteBlockIds).toEqual([B2]);
  });

  it("normalizes keys, merges duplicates, skips incomplete items and caps the count", () => {
    const many = Array.from({ length: MAX_WEAK_POINTS + 3 }, (_, i) => wp({ conceptKey: `Concept ${i}` }));
    const result = parseGradingResponse(
      JSON.stringify({
        transcriptText: "text",
        weakPoints: [wp({ conceptKey: "Concept 0" }), wp({ label: " " }), ...many],
      }),
      valid,
    );
    expect(result.weakPoints.map((w) => w.conceptKey)).toEqual(["concept-0", "concept-1", "concept-2", "concept-3"]);
  });

  it("accepts a solid explanation with no weak points", () => {
    expect(parseGradingResponse(JSON.stringify({ transcriptText: "All correct.", weakPoints: [] }), valid)).toEqual({
      transcriptText: "All correct.",
      weakPoints: [],
      covered: [],
    });
  });

  it("keeps the coaching summary, covered ideas and next step", () => {
    const result = parseGradingResponse(
      JSON.stringify({
        transcriptText: "text",
        summary: "  You've separated electron transport from ATP production. ",
        covered: [" NADH and FADH₂ supply electrons. ", "", "NADH and FADH₂ supply electrons.", 7, ...Array(10).fill("x")],
        nextStep: "Walk through the relay again, then finish with oxygen.",
        weakPoints: [],
      }),
      valid,
    );
    expect(result.summary).toBe("You've separated electron transport from ATP production.");
    // Trimmed, blank and non-text items dropped, duplicates merged.
    expect(result.covered).toEqual(["NADH and FADH₂ supply electrons.", "x"]);
    expect(result.nextStep).toBe("Walk through the relay again, then finish with oxygen.");
  });

  it("treats blank coaching fields as missing", () => {
    const result = parseGradingResponse(
      JSON.stringify({ transcriptText: "text", summary: "  ", covered: "not a list", nextStep: null, weakPoints: [] }),
      valid,
    );
    expect(result.summary).toBeUndefined();
    expect(result.covered).toEqual([]);
    expect(result.nextStep).toBeUndefined();
  });

  it("asks Gemini for the coaching fields", () => {
    const prompt = buildGradingPrompt(notes);
    expect(prompt).toMatch(/summary:/);
    expect(prompt).toMatch(/covered:/);
    expect(prompt).toMatch(/nextStep:/);
  });

  it("rejects non-JSON output", () => {
    expect(() => parseGradingResponse("Sure! Here is the feedback", valid)).toThrow(GradingResponseError);
    expect(() => parseGradingResponse(undefined, valid)).toThrow(GradingResponseError);
  });
});
