"use client";

import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { cn } from "@/lib/utils";

/** `matches` marks the step the current page belongs to. */
const LEARNING_LOOP: { label: string; matches?: (pathname: string) => boolean }[] = [
  { label: "Capture a class", matches: (p) => p === "/capture" },
  { label: "Organize notes", matches: (p) => /^\/lectures\/[^/]+$/.test(p) },
  { label: "Take a quiz", matches: (p) => /^\/lectures\/[^/]+\/study$/.test(p) },
  { label: "Find the gaps", matches: (p) => p.startsWith("/weak-concepts") },
  { label: "Explain & improve", matches: (p) => p.startsWith("/explain") },
];

function LoopSteps({ pathname }: { pathname: string }) {
  return (
    <ol aria-label="Learning loop" className="contents">
      {LEARNING_LOOP.map(({ label, matches }, i) => {
        const current = matches?.(pathname) ?? false;
        const last = i === LEARNING_LOOP.length - 1;
        return (
          <li
            key={label}
            aria-current={current ? "step" : undefined}
            className={cn("flex shrink-0 items-center gap-2.5 text-[11px] whitespace-pre", current ? "font-semibold text-orbit-accent-text" : "text-orbit-muted")}
          >
            <span>
              <span aria-hidden>{`${String(i + 1).padStart(2, "0")}  /  `}</span>
              {label}
            </span>
            {last ? null : (
              <span aria-hidden className="text-[14px]">
                →
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function CurrentLoopSteps() {
  return <LoopSteps pathname={usePathname()} />;
}

/** The one site-wide footer: the numbered Capture → Improve learning loop, with the current page's step highlighted. */
export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-[1440px] px-4 pb-6 sm:px-6 sm:pb-9 lg:px-10 xl:px-14">
      <div className="flex w-full items-center gap-6 overflow-x-auto rounded-[22px] bg-orbit-surface/70 px-[22px] py-4 xl:h-[58px] xl:justify-between xl:py-0">
        <p className="shrink-0 text-[10px] font-semibold tracking-[1.5px] whitespace-nowrap text-orbit-muted uppercase">It all connects</p>
        {/* The current path is request data: stream it in, falling back to the same steps with none highlighted. */}
        <Suspense fallback={<LoopSteps pathname="" />}>
          <CurrentLoopSteps />
        </Suspense>
      </div>
    </footer>
  );
}
