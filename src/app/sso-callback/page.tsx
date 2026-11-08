import { SSOCallback } from "@/components/auth/sso-callback";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SSOCallbackPage() {
  return <AuthShell><Suspense fallback={<p role="status">Completing Google sign in…</p>}><SSOCallback /></Suspense></AuthShell>;
}
