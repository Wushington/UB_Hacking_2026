import { SignIn, SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";

async function AccountFlow() {
  const { userId } = await auth();

  if (userId) {
    return (
      <section className="orbit-panel" aria-labelledby="account-heading">
        <div className="orbit-welcome">
          <h1 id="account-heading">You’re signed in</h1>
          <p>Continue to Orbit Study, or sign out to use another account.</p>
        </div>
        <div className="orbit-form">
          <Link href="/launch" className="orbit-text-link">Continue to Orbit Study →</Link>
          <SignOutButton redirectUrl="/sign-up">
            <button type="button" className="orbit-google">Sign out and use another account</button>
          </SignOutButton>
        </div>
      </section>
    );
  }

  return (
    <SignIn
      appearance={{ variables: { colorPrimary: "#ff5e7a", colorBackground: "#21141c", colorForeground: "#fff5f4", colorMutedForeground: "#cdb8bb", colorInput: "#190d14", colorInputForeground: "#fff5f4" } }}
      routing="path"
      path="/sign-up"
      withSignUp
      forceRedirectUrl="/launch"
      signUpForceRedirectUrl="/launch"
    />
  );
}

export default function SignUpPage() {
  return (
    <AuthShell salmon showBackToHome={false}>
      <div className="orbit-clerk">
        <Suspense fallback={<p role="status">Loading sign in…</p>}>
          <AccountFlow />
        </Suspense>
      </div>
    </AuthShell>
  );
}