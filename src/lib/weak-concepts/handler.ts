import type { WeakConceptView } from "@/contracts/weak-concepts";
import { UnauthorizedError } from "@/lib/auth";

export type ListWeakConceptsDeps = {
  getUserId(): Promise<string>;
  /** The user's weak concepts, most recent first. */
  list(userId: string): Promise<WeakConceptView[]>;
};

const fail = (status: number, code: string, message: string) => Response.json({ error: { code, message } }, { status });

export async function handleListWeakConcepts(deps: ListWeakConceptsDeps): Promise<Response> {
  let userId: string;
  try {
    userId = await deps.getUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) return fail(401, "unauthorized", "Sign in to see your weak concepts.");
    throw error;
  }
  try {
    return Response.json({ weakConcepts: await deps.list(userId) });
  } catch (error) {
    console.error("Loading weak concepts failed", error);
    return fail(500, "load_failed", "Couldn't load your weak concepts. Please try again.");
  }
}
