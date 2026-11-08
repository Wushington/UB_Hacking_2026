import { z } from "zod";
import { updateDividerSchema } from "@/contracts/dividers";
import { jsonError, parseJson, userIdOr401 } from "@/lib/api";
import { deleteDivider, updateDivider } from "@/lib/subjects/store";

/** PATCH /api/dividers/[id] — rename, collapse/expand, or move up/down. 204 on success. */
export async function PATCH(request: Request, ctx: RouteContext<"/api/dividers/[id]">) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError(404, "Divider not found");
  const input = await parseJson(request, updateDividerSchema);
  if (input instanceof Response) return input;
  if (!(await updateDivider(userId, id, input))) return jsonError(404, "Divider not found");
  return new Response(null, { status: 204 });
}

/** DELETE /api/dividers/[id] — its subjects move back above the dividers; nothing else is deleted. */
export async function DELETE(_request: Request, ctx: RouteContext<"/api/dividers/[id]">) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return jsonError(404, "Divider not found");
  if (!(await deleteDivider(userId, id))) return jsonError(404, "Divider not found");
  return new Response(null, { status: 204 });
}
