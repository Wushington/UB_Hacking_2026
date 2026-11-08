import { z } from "zod";
import { jpegPreview } from "@/lib/ai/preview";
import { jsonError, userIdOr401 } from "@/lib/api";
import { handlePhotoRequest } from "@/lib/lectures/photos";
import { findLecturePhoto } from "@/lib/lectures/store";
import { getObjectBytes, headObject, presignDownload, putObject } from "@/lib/storage";

/** GET /api/lectures/[id]/images/[imageId] — redirects to the photo (a JPEG preview for HEIC). */
export async function GET(_request: Request, ctx: RouteContext<"/api/lectures/[id]/images/[imageId]">) {
  const userId = await userIdOr401();
  if (userId instanceof Response) return userId;

  const { id, imageId } = await ctx.params;
  if (!z.uuid().safeParse(id).success || !z.uuid().safeParse(imageId).success) return jsonError(404, "Photo not found");

  return handlePhotoRequest(userId, id, imageId, {
    findImage: findLecturePhoto,
    exists: async (key) => (await headObject(key)) !== null,
    getBytes: getObjectBytes,
    makePreview: (bytes, mimeType) => jpegPreview(bytes, mimeType),
    put: putObject,
    presign: presignDownload,
  });
}
