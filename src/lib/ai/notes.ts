import "server-only";
import { notesGenerationSchema, type NotesGeneration } from "@/contracts/notes";
import { parseEnv } from "@/lib/env";

/**
 * Client for the Python AI service (src/ai-service): whiteboard/notebook photos -> notes.
 * Server-to-server only. Every other Gemini feature calls src/lib/gemini.ts directly.
 */

/** Gemini on a 1–5 image batch, with retries on the Python side, can take a while. */
const TIMEOUT_MS = 120_000;

export interface NoteImage {
  /** lecture_images.id; the service echoes it back in each block's sourceRefs. */
  id: string;
  mimeType: string;
  bytes: Uint8Array;
}

export class AiServiceError extends Error {
  constructor(
    message: string,
    /** HTTP status from the service, or undefined if it could not be reached. */
    readonly status?: number,
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}

/**
 * Sends the batch (in the student's order) to the AI service and returns validated notes.
 * Rejects source refs that point outside this batch, so stored refs are always real images.
 */
export async function generateNotesFromImages(
  images: NoteImage[],
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {},
): Promise<NotesGeneration> {
  const { AI_SERVICE_URL } = parseEnv("aiService");

  const form = new FormData();
  for (const image of images) {
    form.append("files", new Blob([image.bytes as BlobPart], { type: image.mimeType }), image.id);
    form.append("image_ids", image.id);
  }

  let res: Response;
  try {
    res = await fetchImpl(new URL("/process-notes", AI_SERVICE_URL), {
      method: "POST",
      body: form,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new AiServiceError(`AI service unreachable: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!res.ok) {
    throw new AiServiceError(`AI service returned ${res.status}: ${await detail(res)}`, res.status);
  }

  const parsed = notesGenerationSchema.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    throw new AiServiceError(`AI service returned invalid notes: ${parsed.error.message}`);
  }

  const batch = new Set(images.map((i) => i.id));
  for (const block of parsed.data.sections.flatMap((s) => s.blocks)) {
    if (block.sourceRefs.some((ref) => !batch.has(ref.imageId))) {
      throw new AiServiceError("AI service cited an image outside this batch");
    }
  }
  return parsed.data;
}

/** FastAPI errors look like {"detail": "..."}; fall back to the raw body. */
async function detail(res: Response): Promise<string> {
  const body = await res.text().catch(() => "");
  try {
    const json = JSON.parse(body) as { detail?: unknown };
    if (typeof json.detail === "string") return json.detail;
  } catch {}
  return body.slice(0, 500);
}
