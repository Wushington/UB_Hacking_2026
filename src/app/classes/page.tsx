import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ClassesScreen } from "@/components/classes/classes-screen";
import { OrbitPage, OrbitPageHeading } from "@/components/orbit/shell";
import { listLectures } from "@/lib/lectures/store";

export const metadata: Metadata = {
  title: "My classes · Orbit Study",
};

/** Reads the session and the user's lectures at request time; streamed in behind the heading. */
async function ClassesContent() {
  const { userId } = await auth();
  const lectures = userId ? await listLectures(userId) : [];
  return <ClassesScreen lectures={lectures} signedIn={Boolean(userId)} />;
}

/** My classes: every lecture the user has captured, grouped by class (category). */
export default function ClassesPage() {
  return (
    <OrbitPage>
      <Suspense fallback={<OrbitPageHeading eyebrow="MY CLASSES" title="Loading your classes…" />}>
        <ClassesContent />
      </Suspense>
    </OrbitPage>
  );
}
