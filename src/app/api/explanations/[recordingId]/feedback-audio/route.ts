import type { NextRequest } from "next/server";
import { z } from "zod";
import { requireUserId, UnauthorizedError } from "@/lib/auth";
import { ElevenLabsError, synthesizeSpeech } from "@/lib/elevenlabs";
import { getExplainAloudView } from "@/lib/explain-aloud/queries";
import { feedbackSpeechText } from "@/lib/explain-aloud/view";

/**
 * Streams the AI feedback for one of the signed-in user's explanation attempts, read aloud by
 * ElevenLabs. The script is built here from the owner's rows; the client never supplies text.
 */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/explanations/[recordingId]/feedback-audio">) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) return new Response("Not signed in", { status: 401 });
    throw error;
  }

  const { recordingId } = await ctx.params;
  if (!z.uuid().safeParse(recordingId).success) return new Response("Not found", { status: 404 });

  const view = await getExplainAloudView(userId, recordingId);
  // getExplainAloudView falls back to the latest attempt; only the exact, owned recording counts here.
  const script = view.recordingId === recordingId ? feedbackSpeechText(view) : null;
  if (!script) return new Response("Not found", { status: 404 });

  try {
    const upstream = await synthesizeSpeech(script, { signal: request.signal });
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    if (error instanceof ElevenLabsError) {
      console.error(error.message);
      return new Response("Text-to-speech unavailable", { status: 502 });
    }
    throw error;
  }
}
