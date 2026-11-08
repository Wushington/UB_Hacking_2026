"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { AccountMenu } from "@/components/explain-aloud/account-menu";
import { cn } from "@/lib/utils";

/** `also` lists other paths that count as this section; `matches` covers dynamic ones. */
type NavItem = { label: string; href?: string; also?: string[]; matches?: (pathname: string) => boolean };

/** A lecture's flashcard study page belongs to Quizzes. */
const isStudyPage = (pathname: string) => /^\/lectures\/[^/]+\/study$/.test(pathname);

/** `href` is omitted for sections that don't have a page yet; they render as "Soon" labels, not dead links. */
const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "My classes" },
  { label: "Quizzes", href: "/quizzes", matches: isStudyPage },
  // Weak concepts are practised on the explain page; the full list stays reachable at /weak-concepts.
  { label: "Weak concepts", href: "/explain", also: ["/weak-concepts"] },
];

const isCurrent = (href: string, pathname: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));

const itemClass = "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] whitespace-nowrap transition-colors";

/** Search and notifications use the Figma Home nav icons (public/figma/nav). */
function ComingSoonIconButton({ label, icon }: { label: string; icon: string }) {
  return (
    <button
      type="button"
      disabled
      aria-label={`${label} (coming soon)`}
      title={`${label} is coming soon`}
      className="flex size-10 cursor-not-allowed items-center justify-center rounded-full"
    >
      <Image src={`/figma/nav/${icon}.svg`} alt="" width={18} height={18} />
    </button>
  );
}

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav
      aria-label="Main"
      className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 lg:order-none lg:mx-0 lg:w-auto lg:gap-2 lg:overflow-visible lg:px-0"
    >
      {NAV_ITEMS.map(({ label, href, also = [], matches }) => {
        if (!href) {
          return (
            <span key={label} aria-disabled="true" title={`${label} is coming soon`} className={cn(itemClass, "cursor-not-allowed text-orbit-muted/70")}>
              <span>{label}</span>
              <span className="rounded-full bg-white/5 px-1.5 py-px text-[9px] font-medium tracking-wide uppercase">Soon</span>
            </span>
          );
        }
        const active = [href, ...also].some((path) => isCurrent(path, pathname)) || (matches?.(pathname) ?? false);
        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(itemClass, active ? "bg-orbit-accent font-semibold text-white" : "text-orbit-muted hover:text-white")}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function CurrentNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

/** The one site-wide navigation bar (rendered by SiteShell in the root layout). */
export function SiteNavbar() {
  return (
    // relative z-40: page sections animate in with a lasting transform (animate-rise), which would
    // otherwise paint over this header and hide the account menu (and swallow its Sign out click).
    <header className="relative z-40 w-full border-b border-white/5 bg-orbit-surface/50 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:h-20 lg:flex-nowrap lg:px-10 lg:py-0 xl:px-14">
        <Link href="/" className="flex min-h-10 shrink-0 items-center gap-2.5 rounded-lg text-white">
          <Image src="/brand/orbit-study-logo.svg" alt="Orbit Study logo" width={153} height={89} priority className="h-6 w-auto sm:h-7" />
          <span className="text-[20px] font-bold tracking-[-0.9px] sm:text-[23px]">Orbit Study</span>
        </Link>

        {/* The current path is request data: stream it in, falling back to the same links with none highlighted. */}
        <Suspense fallback={<NavLinks pathname="" />}>
          <CurrentNavLinks />
        </Suspense>

        {/* 40px touch targets around 18px icons give the Figma 22px spacing. */}
        <div className="flex items-center">
          <ComingSoonIconButton label="Search" icon="search" />
          <ComingSoonIconButton label="Notifications" icon="bell" />
          <div className="ml-[11px]">
            <AccountMenu />
          </div>
        </div>
      </div>
    </header>
  );
}
