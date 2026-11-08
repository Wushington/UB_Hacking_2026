import { describe, expect, it } from "vitest";
import { NEW_SUBJECT, NO_SUBJECT, subjectChoice } from "./subject-picker";

describe("subjectChoice", () => {
  it("maps the picker to the API choice", () => {
    const id = "8a3f1d2e-4b5c-4d6e-8f70-000000000001";
    expect(subjectChoice(id, "")).toEqual({ choice: { id } });
    expect(subjectChoice(NO_SUBJECT, "")).toEqual({ choice: null });
    expect(subjectChoice(NEW_SUBJECT, "  Physics ")).toEqual({ choice: { name: "Physics" } });
  });

  it("asks for a name when creating a subject", () => {
    expect(subjectChoice(NEW_SUBJECT, "  ")).toEqual({ error: expect.stringMatching(/name your new subject/i) });
  });
});
