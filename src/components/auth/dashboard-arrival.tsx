"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

export function DashboardArrival({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    let arriving = false;
    try {
      arriving = sessionStorage.getItem("orbit-launch-arrival") === "1";
      sessionStorage.removeItem("orbit-launch-arrival");
    } catch { /* Storage may be unavailable in private browsing. */ }
    if (!arriving || !root.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const animation = root.current.animate(
      reduced ? [{ opacity: 0 }, { opacity: 1 }] : [
        { opacity: 0, transform: "translateY(12px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: reduced ? 150 : 550, easing: "cubic-bezier(.2,.7,.2,1)" },
    );
    return () => animation.cancel();
  }, []);

  return <div ref={root} className="flex flex-1 flex-col">{children}</div>;
}