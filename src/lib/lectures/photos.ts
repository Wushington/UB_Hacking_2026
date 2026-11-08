/**
 * Serving a lecture's original photos (GET /api/lectures/[id]/images/[imageId]).
 *
 * The bucket is private, so the route checks ownership and redirects to a short-lived presigned URL.
 * Browsers other than Safari can't display HEIC, so for HEIC/HEIF the route serves a JPEG preview
 * stored next to the original (`<key>.preview.jpg`), generating it via the AI service on first view.
 */

export type PhotoRecord = { objectKey: string; mimeType: string };

export type PhotoDeps = {
  /** The image if it belongs to this user's lecture, else null. */
  findImage(userId: string, lectureId: string, imageId: string): Promise<PhotoRecord | null>;
  exists(key: string): Promise<boolean>;
  getBytes(key: string): Promise<Uint8Array>;
  makePreview(bytes: Uint8Array, mimeType: string): Promise<Uint8Array>;
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  presign(key: string): Promise<string>;
};

const NEEDS_PREVIEW = new Set(["image/heic", "image/heif"]);

export const previewKeyFor = (objectKey: string) => `${objectKey}.preview.jpg`;

/** Presigned URLs live 300s; let the browser reuse the redirect for a bit less than that. */
const CACHE = "private, max-age=240";

const error = (status: number, message: string) => Response.json({ error: message }, { status });

export async function handlePhotoRequest(userId: string, lectureId: string, imageId: string, deps: PhotoDeps): Promise<Response> {
  const image = await deps.findImage(userId, lectureId, imageId);
  if (!image) return error(404, "Photo not found");

  let key = image.objectKey;
  if (NEEDS_PREVIEW.has(image.mimeType)) {
    key = previewKeyFor(image.objectKey);
    try {
      if (!(await deps.exists(key))) {
        const jpeg = await deps.makePreview(await deps.getBytes(image.objectKey), image.mimeType);
        await deps.put(key, jpeg, "image/jpeg");
      }
    } catch (e) {
      console.error("Photo preview failed:", (e as Error).message);
      return error(503, "This photo can’t be shown right now");
    }
  }

  const url = await deps.presign(key);
  return new Response(null, { status: 302, headers: { Location: url, "Cache-Control": CACHE } });
}
