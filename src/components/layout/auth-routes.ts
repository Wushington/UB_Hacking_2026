/** Routes that render their own full-screen sign-in design (AuthShell) without the site chrome. */
const AUTH_ROUTES = ["/sign-in", "/sign-up", "/forgot-password", "/sso-callback", "/auth", "/launch"];

/** True for every auth route, including nested Clerk steps (e.g. /sign-up/verify-email-address). */
export function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
