import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ContinueSignIn() {
  return <AuthShell><div className="orbit-clerk"><Suspense fallback={<p role="status">Loading account verification…</p>}><SignIn routing="path" path="/auth" signUpUrl="/sign-up" fallbackRedirectUrl="/home" /></Suspense></div></AuthShell>;
}
