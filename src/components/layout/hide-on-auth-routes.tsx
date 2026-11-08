"use client";

import { usePathname } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { isAuthRoute } from "./auth-routes";

function Gate({ children }: { children: ReactNode }) {
  return isAuthRoute(usePathname()) ? null : children;
}

/**
 * Renders site chrome everywhere except the sign-in/sign-up pages, which bring their own design.
 * The pathname is request data, so it streams inside Suspense as cacheComponents requires.
 */
export function HideOnAuthRoutes({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <Gate>{children}</Gate>
    </Suspense>
  );
}
