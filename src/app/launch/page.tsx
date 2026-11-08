import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { RocketLaunch } from "@/components/auth/rocket-launch";

async function Launch() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-up");
  return <RocketLaunch />;
}

export default function LaunchPage() {
  return <AuthShell salmon><Suspense fallback={<p role="status">Preparing your orbit…</p>}><Launch /></Suspense></AuthShell>;
}