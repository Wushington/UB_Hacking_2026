import { z } from "zod";
import { moveSubjectSchema } from "@/contracts/dividers";
import { jsonError, parseJson, userIdOr401 } from "@/lib/api";
import { moveSubject } from "@/lib/subjects/store";

/** PATCH /api/subjects/[id] — { dividerId } puts the subject under a divider, or null to take it out. 204 on success. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/subjects/[id]">) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError(404, "Subject not found");
  const input = await parseJson(request, moveSubjectSchema);
  if (input instanceof Response) return input;
  const result = await moveSubject(userId, id, input.dividerId);
  if (result === "subject-not-found") return jsonError(404, "Subject not found");
  if (result === "divider-not-found") return jsonError(404, "Divider not found");
  return new Response(null, { status: 204 });
}
