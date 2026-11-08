import { requireUserId } from "@/lib/auth";
import { handleStartSession } from "@/lib/study/handler";
import { createStudySession } from "@/lib/study/store";

/** Story #20: start a study session on one of the user's decks. */
export async function POST(request: Request, ctx: RouteContext<"/api/decks/[id]/sessions">) {
  const { id } = await ctx.params;
  return handleStartSession(request, id, { getUserId: requireUserId, createSession: createStudySession });
}
