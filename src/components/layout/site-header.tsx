import { Show, SignInButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-semibold tracking-tight">
          Orbit Study
        </Link>
        <nav aria-label="Account" className="flex items-center gap-2">
          {/* Auth state is per-request; Suspense keeps the rest of the shell prerendered. */}
          <Suspense fallback={null}>
            <Show when="signed-out">
              <SignInButton mode="modal">
                <Button size="sm">Sign in</Button>
              </SignInButton>
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
