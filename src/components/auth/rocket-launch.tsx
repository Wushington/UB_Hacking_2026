"use client";

import { Rocket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export function RocketLaunch() {
  const router = useRouter();

  useEffect(() => {
    router.prefetch("/");
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      try { sessionStorage.setItem("orbit-launch-arrival", "1"); } catch { /* Navigation still works without storage. */ }
      router.replace("/");
    }, reduced ? 250 : 1650);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <section className="orbit-launch orbit-launch-smooth" aria-labelledby="launch-heading">
      <div className="orbit-launch-ship" aria-hidden="true">
        <Rocket size={88} strokeWidth={1.4} />
        <span className="orbit-launch-flame" />
      </div>
      <div className="orbit-launch-caption" role="status">
        <h1 id="launch-heading">Opening your dashboard…</h1>
      </div>
      <Link href="/" className="orbit-text-link">Skip to dashboard →</Link>
    </section>
  );
}