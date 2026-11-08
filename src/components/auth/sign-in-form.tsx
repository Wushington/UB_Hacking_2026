"use client";

import { useAuth, useSignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DesignIcon } from "./auth-shell";

function rememberedEmail() {
  try { return localStorage.getItem("orbit-remembered-email") || ""; }
  catch { return ""; }
}
function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function SignInForm({ recovery = false }: { recovery?: boolean }) {
  const { signIn, fetchStatus } = useSignIn();
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const savedEmail = useSyncExternalStore(subscribeToStorage, rememberedEmail, () => "");
  const [enteredEmail, setEmail] = useState<string | null>(null);
  const [rememberChoice, setRemember] = useState<boolean | null>(null);
  const email = enteredEmail ?? savedEmail;
  const remember = rememberChoice ?? Boolean(savedEmail);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"email" | "code" | "password">("email");
  const disabled = !isLoaded || busy || fetchStatus === "fetching";

  async function run(action: () => Promise<void>) {
    setError(""); setBusy(true);
    try { await action(); }
    catch (cause) {
      const problem = cause as { longMessage?: string; message?: string };
      setError(problem.longMessage || problem.message || "Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  async function finish() {
    if (signIn.status !== "complete") {
      // The prebuilt flow supports all configured MFA and device-trust factors.
      router.push("/auth");
      return;
    }
    const result = await signIn.finalize({
      navigate: ({ session, decorateUrl }) => {
        window.location.assign(decorateUrl(session?.currentTask ? "/auth" : "/home"));
      },
    });
    if (result.error) throw result.error;
  }

  async function submit(data: FormData) {
    await run(async () => {
      if (recovery) {
        if (step === "email") {
          const created = await signIn.create({ identifier: email.trim() });
          if (created.error) throw created.error;
          const sent = await signIn.resetPasswordEmailCode.sendCode();
          if (sent.error) throw sent.error;
          setStep("code");
        } else if (step === "code") {
          const verified = await signIn.resetPasswordEmailCode.verifyCode({ code: String(data.get("code")) });
          if (verified.error) throw verified.error;
          setStep("password");
        } else {
          const reset = await signIn.resetPasswordEmailCode.submitPassword({ password: String(data.get("password")), signOutOfOtherSessions: true });
          if (reset.error) throw reset.error;
          await finish();
        }
        return;
      }
      try {
        if (remember) localStorage.setItem("orbit-remembered-email", email.trim());
        else localStorage.removeItem("orbit-remembered-email");
      } catch { /* Never store passwords or authentication tokens here. */ }
      const result = await signIn.password({ emailAddress: email.trim(), password: String(data.get("password")) });
      if (result.error) throw result.error;
      await finish();
    });
  }

  if (isSignedIn) return (
    <section className="orbit-panel">
      <div className="orbit-welcome"><h1>You’re signed in</h1><p>Your next big idea awaits.</p></div>
      <Link className="orbit-text-link" href="/home">Continue to Orbit Study →</Link>
    </section>
  );

  return (
    <section className="orbit-panel" aria-labelledby="sign-in-heading">
      <div className="orbit-welcome">
        <p className="orbit-eyebrow"><DesignIcon name="sparkles" />YOUR AI STUDY COMPANION</p>
        <h1 id="sign-in-heading">{recovery ? "Reset your password" : "Welcome back"}</h1>
        <p>{recovery ? step === "email" ? "We’ll email you a code to get back into your orbit." : step === "code" ? "Enter the reset code sent to your email." : "Choose a new password for your account." : "A little focus. A whole universe of possibility."}</p>
      </div>
      <form className="orbit-form" action={submit} aria-busy={busy}>
        {!recovery && <>
          <Button type="button" className="orbit-google" disabled={disabled} onClick={() => run(async () => {
            const result = await signIn.sso({ strategy: "oauth_google", redirectCallbackUrl: "/sso-callback", redirectUrl: "/home" });
            if (result.error) throw result.error;
          })}><strong aria-hidden="true">G</strong>Continue with Google</Button>
          <div className="orbit-divider">or sign in with email</div>
        </>}
        <div className="orbit-fields">
          {(!recovery || step === "email") && <div className="orbit-field">
            <label htmlFor="email">Email address</label>
            <div className="orbit-input-wrap"><DesignIcon name="mail" /><Input className="orbit-input" id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required value={email} onChange={event => setEmail(event.target.value)} disabled={busy} /></div>
          </div>}
          {recovery && step === "code" && <div className="orbit-field">
            <label htmlFor="code">Reset code</label>
            <Input className="orbit-input" id="code" name="code" inputMode="numeric" autoComplete="one-time-code" required disabled={busy} />
          </div>}
          {(!recovery || step === "password") && <div className="orbit-field">
            <label htmlFor="password">{recovery ? "New password" : "Password"}</label>
            <div className="orbit-input-wrap"><DesignIcon name="lock" /><Input className="orbit-input" id="password" name="password" type={visible ? "text" : "password"} autoComplete={recovery ? "new-password" : "current-password"} placeholder="Enter your password" required disabled={busy} />
              <button type="button" className="orbit-eye" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible(!visible)}><DesignIcon name="eye" /></button>
            </div>
          </div>}
        </div>
        {!recovery && <div className="orbit-preferences">
          <label title="Remember your email on this device. Session duration is managed securely by Clerk."><input type="checkbox" checked={remember} onChange={event => setRemember(event.target.checked)} />Remember me</label>
          <Link href="/forgot-password">Forgot password?</Link>
        </div>}
        {error && <p className="orbit-error" role="alert">{error}</p>}
        <Button type="submit" className="orbit-submit" disabled={disabled}>{busy ? "Please wait…" : recovery ? step === "email" ? "Send reset code" : step === "code" ? "Verify code" : "Reset password" : "Sign in"}<DesignIcon name="arrow-right" /></Button>
        {recovery && step === "code" && <Button type="button" className="orbit-google" disabled={disabled} onClick={() => run(async () => { const result = await signIn.resetPasswordEmailCode.sendCode(); if (result.error) throw result.error; })}>Resend code</Button>}
      </form>
      <p className="orbit-create">{recovery ? <Link href="/">Back to sign in</Link> : <>New to Orbit Study? <Link href="/sign-up">Create an account</Link></>}</p>
    </section>
  );
}
