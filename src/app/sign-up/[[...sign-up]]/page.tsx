import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SignUpPage() {
  return <AuthShell><div className="orbit-clerk"><Suspense fallback={<p role="status">Loading account creation…</p>}><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" fallbackRedirectUrl="/home" /></Suspense></div></AuthShell>;
}
