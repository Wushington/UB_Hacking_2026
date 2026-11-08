import { z } from "zod";
import { selfRatingSchema } from "@/contracts/explanations";
import { jsonError, parseJson, userIdOr401 } from "@/lib/api";
import { applySelfRating } from "@/lib/explain-aloud/self-rating";

/**
 * The student rates their own (AI-judged sound) explanation 1–5. This is their confirmation
 * before the weak concepts it mastered are cleared: 4–5 removes them, 1–3 marks them resolved.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/explanations/[recordingId]/self-rating">) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;

  const { recordingId } = await ctx.params;
  if (!z.uuid().safeParse(recordingId).success) return jsonError(404, "Recording not found");

  const input = await parseJson(request, selfRatingSchema);
  if (input instanceof Response) return input;

  const result = await applySelfRating(userId, recordingId, input.rating);
  if (!result.ok) return jsonError(result.status, result.error);
  return Response.json(result.response);
}
