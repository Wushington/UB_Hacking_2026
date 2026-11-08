import { z } from "zod";

/**
 * Environment validation, grouped per integration so a missing Vultr key
 * doesn't break pages that only need the database (and vice versa).
 *
 * Server secrets are read only through server-only modules (src/db, src/lib/gemini,
 * src/lib/storage). Only NEXT_PUBLIC_* values may reach the browser.
 * Clerk reads its own CLERK_SECRET_KEY / NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY directly.
 */
const required = z.string().trim().min(1, "is required");

const schemas = {
  app: z.object({
    NEXT_PUBLIC_APP_URL: z.url(),
  }),
  database: z.object({
    DATABASE_URL: required.regex(/^postgres(ql)?:\/\//, "must be a postgres:// connection string"),
  }),
  gemini: z.object({
    GEMINI_API_KEY: required,
  }),
  elevenlabs: z.object({
    ELEVENLABS_API_KEY: required,
    /** Premade voice used in the ElevenLabs docs; override with any voice id from your account. */
    ELEVENLABS_VOICE_ID: required.default("JBFqnCBsd6RMkjVDRZzb"),
    ELEVENLABS_MODEL_ID: required.default("eleven_flash_v2_5"),
  }),
  storage: z.object({
    VULTR_S3_ENDPOINT: z.url(),
    VULTR_S3_REGION: required,
    VULTR_S3_BUCKET: required,
    VULTR_S3_ACCESS_KEY_ID: required,
    VULTR_S3_SECRET_ACCESS_KEY: required,
  }),
} as const;

export type EnvGroup = keyof typeof schemas;
export type Env<G extends EnvGroup> = z.infer<(typeof schemas)[G]>;

type Source = Record<string, string | undefined>;

export function parseEnv<G extends EnvGroup>(group: G, source: Source = process.env): Env<G> {
  const result = schemas[group].safeParse(source);
  if (!result.success) {
    // Report variable names and rules only, never the (possibly secret) values.
    const problems = result.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ");
    throw new Error(`Invalid ${group} environment: ${problems}. See .env.example.`);
  }
  return result.data as Env<G>;
}
