import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { z } from "zod";
import { ExportNotesPdf } from "@/components/notes/export-notes-pdf";
import { NotesActions } from "@/components/notes/notes-actions";
import { NotesView } from "@/components/notes/notes-view";
import { NotesWithPhotos } from "@/components/notes/photo-viewer";
import { orbitCardClass, OrbitPage, OrbitPageHeading, Pill } from "@/components/orbit/shell";
import { loadLatestDeck } from "@/lib/flashcards/store";
import { listCategories, listLecturePhotos, loadLectureForPage } from "@/lib/lectures/store";

export const metadata: Metadata = {
  title: "Notes · Orbit Study",
};

const linkButtonClass =
  "inline-flex h-10 items-center justify-center rounded-[10px] px-5 text-[14px] font-semibold transition-colors";

function Message({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={orbitCardClass}>
      <h2 className="text-[19px] font-medium">{title}</h2>
      <div className="flex flex-col gap-4 text-[14px] leading-[1.6] text-[#c1bedf]">{children}</div>
    </section>
  );
}

const captureLink = (
  <Link href="/capture" className={`${linkButtonClass} self-start bg-[#ff5e7a] text-white hover:bg-[#ff7891]`}>
    Capture Notes
  </Link>
);

/** Reads the session and the notes at request time; streamed in behind the static shell. */
async function LectureNotesContent({ params }: { params: PageProps<"/lectures/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const { userId } = await auth();
  const [lecture, subjects, photos, deckData] = userId
    ? await Promise.all([loadLectureForPage(userId, id), listCategories(userId), listLecturePhotos(userId, id), loadLatestDeck(userId, id)])
    : [null, [], [], null];
  if (userId && !lecture) notFound();

  let body: ReactNode;
  if (!lecture) {
    body = (
      <Message title="Sign in to see your notes">
        <p>Use the sign-in button at the top right.</p>
      </Message>
    );
  } else if (lecture.status === "processing") {
    body = (
      <Message title="Still organizing these notes">
        <p>This usually takes under a minute. Refresh the page to check again.</p>
      </Message>
    );
  } else if (lecture.status !== "ready") {
    body = (
      <Message title={lecture.status === "failed" ? "We couldn’t organize these notes" : "No notes yet"}>
        <p>Upload photos of your handwritten notes on the Capture page to generate notes.</p>
        {captureLink}
      </Message>
    );
  } else {
    body = (
      <NotesWithPhotos photos={photos.map((p) => ({ id: p.id, url: `/api/lectures/${lecture.id}/images/${p.id}` }))}>
        <NotesView sections={lecture.sections} />
      </NotesWithPhotos>
    );
  }

  return (
    <>
      <OrbitPageHeading
        title={lecture?.status === "ready" ? lecture.title : "Notes"}
        subtitle={
          lecture?.status === "ready"
            ? "AI-generated from your photos. Select a Photo tag to check a note against the original."
            : undefined
        }
        aside={
          lecture ? (
            <div className="flex flex-wrap items-center gap-2">
              {lecture.categoryName ? <Pill>{lecture.categoryName}</Pill> : null}
              {lecture.status === "ready" && <ExportNotesPdf title={lecture.title} subject={lecture.categoryName} />}
              {lecture.status === "ready" ? (
                <Link
                  href={`/lectures/${lecture.id}/study`}
                  className={`${linkButtonClass} bg-[#ff5e7a] text-white hover:bg-[#ff7891]`}
                >
                  {deckData?.deck ? "Study Flashcards" : "Generate Flashcards"}
                </Link>
              ) : null}
            </div>
          ) : null
        }
      />
      {body}
      {lecture ? (
        <NotesActions
          lectureId={lecture.id}
          subjects={subjects}
          subjectId={lecture.categoryId}
          canDelete={lecture.status !== "processing"}
        />
      ) : null}
    </>
  );
}

/** Read the notes generated from photos of handwritten notes, move them to another subject, or delete them. */
export default function LectureNotesPage({ params }: PageProps<"/lectures/[id]">) {
  return (
    <OrbitPage>
      <Suspense fallback={<OrbitPageHeading title="Notes" subtitle="Loading your notes…" />}>
        <LectureNotesContent params={params} />
      </Suspense>
    </OrbitPage>
  );
}
