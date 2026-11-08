import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { SubjectsScreen } from "@/components/subjects/subjects-screen";
import { OrbitPage, OrbitPageHeading } from "@/components/orbit/shell";
import { listLectures } from "@/lib/lectures/store";
import { listDividers, listSubjects } from "@/lib/subjects/store";

export const metadata: Metadata = {
  title: "My subjects · Orbit Study",
};

/** Reads the session, the user's notes, subjects and dividers at request time; streamed in behind the heading. */
async function SubjectsContent() {
  const { userId } = await auth();
  if (!userId) return <SubjectsScreen lectures={[]} signedIn={false} />;
  const [lectures, subjects, dividers] = await Promise.all([listLectures(userId), listSubjects(userId), listDividers(userId)]);
  return <SubjectsScreen lectures={lectures} subjects={subjects} dividers={dividers} signedIn />;
}

/** My subjects: all of the user's notes grouped by subject, with subjects grouped under collapsible dividers. */
export default function SubjectsPage() {
  return (
    <OrbitPage>
      <Suspense fallback={<OrbitPageHeading eyebrow="MY SUBJECTS" title="Loading your subjects…" />}>
        <SubjectsContent />
      </Suspense>
    </OrbitPage>
  );
}
