import "server-only";
import { auth } from "@clerk/nextjs/server";

export class UnauthorizedError extends Error {
  constructor() {
    super("Not signed in");
    this.name = "UnauthorizedError";
  }
}

/**
 * Returns the signed-in Clerk user id or throws. Use in every server action / route handler,
 * then scope every query with `eq(table.userId, userId)`.
 */
export async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new UnauthorizedError();
  return userId;
}
