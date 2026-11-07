import { z } from "zod";
import { nonEmptyText } from "./shared";

export const RECORDING_PURPOSES = ["lecture", "explanation"] as const;
export const RECORDING_STATUSES = ["uploaded", "processing", "ready", "failed"] as const;
export const AUDIO_MIME_TYPES = ["audio/webm", "audio/ogg", "audio/mpeg", "audio/mp4", "audio/wav"] as const;

/** Story #10: 10 minutes per lecture recording; story #12: 2 minutes per explanation. */
export const MAX_RECORDING_MS = { lecture: 10 * 60_000, explanation: 2 * 60_000 } as const;

export const transcriptSegmentSchema = z
  .object({
    startMs: z.number().int().nonnegative(),
    endMs: z.number().int().nonnegative().optional(),
    text: nonEmptyText,
  })
  .refine((s) => s.endMs === undefined || s.endMs >= s.startMs, "endMs must be >= startMs");
export type TranscriptSegment = z.infer<typeof transcriptSegmentSchema>;

/** Gemini transcription output. Timestamps are approximate unless verified. */
export const transcriptResultSchema = z.object({
  segments: z
    .array(transcriptSegmentSchema)
    .refine((s) => s.every((seg, i) => i === 0 || seg.startMs >= s[i - 1].startMs), "Segments must be ordered"),
  timestampsApproximate: z.boolean(),
});
export type TranscriptResult = z.infer<typeof transcriptResultSchema>;
