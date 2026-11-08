import { beforeEach, describe, expect, it, vi } from "vitest";

const generateContent = vi.fn();
vi.mock("@/lib/gemini", () => ({
  GEMINI_MODEL: "test-model",
  getGemini: () => ({ models: { generateContent } }),
}));

const { generateFlashcardsWithGemini } = await import("./gemini");

type Schema = { [key: string]: unknown };

function sentSchema(): Schema {
  return generateContent.mock.calls[0][0].config.responseJsonSchema as Schema;
}

function hasKeyDeep(value: unknown, key: string): boolean {
  if (Array.isArray(value)) return value.some((v) => hasKeyDeep(v, key));
  if (value && typeof value === "object") {
    return Object.entries(value).some(([k, v]) => k === key || hasKeyDeep(v, key));
  }
  return false;
}

describe("generateFlashcardsWithGemini", () => {
  beforeEach(() => {
    generateContent.mockReset();
    generateContent.mockResolvedValue({ text: JSON.stringify({ cards: [] }) });
  });

  it("does not send maxItems, which Gemini rejects with 400 INVALID_ARGUMENT for this schema", async () => {
    await generateFlashcardsWithGemini("prompt");
    expect(hasKeyDeep(sentSchema(), "maxItems")).toBe(false);
  });

  it("still asks for every card field as JSON", async () => {
    await generateFlashcardsWithGemini("prompt");
    const { config, model } = generateContent.mock.calls[0][0];
    expect(model).toBe("test-model");
    expect(config.responseMimeType).toBe("application/json");
    const items = (sentSchema().properties as { cards: { items: { required: string[] } } }).cards.items;
    expect(items.required).toEqual(["question", "answer", "sourceNoteBlockIds", "conceptKey", "conceptLabel"]);
  });

  it("returns the parsed JSON for the handler to validate", async () => {
    generateContent.mockResolvedValue({ text: '{"cards":[{"question":"q"}]}' });
    await expect(generateFlashcardsWithGemini("prompt")).resolves.toEqual({ cards: [{ question: "q" }] });
  });
});
