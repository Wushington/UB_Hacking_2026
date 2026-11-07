import { clerkMiddleware } from "@clerk/nextjs/server";

/**
 * Makes Clerk session state available to `auth()`. It does NOT protect routes:
 * every page, route handler and server action that touches user data must call
 * `requireUserId()` (src/lib/auth.ts) and scope queries by user_id. (Clerk 7 deprecates
 * path-matching protection in middleware for this reason.)
 */
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
