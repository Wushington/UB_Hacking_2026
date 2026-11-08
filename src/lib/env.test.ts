import { describe, expect, it } from "vitest";
import { parseEnv } from "./env";

const valid = {
  NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgres://user:pw@host.tsdb.cloud.timescale.com:5432/tsdb?sslmode=require",
  GEMINI_API_KEY: "fake-gemini-key",
  VULTR_S3_ENDPOINT: "https://ewr1.vultrobjects.com",
  VULTR_S3_REGION: "ewr1",
  VULTR_S3_BUCKET: "orbit-study-media",
  VULTR_S3_ACCESS_KEY_ID: "fake-access-id",
  VULTR_S3_SECRET_ACCESS_KEY: "fake-storage-secret",
};

describe("parseEnv", () => {
  it("returns typed values for each integration group", () => {
    expect(parseEnv("database", valid).DATABASE_URL).toBe(valid.DATABASE_URL);
    expect(parseEnv("gemini", valid).GEMINI_API_KEY).toBe("fake-gemini-key");
    expect(parseEnv("storage", valid).VULTR_S3_BUCKET).toBe("orbit-study-media");
    expect(parseEnv("app", valid).NEXT_PUBLIC_APP_URL).toBe("http://localhost:3000");
  });

  it("validates one group without requiring the others", () => {
    expect(parseEnv("gemini", { GEMINI_API_KEY: "k" }).GEMINI_API_KEY).toBe("k");
  });

  it("names missing variables in the error", () => {
    expect(() => parseEnv("storage", {})).toThrow(/VULTR_S3_BUCKET/);
  });

  it("rejects a non-Postgres DATABASE_URL", () => {
    expect(() => parseEnv("database", { DATABASE_URL: "mysql://x@y/z" })).toThrow(/DATABASE_URL/);
  });

  it("never includes secret values in error messages", () => {
    const bad = { ...valid, VULTR_S3_ENDPOINT: "not a url" };
    try {
      parseEnv("storage", bad);
      expect.unreachable();
    } catch (error) {
      expect(String(error)).not.toContain("fake-storage-secret");
      expect(String(error)).toContain("VULTR_S3_ENDPOINT");
    }
  });

  it("defaults GEMINI_MODEL to the -latest alias when unset or blank", () => {
    expect(parseEnv("gemini", { GEMINI_API_KEY: "k" }).GEMINI_MODEL).toBe("gemini-flash-latest");
    expect(parseEnv("gemini", { GEMINI_API_KEY: "k", GEMINI_MODEL: " " }).GEMINI_MODEL).toBe("gemini-flash-latest");
    expect(parseEnv("gemini", { GEMINI_API_KEY: "k", GEMINI_MODEL: "gemini-pro-latest" }).GEMINI_MODEL).toBe(
      "gemini-pro-latest",
    );
  });

  it("requires a URL for the AI service", () => {
    expect(parseEnv("aiService", { AI_SERVICE_URL: "http://127.0.0.1:8000" }).AI_SERVICE_URL).toBe(
      "http://127.0.0.1:8000",
    );
    expect(() => parseEnv("aiService", { AI_SERVICE_URL: "localhost" })).toThrow(/AI_SERVICE_URL/);
  });

  it("treats empty strings as missing", () => {
    expect(() => parseEnv("gemini", { GEMINI_API_KEY: "" })).toThrow(/GEMINI_API_KEY/);
  });
});
