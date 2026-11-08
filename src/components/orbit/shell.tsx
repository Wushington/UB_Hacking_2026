import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/explain-aloud/account-menu";
import { cn } from "@/lib/utils";

/**
 * The dark "Orbit" page frame from the Figma designs: star-field background, top nav and the
 * "It all connects" learning loop. Same look as the explain-aloud screen.
 */

const ASSETS = "/figma/explain-aloud";

export type OrbitNavKey = "home" | "classes" | "quizzes" | "weak-concepts";

const NAV_ITEMS: { key: OrbitNavKey; label: string; href: string }[] = [
  { key: "home", label: "Home", href: "/" },
  { key: "classes", label: "My classes", href: "/capture" },
  { key: "quizzes", label: "Quizzes", href: "/quizzes" },
  { key: "weak-concepts", label: "Weak concepts", href: "/weak-concepts" },
];

const LEARNING_STEPS = ["Capture a class", "Organize notes", "Take a quiz", "Find the gaps", "Explain & improve"];

export const orbitCardClass =
  "flex w-full min-w-0 flex-col gap-5 overflow-clip rounded-[18px] bg-[#161730] p-5 shadow-[0px_6px_24px_0px_rgba(0,0,0,0.13)] sm:rounded-[22px] sm:p-7";
/** Page gutters: 16px on phones up to the design's 56px at xl. */
export const orbitGutterClass = "px-4 sm:px-6 lg:px-10 xl:px-14";
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

function AssetIcon({ name, width, height }: { name: string; width: number; height: number }) {
  return (
    <span aria-hidden className="relative block shrink-0" style={{ width, height }}>
      <Image src={`${ASSETS}/${name}.svg`} alt="" fill sizes={`${Math.ceil(width)}px`} className="block max-w-none" />
    </span>
  );
}

export function OrbitShell({
  activeNav,
  activeStep,
  className,
  children,
}: {
  activeNav: OrbitNavKey;
  /** 0-based index into the learning loop. */
  activeStep: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("relative isolate flex min-h-dvh w-full flex-col overflow-hidden bg-[#0d0e2a] text-white", className)}>
      {/* Decorative background layers */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute top-0 left-0 h-[1080px] w-full min-w-[1440px]">
          <Image src={`${ASSETS}/star-field.svg`} alt="" fill className="block max-w-none" />
        </div>
        <div className="absolute bottom-[-120px] left-0 h-[440px] w-full min-w-[1440px] opacity-24">
          <Image src={`${ASSETS}/lunar-atmosphere.jpg`} alt="" fill sizes="100vw" loading="eager" className="object-cover" />
        </div>
        <div className="absolute bottom-[40px] left-0 h-[280px] w-full bg-gradient-to-b from-[#0d0e2a] to-[rgba(13,14,42,0)]" />
      </div>

      <header
        className={cn(
          "flex w-full shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-[rgba(42,43,80,0.25)] bg-[rgba(19,20,48,0.5)] py-3 lg:h-20 lg:flex-nowrap lg:py-0",
          orbitGutterClass,
        )}
      >
        <Link href="/" className="text-[20px] font-bold tracking-[-0.9px] whitespace-nowrap sm:text-[23px]">
          Orbit Study
        </Link>
        <nav
          aria-label="Main"
          className="-mx-1 order-last flex w-full items-center gap-2 overflow-x-auto px-1 lg:order-none lg:mx-0 lg:w-auto lg:overflow-visible lg:px-0"
        >
          {NAV_ITEMS.map((item) => {
            const active = item.key === activeNav;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-[14px] py-[8px] text-[13px] leading-[1.5] whitespace-nowrap transition-colors lg:px-[17px] lg:py-[11px]",
                  active ? "bg-[#ff5e7a] font-semibold text-white" : "text-[#9496bf] hover:text-white",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-4 lg:gap-[22px]">
          <button type="button" aria-label="Search" className="relative size-[18px] shrink-0">
            <AssetIcon name="search" width={16} height={16} />
          </button>
          <button type="button" aria-label="Notifications" className="relative size-[18px] shrink-0">
            <AssetIcon name="notifications" width={18} height={13.5} />
          </button>
          <AccountMenu />
        </div>
      </header>

      <div className={cn("flex w-full flex-1 flex-col gap-6 pt-7 pb-8 sm:gap-7 sm:pt-9", orbitGutterClass)}>{children}</div>

      <div className={cn("flex w-full pb-6 sm:pb-9", orbitGutterClass)}>
        <nav
          aria-label="Learning loop"
          className="flex min-w-0 flex-1 items-center gap-6 overflow-x-auto rounded-[18px] bg-[rgba(19,20,48,0.69)] px-[22px] py-4 sm:rounded-[22px] xl:h-[58px] xl:justify-between xl:py-0"
        >
          <p className={cn(orbitEyebrowClass, "shrink-0")}>IT ALL CONNECTS</p>
          {LEARNING_STEPS.map((step, i) => {
            const active = i === activeStep;
            const last = i === LEARNING_STEPS.length - 1;
            return (
              <div
                key={step}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2.5 text-[11px] leading-[1.5]",
                  active ? "font-semibold text-[#ff5e7a]" : "text-[#9496bf]",
                )}
              >
                <p className="whitespace-pre">{`${String(i + 1).padStart(2, "0")}  /  ${step}`}</p>
                {last ? null : (
                  <span aria-hidden className="text-[14px] font-normal">
                    →
                  </span>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

/** Page title block: eyebrow, heading, subtitle, optional pill on the right. */
export function OrbitPageHeading({
  eyebrow,
  title,
  subtitle,
  aside,
}: {
  eyebrow: string;
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="flex w-full flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="flex min-w-0 flex-col gap-2">
        <p className={orbitEyebrowClass}>{eyebrow}</p>
        <h1 className="text-[28px] leading-[1.15] font-medium tracking-[-1.3px] text-balance sm:text-[32px] lg:text-[36px]">
          {title}
        </h1>
        {subtitle ? <p className="text-[14px] leading-[1.5] text-pretty text-[#9496bf]">{subtitle}</p> : null}
      </div>
      {aside}
    </div>
  );
}
