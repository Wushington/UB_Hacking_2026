import Image from "next/image";
import type { ReactNode } from "react";
import { SiteFooter } from "./site-footer";
import { SiteNavbar } from "./site-navbar";
import { StarField } from "./star-field";

/** Site-wide chrome from the Figma frames: starry background, navbar, page content and learning-loop footer. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-dvh w-full flex-col overflow-x-clip bg-orbit-bg text-orbit-text">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <StarField />
        <div className="absolute bottom-0 left-0 h-[440px] w-full opacity-40">
          <Image src="/figma/explain-aloud/lunar-atmosphere.jpg" alt="" fill sizes="100vw" className="object-cover" />
        </div>
        <div className="absolute bottom-[180px] left-0 h-[272px] w-full bg-gradient-to-b from-orbit-bg to-transparent" />
      </div>
      <SiteNavbar />
      <main className="flex w-full flex-1 flex-col">{children}</main>
      <SiteFooter />
    </div>
  );
}
