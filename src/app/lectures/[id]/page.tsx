import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { z } from "zod";
import { NotesEditor } from "@/components/notes/notes-editor";
import { orbitCardClass, OrbitPageHeading, OrbitPage, Pill } from "@/components/orbit/shell";
import { loadLectureForEditor } from "@/lib/lectures/store";


export const metadata: Metadata = {
  title: "Your notes · Orbit Study",
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
    Capture a class
  </Link>
);

/** Reads the session and the lecture at request time; streamed in behind the static shell. */
async function LectureNotesContent({ params }: { params: PageProps<"/lectures/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const { userId } = await auth();
  const lecture = userId ? await loadLectureForEditor(userId, id) : null;
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
        <p>Add whiteboard photos on the Capture page to generate notes.</p>
        {captureLink}
      </Message>
    );
  } else {
    body = (
      <NotesEditor
        key={lecture.revision}
        lectureId={lecture.id}
        revision={lecture.revision}
        initial={{
          title: lecture.title,
          sections: lecture.sections.map((s) => ({ id: s.id, heading: s.heading, blocks: s.blocks })),
        }}
      />
    );
  }

  return (
    <>
      <OrbitPageHeading
        eyebrow="02 / ORGANIZE NOTES"
        title={lecture?.status === "ready" ? lecture.title : "Your notes"}
        subtitle={
          lecture?.status === "ready"
            ? "Check what the AI read, fix anything it got wrong, then turn it into a quiz."
            : undefined
        }
        aside={
          lecture ? (
            <div className="flex flex-wrap items-center gap-2">
              {lecture.categoryName ? <Pill>{lecture.categoryName}</Pill> : null}
              {lecture.status === "ready" ? (
                <Link
                  href={`/lectures/${lecture.id}/study`}
                  className={`${linkButtonClass} border border-[#ff5e7a] text-[#ff5e7a] hover:bg-[#ff5e7a] hover:text-white`}
                >
                  Make flashcards →
                </Link>
              ) : null}
            </div>
          ) : null
        }
      />
      {body}
    </>
  );
}

/** Step 02: review and edit the notes generated from a class's whiteboard photos. */
export default function LectureNotesPage({ params }: PageProps<"/lectures/[id]">) {
  return (
    <OrbitPage>
      <Suspense fallback={<OrbitPageHeading eyebrow="02 / ORGANIZE NOTES" title="Loading your notes…" />}>
        <LectureNotesContent params={params} />
      </Suspense>
    </OrbitPage>
  );
}
