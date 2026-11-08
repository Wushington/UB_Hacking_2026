import { describe, expect, it } from "vitest";
import { isAuthRoute } from "./auth-routes";

describe("isAuthRoute", () => {
  it.each(["/sign-in", "/sign-in/factor-one", "/sign-up", "/sign-up/verify", "/forgot-password", "/sso-callback", "/auth", "/auth/x"])(
    "treats %s as a sign-in page",
    (pathname) => expect(isAuthRoute(pathname)).toBe(true),
  );

  it.each(["/", "/home", "/explain", "/weak-concepts", "/quizzes", "/lectures/abc/study", "/information", "/sign-instructions", "/authors"])(
    "treats %s as a site page",
    (pathname) => expect(isAuthRoute(pathname)).toBe(false),
  );
});
