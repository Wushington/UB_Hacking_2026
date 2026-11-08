import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function Home() {
  return <AuthShell><Suspense fallback={<p className="orbit-status" role="status">Loading sign in…</p>}><SignInForm /></Suspense></AuthShell>;
}
