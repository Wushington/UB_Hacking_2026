import { describe, expect, it, vi } from "vitest";
import type { WeakConceptView } from "@/contracts/weak-concepts";
import { UnauthorizedError } from "@/lib/auth";
import { handleListWeakConcepts } from "./handler";
import { LECTURE_A, USER } from "./test-fixtures";

const view: WeakConceptView = {
  id: "77777777-7777-4777-8777-777777777701", lectureId: LECTURE_A, lectureTitle: "Respiration", label: "Glycolysis",
  missedCardCount: 1, explanationFeedbackCount: 0, lastSeenAt: "2026-11-07T10:00:00.000Z", relatedCards: [], feedbackRecordingId: null,
};

async function call(deps: Parameters<typeof handleListWeakConcepts>[0]) {
  const response = await handleListWeakConcepts(deps);
  return { status: response.status, body: await response.json() };
}

describe("GET /api/weak-concepts", () => {
  it("rejects signed-out users without querying", async () => {
    const list = vi.fn();
    const { status, body } = await call({ getUserId: async () => { throw new UnauthorizedError(); }, list });
    expect(status).toBe(401);
    expect(body.error.code).toBe("unauthorized");
    expect(list).not.toHaveBeenCalled();
  });

  it("lists only the signed-in user's weak concepts", async () => {
    const list = vi.fn(async () => [view]);
    const { status, body } = await call({ getUserId: async () => USER, list });
    expect(status).toBe(200);
    expect(list).toHaveBeenCalledWith(USER);
    expect(body).toEqual({ weakConcepts: [view] });
  });

  it("returns an empty list when nothing has been missed", async () => {
    expect(await call({ getUserId: async () => USER, list: async () => [] })).toEqual({ status: 200, body: { weakConcepts: [] } });
  });

  it("returns a truthful error when loading fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { status, body } = await call({ getUserId: async () => USER, list: async () => { throw new Error("db down"); } });
    expect(status).toBe(500);
    expect(body.error.code).toBe("load_failed");
  });
});
