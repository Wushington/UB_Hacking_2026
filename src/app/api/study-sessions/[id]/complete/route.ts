import { requireUserId } from "@/lib/auth";
import { handleCompleteSession } from "@/lib/study/handler";
import { completeStudySession, loadStudySession } from "@/lib/study/store";

/** Stories #20 + #24: save a finished session's results and update weak concepts from missed cards. */
export async function POST(request: Request, ctx: RouteContext<"/api/study-sessions/[id]/complete">) {
  const { id } = await ctx.params;
  return handleCompleteSession(request, id, {
    getUserId: requireUserId,
    loadSession: loadStudySession,
    completeSession: completeStudySession,
  });
}
