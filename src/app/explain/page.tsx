import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ExplainAloudScreen } from "@/components/explain-aloud/explain-aloud-screen";
import { getExplainAloudView, getLectureOptions } from "@/lib/explain-aloud/queries";
import { emptyView } from "@/lib/explain-aloud/view";

export const metadata: Metadata = {
  title: "Explain aloud · Orbit Study",
};

/** Reads the session and the user's rows at request time; streamed in behind the loading shell. */
async function ExplainAloudContent({ searchParams }: { searchParams: PageProps<"/explain">["searchParams"] }) {
  const { userId } = await auth();
  if (!userId) return <ExplainAloudScreen view={emptyView("signed-out")} />;

  const { recording } = await searchParams;
  const recordingId = typeof recording === "string" ? recording : undefined;
  const [view, lectures] = await Promise.all([getExplainAloudView(userId, recordingId), getLectureOptions(userId)]);
  return <ExplainAloudScreen view={view} lectures={lectures} />;
}

export default function ExplainAloudPage({ searchParams }: PageProps<"/explain">) {
  return (
    <Suspense fallback={<ExplainAloudScreen view={emptyView("loading")} />}>
      <ExplainAloudContent searchParams={searchParams} />
    </Suspense>
  );
}
