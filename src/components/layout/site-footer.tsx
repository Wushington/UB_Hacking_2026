"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { STUDY_WORKFLOW } from "@/components/layout/workflow";
import { cn } from "@/lib/utils";

function WorkflowFooter() {
  const pathname = usePathname();
  // The dashboard shows this workflow at the top of the page, with the user's progress.
  if (pathname === "/") return null;
  return (
    <footer className="mx-auto w-full max-w-[1440px] px-4 pb-6 sm:px-6 sm:pb-9 lg:px-10 xl:px-14">
      <ol aria-label="Study workflow" className="flex w-full items-center gap-6 overflow-x-auto rounded-[22px] bg-orbit-surface/70 px-[22px] py-4 xl:justify-center">
        {STUDY_WORKFLOW.map(({ label, matches }, i) => (
          <li
            key={label}
            aria-current={matches(pathname) ? "step" : undefined}
            className={cn("flex shrink-0 items-center gap-6 text-[12px] whitespace-pre", matches(pathname) ? "font-semibold text-orbit-accent-text" : "text-orbit-muted")}
          >
            <span>
              {i + 1}. {label}
            </span>
            {i === STUDY_WORKFLOW.length - 1 ? null : (
              <span aria-hidden className="text-[14px]">
                →
              </span>
            )}
          </li>
        ))}
      </ol>
    </footer>
  );
}

/** The site-wide footer: the study workflow with the current page's step highlighted. The path is request data, so it streams in. */
export function SiteFooter() {
  return (
    <Suspense fallback={null}>
      <WorkflowFooter />
    </Suspense>
  );
}
