import { createLectureSchema, type CreateLectureResponse } from "@/contracts/lectures";
import { jsonError, parseJson, userIdOr401 } from "@/lib/api";
import { createLecture } from "@/lib/lectures/store";

/** POST /api/lectures — creates a draft set of notes (Capture page), optionally in a subject. */
export async function POST(request: Request) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;

  const input = await parseJson(request, createLectureSchema);
  if (input instanceof Response) return input;

  const id = await createLecture(userId, input.category);
  if (!id) return jsonError(404, "Subject not found");
  return Response.json({ id } satisfies CreateLectureResponse, { status: 201 });
}
