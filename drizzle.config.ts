import { defineConfig } from "drizzle-kit";

// `npm run db:generate` needs no database. `npm run db:migrate` applies to DATABASE_URL:
// confirm with the team before running it against the shared Tiger Data service.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
  strict: true,
});
