import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CaptureWorkspace } from "@/components/capture/capture-workspace";
import { OrbitPage } from "@/components/orbit/shell";
import { listCategories } from "@/lib/lectures/store";


export const metadata: Metadata = {
  title: "Capture Notes · Orbit Study",
};

/** Reads the session and the user's subjects at request time; streamed in behind the static shell. */
async function CaptureContent() {
  const { userId } = await auth();
  const subjects = userId ? await listCategories(userId) : [];
  return <CaptureWorkspace subjects={subjects} signedIn={Boolean(userId)} />;
}

/** Upload photos of handwritten notes, pick a subject, and turn them into notes. */
export default function CapturePage() {
  return (
    <OrbitPage>
      <Suspense fallback={<CaptureWorkspace subjects={[]} signedIn={false} loading />}>
        <CaptureContent />
      </Suspense>
    </OrbitPage>
  );
}
