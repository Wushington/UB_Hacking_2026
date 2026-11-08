import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { IMAGE_MIME_TYPES, imageBatchSchema } from "@/contracts/images";
import type { NoteSection, ProcessedNotes } from "@/contracts/notes";
import { getDb, schema } from "@/db";
import { AiServiceError, generateNotesFromImages } from "@/lib/ai/notes";
import { UnauthorizedError, requireUserId } from "@/lib/auth";
import { getObjectBytes } from "@/lib/storage";

const { lectures, lectureImages, noteBlocks, noteSections } = schema;

/**
 * POST /api/lectures/[id]/process — body: { imageIds } (2–5, in the student's order).
 * Sends the lecture's images to the AI service and saves the generated notes.
 * Returns ProcessedNotes (same shape as GET /api/lectures/[id]).
 */
export async function POST(request: Request, ctx: RouteContext<"/api/lectures/[id]/process">) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch (error) {
    if (error instanceof UnauthorizedError) return problem(401, "Not signed in");
    throw error;
  }

  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return problem(404, "Lecture not found");

  const body = imageBatchSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return problem(422, body.error.issues.map((i) => i.message).join("; "));
  const { imageIds } = body.data;

  const db = getDb();
  const owned = and(eq(lectures.id, id), eq(lectures.userId, userId));

  const [lecture] = await db.select({ status: lectures.status }).from(lectures).where(owned);
  if (!lecture) return problem(404, "Lecture not found");

  // Only this lecture's own images, owned by this user.
  const rows = await db
    .select({ id: lectureImages.id, objectKey: lectureImages.objectKey, mimeType: lectureImages.mimeType })
    .from(lectureImages)
    .where(
      and(
        inArray(lectureImages.id, imageIds),
        eq(lectureImages.lectureId, id),
        eq(lectureImages.userId, userId),
      ),
    );
  if (rows.length !== imageIds.length) return problem(422, "Some images don't belong to this lecture");
  if (rows.some((r) => !(IMAGE_MIME_TYPES as readonly string[]).includes(r.mimeType))) {
    return problem(422, "Images must be JPG, PNG or WebP");
  }

  // Claim the lecture atomically so a double-click can't process it twice.
  const claimed = await db
    .update(lectures)
    .set({ status: "processing" })
    .where(and(owned, inArray(lectures.status, ["draft", "failed"])))
    .returning({ id: lectures.id });
  if (claimed.length === 0) {
    return problem(409, lecture.status === "ready" ? "Notes were already generated" : "Already processing");
  }

  try {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const images = await Promise.all(
      imageIds.map(async (imageId) => {
        const row = byId.get(imageId)!;
        return { id: imageId, mimeType: row.mimeType, bytes: await getObjectBytes(row.objectKey) };
      }),
    );

    const notes = await generateNotesFromImages(images);

    const saved = await db.transaction(async (tx) => {
      const sections: NoteSection[] = [];
      for (const [position, section] of notes.sections.entries()) {
        const [row] = await tx
          .insert(noteSections)
          .values({ lectureId: id, heading: section.heading, position })
          .returning({ id: noteSections.id });
        const blocks = await tx
          .insert(noteBlocks)
          .values(section.blocks.map((b, i) => ({ sectionId: row.id, position: i, ...b })))
          .returning({ id: noteBlocks.id, kind: noteBlocks.kind, text: noteBlocks.text, sourceRefs: noteBlocks.sourceRefs });
        sections.push({ id: row.id, heading: section.heading, position, blocks });
      }
      await tx
        .update(lectures)
        .set({
          status: "ready",
          title: notes.title,
          suggestedCategoryName: notes.suggestedCategoryName ?? null,
          notesRevision: sql`${lectures.notesRevision} + 1`,
        })
        .where(owned);
      return sections;
    });

    const result: ProcessedNotes = {
      title: notes.title,
      sections: saved,
      ...(notes.suggestedCategoryName ? { suggestedCategoryName: notes.suggestedCategoryName } : {}),
    };
    return Response.json(result);
  } catch (error) {
    await db.update(lectures).set({ status: "failed" }).where(owned);
    if (error instanceof AiServiceError) {
      console.error("Note generation failed:", error.message);
      // 4xx from the service means it rejected an image; anything else is an upstream failure.
      return error.status !== undefined && error.status < 500
        ? problem(422, "One of the images couldn't be read. Try a different photo.")
        : problem(502, "Couldn't generate notes right now. Please try again.");
    }
    throw error;
  }
}

function problem(status: number, error: string) {
  return Response.json({ error }, { status });
}
