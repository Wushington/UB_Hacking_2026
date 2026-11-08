# Orbit Study sign-in

The Figma sign-in page is served at `/` and `/sign-in`. The previous landing page is preserved at `/home`, which is also the successful authentication destination. The branch does not yet have a study dashboard.

## Run locally

From this repository folder, run `npm install`, then `npm run dev`. Open http://localhost:3000. If another checkout is already running on port 3000, stop that checkout's dev server first; Next.js otherwise chooses another port.

Create `.env.local` locally using the team's existing Clerk application credentials:

```dotenv
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your application's publishable key>
CLERK_SECRET_KEY=<your application's secret key>
```

Do not paste keys into chat or commit `.env.local`. This implementation does not change the team's environment validation, database, or authentication middleware. Clerk requires these keys to serve the application.

In the Clerk Dashboard, enable email sign-in, password authentication, email sign-up and Google as a social connection. Enable email verification and password recovery for the application. Use the same development instance for both local keys. Production Google OAuth requires the production connection's own credentials and authorized URLs configured in Clerk/Google.

The provider explicitly sets sign-in to `/sign-in`, sign-up to `/sign-up`, and successful authentication to `/home`. Google OAuth uses `/sso-callback`. Avoid conflicting force-redirect environment settings from another checkout.

## Flows

- Email/password: custom Figma form uses Clerk's current `signIn.password()` and `finalize()` APIs. Loading and error states prevent duplicate submissions. Additional MFA/device trust steps continue in Clerk's full UI at `/auth`.
- Google: starts Clerk Google SSO; the callback supports both existing accounts and transfer to sign-up when more information or verification is needed.
- Password recovery: `/forgot-password` sends an email code, verifies it, accepts a new password, signs out other sessions and completes sign-in. Codes can be resent. Clerk validates the password policy.
- Account creation: `/sign-up` uses Clerk's supported sign-up UI, including verification and configured bot protection.
- Remember me: remembers only the email address on the current device. Passwords and tokens are never stored by this form. Clerk controls session lifetime; configure inactivity and maximum session duration in Clerk.
- Footer: `/information` contains honest prototype notices and project support information; the team should replace these with its published policies before launching.

## Design and team integration

The original background and all eight Figma SVGs are local files under `public/orbit`. Scoped auth CSS uses the design's Inter font, colors, spacing and responsive layout. Existing shared Button/Input components are reused. Other pages retain the team's header and font; the root layout suppresses that header only on auth routes to avoid duplicate navigation.

Changes to shared files are limited to `src/app/layout.tsx` (Inter, provider route settings, conditional header) and `src/app/page.tsx` (sign-in entry). Coordinate review with the team's layout owner. No backend, schema, contracts or middleware changes are included.

## Verification

Run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` before pushing. Tests cover credential submission, session finalization, errors, Google redirect parameters, MFA continuation, password reset, remembered email, loading and password visibility. Live end-to-end authentication must be checked with the team's Clerk development instance and a test account.

During implementation, lint/typecheck and all 54 tests passed. A mocked rendered preview was checked at desktop and phone widths, with every icon loaded at its intended size and no horizontal overflow. The production build was attempted but this machine's Next.js/Turbopack CSS worker exited before connecting. The live dev route reached Clerk and correctly reported missing keys in the fresh checkout; no live account sign-in was claimed as verified.
