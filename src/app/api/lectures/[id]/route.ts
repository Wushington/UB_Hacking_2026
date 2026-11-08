import { z } from "zod";
import { changeSubjectSchema, type ChangeSubjectResponse } from "@/contracts/lectures";
import { jsonError, parseJson, userIdOr401 } from "@/lib/api";
import { changeLectureSubject, deleteLecture } from "@/lib/lectures/store";

const isId = (id: string) => z.uuid().safeParse(id).success;

/** PATCH /api/lectures/[id] — moves notes to another subject (by id, by name, or none). */
export async function PATCH(request: Request, ctx: RouteContext<"/api/lectures/[id]">) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;

  const { id } = await ctx.params;
  if (!isId(id)) return jsonError(404, "Notes not found");

  const input = await parseJson(request, changeSubjectSchema);
  if (input instanceof Response) return input;

  const result = await changeLectureSubject(userId, id, input.category);
  if (!result.ok) return jsonError(result.status, result.error);
  return Response.json({ subjectName: result.subjectName } satisfies ChangeSubjectResponse);
}

/**
 * DELETE /api/lectures/[id] — deletes notes and everything made from them. 204 on success.
 * `?unfinished=1` only deletes drafts and failed attempts (the Capture page's cleanup).
 */
export async function DELETE(request: Request, ctx: RouteContext<"/api/lectures/[id]">) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;

  const { id } = await ctx.params;
  if (!isId(id)) return jsonError(404, "Notes not found");

  const unfinishedOnly = new URL(request.url).searchParams.get("unfinished") === "1";
  const result = await deleteLecture(userId, id, { unfinishedOnly });
  if (!result.ok) return jsonError(result.status, result.error);
  return new Response(null, { status: 204 });
}
