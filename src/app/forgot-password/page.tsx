import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/sign-in-form";

export default function ForgotPassword() {
  return <AuthShell><Suspense fallback={<p role="status">Loading password recovery…</p>}><SignInForm recovery /></Suspense></AuthShell>;
}
