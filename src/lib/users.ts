import "server-only";
import { getDb, schema } from "@/db";

/** Creates the users row for a Clerk user on their first write (see schema.ts). Safe to call repeatedly. */
export async function ensureUser(userId: string): Promise<void> {
  await getDb().insert(schema.users).values({ id: userId }).onConflictDoNothing();
}
