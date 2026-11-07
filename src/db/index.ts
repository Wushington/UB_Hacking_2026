import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { parseEnv } from "@/lib/env";
import * as schema from "./schema";

/**
 * Server-only Drizzle client. Created on first use so builds and tests don't need DATABASE_URL.
 * Ownership is NOT enforced by Clerk: always add `eq(table.userId, await requireUserId())`.
 */
function createDb() {
  const { DATABASE_URL } = parseEnv("database");
  // Tiger Data requires TLS; keep the pool small for a single Node server.
  const client = postgres(DATABASE_URL, { ssl: "require", max: 5 });
  return drizzle(client, { schema });
}

type Db = ReturnType<typeof createDb>;
const globalForDb = globalThis as unknown as { orbitDb?: Db };

/** Reuses one pool across dev hot reloads. */
export function getDb(): Db {
  globalForDb.orbitDb ??= createDb();
  return globalForDb.orbitDb;
}

export { schema };
