import { after } from "next/server";
import { z } from "zod";
import { jsonError, userIdOr401 } from "@/lib/api";
import { claimForGrading, runGrading } from "@/lib/explain-aloud/grade";

/** Grading (Gemini on up to 2 minutes of audio) runs after the response; give it room. */
export const maxDuration = 120;

/**
 * Starts (or retries) grading one of the user's explanation attempts. Idempotent: if grading is
 * already running or done, it just reports the status. Grading itself runs after the response;
 * the page polls until the attempt is ready or failed.
 */
export async function POST(_request: Request, ctx: RouteContext<"/api/explanations/[recordingId]/grade">) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;

  const { recordingId } = await ctx.params;
  if (!z.uuid().safeParse(recordingId).success) return jsonError(404, "Recording not found");

  const result = await claimForGrading(userId, recordingId);
  if (!result.claimed) {
    if (result.status === "not-found") return jsonError(404, "Recording not found");
    return Response.json({ status: result.status });
  }

  const { claimed } = result;
  after(() => runGrading(claimed));
  return Response.json({ status: "processing" }, { status: 202 });
}
