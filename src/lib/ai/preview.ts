import "server-only";
import { parseEnv } from "@/lib/env";
import { AiServiceError } from "./notes";

const TIMEOUT_MS = 30_000;

/** A display-friendly JPEG of a photo (browsers other than Safari can't show HEIC), from the AI service. */
export async function jpegPreview(
  bytes: Uint8Array,
  mimeType: string,
  { fetchImpl = fetch }: { fetchImpl?: typeof fetch } = {},
): Promise<Uint8Array> {
  let url: string;
  try {
    url = parseEnv("aiService").AI_SERVICE_URL;
  } catch (error) {
    throw new AiServiceError((error as Error).message, undefined, "unreachable");
  }
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart], { type: mimeType }), "photo");

  let res: Response;
  try {
    res = await fetchImpl(new URL("/preview", url), { method: "POST", body: form, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (error) {
    if ((error as Error)?.name === "TimeoutError") throw new AiServiceError("AI service timed out making a preview");
    throw new AiServiceError(`AI service unreachable at ${url}: ${(error as Error).message}`, undefined, "unreachable");
  }
  if (!res.ok) throw new AiServiceError(`AI service returned ${res.status} for a preview`, res.status);
  return new Uint8Array(await res.arrayBuffer());
}
