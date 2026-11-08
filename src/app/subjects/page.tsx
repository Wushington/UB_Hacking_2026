import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SubjectsScreen } from "@/components/subjects/subjects-screen";
import { OrbitPage, OrbitPageHeading } from "@/components/orbit/shell";
import { listLectures } from "@/lib/lectures/store";

export const metadata: Metadata = {
  title: "My subjects · Orbit Study",
};

/** Reads the session and the user's notes at request time; streamed in behind the heading. */
async function SubjectsContent() {
  const { userId } = await auth();
  const lectures = userId ? await listLectures(userId) : [];
  return <SubjectsScreen lectures={lectures} signedIn={Boolean(userId)} />;
}

/** My subjects: all of the user's notes, grouped by subject (category). */
export default function SubjectsPage() {
  return (
    <OrbitPage>
      <Suspense fallback={<OrbitPageHeading eyebrow="MY SUBJECTS" title="Loading your subjects…" />}>
        <SubjectsContent />
      </Suspense>
    </OrbitPage>
  );
}
