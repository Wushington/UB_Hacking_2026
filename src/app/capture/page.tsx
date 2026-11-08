import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { CaptureWorkspace } from "@/components/capture/capture-workspace";
import { OrbitShell } from "@/components/orbit/shell";
import { listCategories } from "@/lib/lectures/store";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: "Capture a class · Orbit Study",
};

/** Reads the session and the user's categories at request time; streamed in behind the static shell. */
async function CaptureContent() {
  const { userId } = await auth();
  const categories = userId ? await listCategories(userId) : [];
  return <CaptureWorkspace categories={categories} signedIn={Boolean(userId)} />;
}

/** Step 01: upload whiteboard photos, pick a class, and turn them into notes. */
export default function CapturePage() {
  return (
    <main className="flex flex-1 flex-col">
      <OrbitShell activeNav="classes" activeStep={0} className={inter.className}>
        <Suspense fallback={<CaptureWorkspace categories={[]} signedIn={false} loading />}>
          <CaptureContent />
        </Suspense>
      </OrbitShell>
    </main>
  );
}
