import Link from "next/link";

export default function Information() {
  return <article className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
    <h1 className="text-3xl font-semibold">Orbit Study information</h1>
    <section id="privacy"><h2 className="text-xl font-semibold">Privacy</h2><p>Orbit Study is a hackathon prototype. Account authentication is provided by Clerk. Ask the project team about data handling before uploading sensitive study materials.</p></section>
    <section id="terms"><h2 className="text-xl font-semibold">Terms</h2><p>This prototype is provided for demonstration and evaluation. Full service terms have not yet been published by the project team.</p></section>
    <section id="help"><h2 className="text-xl font-semibold">Need help?</h2><p>Use “Forgot password?” to recover your account. For project support, contact the hackathon team through the <a className="underline" href="https://github.com/Wushington/UB_Hacking_2026/issues">project’s GitHub issues</a>. Never post passwords or API keys.</p></section>
    <Link className="underline" href="/sign-in">Back to sign in</Link>
  </article>;
}
