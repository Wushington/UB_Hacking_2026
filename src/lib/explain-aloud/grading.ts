import { explanationFeedbackSchema, MAX_COVERED_IDEAS, type ExplanationFeedback } from "@/contracts/explanations";
import { normalizeConceptKey } from "@/contracts/weak-concepts";

/** Most gaps to report per attempt: enough to act on, few enough to not overwhelm. */
export const MAX_WEAK_POINTS = 4;

export type GradingNotes = {
  lectureTitle: string;
  sections: { heading: string; blocks: { id: string; kind: string; text: string }[] }[];
};

/** Notes as plain text with each block's id, so Gemini can cite exactly what a gap refers to. */
export function formatNotes(notes: GradingNotes): string {
  const lines = [`Class: ${notes.lectureTitle}`];
  for (const section of notes.sections) {
    lines.push("", `## ${section.heading}`);
    for (const block of section.blocks) lines.push(`[${block.id}] (${block.kind}) ${block.text}`);
  }
  return lines.join("\n");
}

/** A weak concept the student still has open for this class (shown to Gemini to judge mastery). */
export type OpenConcept = { conceptKey: string; label: string };

/** Most open weak concepts to send per attempt (newest first). */
export const MAX_OPEN_CONCEPTS = 15;

function openConceptsSection(openConcepts: readonly OpenConcept[], resolvedConcepts: readonly OpenConcept[]): string {
  const list = (concepts: readonly OpenConcept[]) => concepts.map((c) => `- ${c.conceptKey} — ${c.label}`).join("\n");
  // Resolved concepts are shown only so a renewed struggle reuses (and so reopens) the same key.
  const resolved =
    resolvedConcepts.length > 0
      ? `\n\nThese concepts were previously resolved (conceptKey — label). They can't be mastered again, but if a weak point you report is the same idea as one of them, reuse its exact key:\n${list(resolvedConcepts)}`
      : "";
  if (openConcepts.length === 0) {
    return `4. masteredConceptKeys: the student has no open weak concepts for this class, so return an empty list.${resolved}`;
  }
  return `4. The student previously struggled with these concepts (conceptKey — label):
${list(openConcepts)}

- masteredConceptKeys: the keys from this list that this explanation now explains correctly and completely according to the notes. Only include a concept if the student clearly stated the correct idea; if they skipped it, were vague, or you're unsure, leave it out. Use only keys from this list, exactly as written.
- If a weak point you report is the same idea as one of these concepts, reuse that concept's exact key instead of inventing a new one, and do not also list it in masteredConceptKeys.${resolved}`;
}

/** What the student said they were going to explain (their selected weak concept), if any. */
function chosenConceptSection(chosen: OpenConcept | null): string {
  if (!chosen) return "";
  return `
The student chose to explain this concept: "${chosen.label}" (conceptKey: ${chosen.conceptKey}). Judge the explanation mainly on this concept: focus the weak points on what is missing or wrong about it, and if they now explain it correctly and completely, include ${chosen.conceptKey} in masteredConceptKeys. Don't flag other topics from the notes just because they weren't mentioned.
`;
}

export function buildGradingPrompt(
  notes: GradingNotes,
  openConcepts: readonly OpenConcept[] = [],
  resolvedConcepts: readonly OpenConcept[] = [],
  chosenConcept: OpenConcept | null = null,
): string {
  return `You are a warm, precise study coach. The attached audio is a student explaining a concept from their class out loud, in their own words (up to 2 minutes).
${chosenConceptSection(chosenConcept)}
1. Transcribe the student's speech faithfully into "transcriptText". Remove filler words (um, uh), keep everything else. If there is no intelligible speech, return an empty transcriptText and no weakPoints.
2. Compare the explanation with the class notes below. Report the most important gaps: ideas from the notes that the student left out, stated vaguely, or got wrong, and that matter for understanding the concept they chose to explain. Don't flag topics they didn't attempt to cover, phrasing, accent, or filler. If the explanation is solid, return an empty weakPoints list.

For each weak point (at most ${MAX_WEAK_POINTS}, most important first):
- conceptKey: a short, stable, lowercase kebab-case id for the underlying idea, e.g. "oxygen-final-electron-acceptor". Use the same key for the same idea on every attempt.
- label: a short action the student should take, at most 8 words, e.g. "Give oxygen its specific role".
- explanation: 1–2 sentences, addressed to the student ("you"), naming what was missing or wrong and stating the correct idea from the notes.
- referenceNoteBlockIds: the ids (the values in square brackets) of the note blocks that support this point. Use only ids that appear in the notes.
- evidence: optional short quote from the transcript showing the gap.

3. Coach the student (address them as "you"; warm, specific, never generic praise):
- summary: 1–2 sentences on what landed and the single most useful thing to sharpen. If they did well, say so plainly.
- covered: up to ${MAX_COVERED_IDEAS} ideas from the notes the student explained correctly, each a short statement of the idea itself (e.g. "NADH and FADH₂ supply electrons to the transport chain."). Only include ideas they actually stated; empty if none.
- nextStep: one concrete instruction for their next 45–60 second attempt, e.g. "Walk through the energy relay again: electrons → H⁺ gradient → ATP, then finish with what oxygen does."
If there is no intelligible speech, leave summary and nextStep empty and covered empty.

${openConceptsSection(openConcepts, resolvedConcepts)}

Class notes:
${formatNotes(notes)}`;
}

/** JSON schema for Gemini's structured output (validated again with the contract afterwards). */
export const GRADING_RESPONSE_JSON_SCHEMA = {
  type: "object",
  properties: {
    transcriptText: { type: "string" },
    summary: { type: "string" },
    covered: { type: "array", maxItems: MAX_COVERED_IDEAS, items: { type: "string" } },
    nextStep: { type: "string" },
    masteredConceptKeys: { type: "array", items: { type: "string" } },
    weakPoints: {
      type: "array",
      maxItems: MAX_WEAK_POINTS,
      items: {
        type: "object",
        properties: {
          conceptKey: { type: "string" },
          label: { type: "string" },
          explanation: { type: "string" },
          referenceNoteBlockIds: { type: "array", items: { type: "string" } },
          evidence: { type: "string" },
        },
        required: ["conceptKey", "label", "explanation", "referenceNoteBlockIds"],
      },
    },
  },
  required: ["transcriptText", "summary", "covered", "nextStep", "weakPoints", "masteredConceptKeys"],
} as const;

/** Trimmed non-empty string, or undefined. */
function optionalText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// Shared with flashcard concepts so both sources merge into the same weak concept.
export { normalizeConceptKey };

export class GradingResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GradingResponseError";
  }
}

/**
 * Parses and grounds Gemini's answer: normalizes concept keys, keeps only note-block ids that
 * really belong to this class, drops weak points with no valid reference (the contract requires
 * every weakness to be grounded), merges duplicates, then validates with the shared contract.
 */
export function parseGradingResponse(
  text: string | undefined,
  validBlockIds: ReadonlySet<string>,
  openConceptKeys: ReadonlySet<string> = new Set(),
): ExplanationFeedback {
  let raw: unknown;
  try {
    raw = JSON.parse(text ?? "");
  } catch {
    throw new GradingResponseError("Gemini did not return JSON");
  }
  if (typeof raw !== "object" || raw === null) throw new GradingResponseError("Gemini returned an unexpected shape");
  const { transcriptText, weakPoints, summary, covered, nextStep, masteredConceptKeys } = raw as Record<string, unknown>;

  const byKey = new Map<string, Record<string, unknown>>();
  for (const item of Array.isArray(weakPoints) ? weakPoints : []) {
    if (typeof item !== "object" || item === null) continue;
    const wp = item as Record<string, unknown>;
    const conceptKey = normalizeConceptKey(String(wp.conceptKey ?? wp.label ?? ""));
    const refs = Array.isArray(wp.referenceNoteBlockIds)
      ? [...new Set(wp.referenceNoteBlockIds.map(String).map((id) => id.replace(/^\[|\]$/g, "").trim()))].filter((id) =>
          validBlockIds.has(id),
        )
      : [];
    const label = typeof wp.label === "string" ? wp.label.trim() : "";
    const explanation = typeof wp.explanation === "string" ? wp.explanation.trim() : "";
    if (!conceptKey || !label || !explanation || refs.length === 0 || byKey.has(conceptKey)) continue;
    const evidence = typeof wp.evidence === "string" && wp.evidence.trim() ? wp.evidence.trim() : undefined;
    byKey.set(conceptKey, {
      conceptKey,
      label,
      explanation,
      referenceNoteBlockIds: refs,
      ...(evidence ? { evidence } : {}),
    });
  }

  const coveredIdeas = Array.isArray(covered)
    ? [...new Set(covered.map(optionalText).filter((c): c is string => c !== undefined))].slice(0, MAX_COVERED_IDEAS)
    : [];

  // Only concepts the student actually has open, and never one this same attempt flagged as a gap.
  const mastered = Array.isArray(masteredConceptKeys)
    ? [
        ...new Set(
          masteredConceptKeys
            .map(optionalText)
            .filter((k): k is string => k !== undefined)
            .map(normalizeConceptKey),
        ),
      ].filter((key) => openConceptKeys.has(key) && !byKey.has(key))
    : [];

  const result = explanationFeedbackSchema.safeParse({
    transcriptText: typeof transcriptText === "string" ? transcriptText.trim() : "",
    weakPoints: [...byKey.values()].slice(0, MAX_WEAK_POINTS),
    summary: optionalText(summary),
    covered: coveredIdeas,
    nextStep: optionalText(nextStep),
    masteredConceptKeys: mastered,
  });
  if (!result.success) throw new GradingResponseError("Gemini's feedback didn't match the contract");
  return result.data;
}
