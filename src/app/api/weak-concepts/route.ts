import { requireUserId } from "@/lib/auth";
import { handleListWeakConcepts } from "@/lib/weak-concepts/handler";
import { listWeakConcepts } from "@/lib/weak-concepts/store";

/** Story #24: the signed-in user's weak concepts, most recent first. */
export async function GET() {
  return handleListWeakConcepts({ getUserId: requireUserId, list: listWeakConcepts });
}
