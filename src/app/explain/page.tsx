import { auth } from "@clerk/nextjs/server";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ExplainAloudScreen } from "@/components/explain-aloud/explain-aloud-screen";
import {
  getExplainAloudView,
  getLectureOptions,
  getOpenConceptOptions,
  getSelectedConcept,
} from "@/lib/explain-aloud/queries";
import { emptyView, readyToRecordView } from "@/lib/explain-aloud/view";

export const metadata: Metadata = {
  title: "Explain aloud · Orbit Study",
};

const param = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

/**
 * Reads the session and the user's rows at request time; streamed in behind the loading shell.
 * `?recording=<id>` shows that attempt; `?concept=<weakConceptId>` (from the Weak concepts page)
 * sets up a new attempt on that concept; otherwise the latest attempt.
 */
async function ExplainAloudContent({ searchParams }: { searchParams: PageProps<"/explain">["searchParams"] }) {
  const { userId } = await auth();
  if (!userId) return <ExplainAloudScreen view={emptyView("signed-out")} />;

  const params = await searchParams;
  const recordingId = param(params.recording);
  const conceptId = param(params.concept);

  const [selected, lectures, concepts] = await Promise.all([
    !recordingId && conceptId ? getSelectedConcept(userId, conceptId) : null,
    getLectureOptions(userId),
    getOpenConceptOptions(userId),
  ]);
  const view = selected ? readyToRecordView(selected) : await getExplainAloudView(userId, recordingId);
  return <ExplainAloudScreen view={view} lectures={lectures} concepts={concepts} />;
}

export default function ExplainAloudPage({ searchParams }: PageProps<"/explain">) {
  return (
    <Suspense fallback={<ExplainAloudScreen view={emptyView("loading")} />}>
      <ExplainAloudContent searchParams={searchParams} />
    </Suspense>
  );
}
