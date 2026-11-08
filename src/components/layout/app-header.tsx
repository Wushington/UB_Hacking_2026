"use client";

import { usePathname } from "next/navigation";
import { SiteHeader } from "./site-header";

export function AppHeader() {
  const pathname = usePathname();
  const authRoute = pathname === "/" || ["/sign-in", "/sign-up", "/forgot-password", "/sso-callback", "/auth"].some(path => pathname === path || pathname.startsWith(`${path}/`));
  return authRoute ? null : <SiteHeader />;
}
