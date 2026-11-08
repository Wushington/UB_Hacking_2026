import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Building blocks for pages inside the site shell, matching the dark Figma cards. */

export const orbitCardClass =
  "flex w-full min-w-0 flex-col gap-5 overflow-clip rounded-[18px] bg-[#161730] p-5 shadow-[0px_6px_24px_0px_rgba(0,0,0,0.13)] sm:rounded-[22px] sm:p-7";
export const orbitEyebrowClass = "text-[10px] font-semibold tracking-[1.5px] whitespace-nowrap text-[#9496bf]";

export type PillTone = "neutral" | "success" | "danger";

export function Pill({ tone = "neutral", children }: { tone?: PillTone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded-full px-2.5 py-[5px] text-[11px] leading-[1.5] whitespace-nowrap",
        tone === "success" && "bg-[#163d38] text-[#4ecba0]",
        tone === "danger" && "bg-[#281d35] text-[#ff5e7a]",
        tone === "neutral" && "bg-[#1e1f45] text-[#c1bedf]",
      )}
    >
      {children}
    </span>
  );
}

/** Page body inside the site shell (navbar/footer come from the root layout): same width and gutters as the other pages. */
export function OrbitPage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-[1440px] flex-1 flex-col gap-6 px-4 pt-7 pb-8 text-white sm:gap-7 sm:px-6 sm:pt-9 lg:px-10 xl:px-14",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Page title block: heading, subtitle, optional actions on the right. */
export function OrbitPageHeading({
  title,
  subtitle,
  aside,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-1.3px] text-balance sm:text-[32px] lg:text-[36px]">
          {title}
        </h1>
        {subtitle ? <p className="text-[14px] leading-[1.5] text-pretty text-[#9496bf]">{subtitle}</p> : null}
      </div>
      {aside}
    </div>
  );
}
