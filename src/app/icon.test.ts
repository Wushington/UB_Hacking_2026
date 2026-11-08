import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appDir = import.meta.dirname;

describe("favicon", () => {
  it("uses the Orbit Study brand mark as the App Router icon", () => {
    const icon = readFileSync(path.join(appDir, "icon.svg"), "utf8");
    const logo = readFileSync(path.join(appDir, "../../public/brand/orbit-study-logo.svg"), "utf8");
    // Same artwork as the navbar logo, framed in a square so it isn't squashed at 16px.
    const [, , w, h] = icon.match(/viewBox="([^"]+)"/)![1].split(/\s+/).map(Number);
    expect(w).toBe(h);
    for (const d of logo.match(/ d="[^"]+"/g)!) expect(icon).toContain(d);
  });

  it("does not ship the default Next.js favicon alongside it", () => {
    expect(existsSync(path.join(appDir, "favicon.ico"))).toBe(false);
  });
});
