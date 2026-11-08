"use client";

import { HandleSSOCallback } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export function SSOCallback() {
  const router = useRouter();
  return <HandleSSOCallback
    navigateToApp={({ session, decorateUrl }) => window.location.assign(decorateUrl(session?.currentTask ? "/auth" : "/"))}
    navigateToSignIn={() => router.push("/auth")}
    navigateToSignUp={() => router.push("/sign-up")}
  />;
}
