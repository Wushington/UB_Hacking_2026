import { Bell, Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { AccountMenu } from "@/components/explain-aloud/account-menu";
import { cn } from "@/lib/utils";

type NavItem = { label: string; href?: string };

/** `href` is omitted for sections that don't have a page yet; they render as "Soon" labels, not dead links. */
const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "My classes" },
  { label: "Quizzes" },
  { label: "Weak concepts", href: "/weak-concepts" },
];

const itemClass =
  "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[13px] whitespace-nowrap transition-colors";

function ComingSoonIconButton({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled
      aria-label={`${label} (coming soon)`}
      title={`${label} is coming soon`}
      className="flex size-10 items-center justify-center rounded-full text-orbit-muted disabled:cursor-not-allowed disabled:opacity-60"
    >
      {children}
    </button>
  );
}

export function DashboardNavbar({ current = "/" }: { current?: string }) {
  return (
    <header className="w-full border-b border-white/5 bg-orbit-surface/50 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:h-20 lg:flex-nowrap lg:px-10 lg:py-0 xl:px-14">
        <Link href="/" className="flex min-h-10 shrink-0 items-center gap-2.5 rounded-lg text-white">
          <Image src="/brand/orbit-study-logo.svg" alt="Orbit Study logo" width={153} height={89} priority className="h-6 w-auto sm:h-7" />
          <span className="text-[20px] font-bold tracking-[-0.9px] sm:text-[23px]">Orbit Study</span>
        </Link>

        <nav
          aria-label="Main"
          className="order-last -mx-1 flex w-full items-center gap-1 overflow-x-auto px-1 lg:order-none lg:mx-0 lg:w-auto lg:gap-2 lg:overflow-visible lg:px-0"
        >
          {NAV_ITEMS.map(({ label, href }) => {
            if (!href) {
              return (
                <span key={label} aria-disabled="true" title={`${label} is coming soon`} className={cn(itemClass, "cursor-not-allowed text-orbit-muted/70")}>
                  <span>{label}</span>
                  <span className="rounded-full bg-white/5 px-1.5 py-px text-[9px] font-medium tracking-wide uppercase">Soon</span>
                </span>
              );
            }
            const active = href === current;
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

        <div className="flex items-center gap-1 sm:gap-3">
          <ComingSoonIconButton label="Search">
            <Search aria-hidden className="size-[18px]" />
          </ComingSoonIconButton>
          <ComingSoonIconButton label="Notifications">
            <Bell aria-hidden className="size-[18px]" />
          </ComingSoonIconButton>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
