import { z } from "zod";
import type { NotesSavedResponse } from "@/contracts/lectures";
import { notesUpdateSchema } from "@/contracts/notes";
import { jsonError, parseJson, userIdOr401 } from "@/lib/api";
import { discardUnfinishedLecture, saveLectureNotes } from "@/lib/lectures/store";

/**
 * PATCH /api/lectures/[id] — saves the notes editor (full replacement), guarded by baseRevision.
 * 409 with `revision` when someone saved in between.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/lectures/[id]">) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError(404, "Class not found");

  const input = await parseJson(request, notesUpdateSchema);
  if (input instanceof Response) return input;

  const result = await saveLectureNotes(userId, id, input);
  if (!result.ok) {
    return Response.json({ error: result.error, revision: result.revision }, { status: result.status });
  }
  return Response.json({ revision: result.revision } satisfies NotesSavedResponse);
}

/** DELETE /api/lectures/[id] — discards an unfinished (draft or failed) class and its photos. 204 on success. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/lectures/[id]">) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError(404, "Class not found");

  const result = await discardUnfinishedLecture(userId, id);
  if (!result.ok) return jsonError(result.status, result.error);
  return new Response(null, { status: 204 });
}
