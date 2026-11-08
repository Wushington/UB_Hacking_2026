import "server-only";
import type { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/auth";

/** JSON error body used by every API route: `{ error }`. Never put secrets or raw upstream errors here. */
export function jsonError(status: number, error: string) {
  return Response.json({ error }, { status });
}

/** Signed-in Clerk user id, or a 401 Response to return as-is. */
export async function userIdOr401(): Promise<string | Response> {
  try {
    return await requireUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) return jsonError(401, "Not signed in");
    throw error;
  }
}

/** Parses a JSON request body with a contract schema, or returns a 400 Response. */
export async function parseJson<S extends z.ZodType>(request: Request, schema: S): Promise<z.infer<S> | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, "Body must be JSON");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join(".") || "body"}: ${i.message}`).join("; ");
    return jsonError(400, problems);
  }
  return result.data;
}
