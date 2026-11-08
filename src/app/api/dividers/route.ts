import { createDividerSchema, type Divider } from "@/contracts/dividers";
import { parseJson, userIdOr401 } from "@/lib/api";
import { createDivider } from "@/lib/subjects/store";

/** POST /api/dividers — adds a divider at the end of My subjects. */
export async function POST(request: Request) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;
  const input = await parseJson(request, createDividerSchema);
  if (input instanceof Response) return input;
  const divider: Divider = await createDivider(userId, input.name);
  return Response.json(divider, { status: 201 });
}
