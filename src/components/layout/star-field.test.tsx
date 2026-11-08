import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StarField } from "./star-field";

describe("StarField", () => {
  it("draws the Figma star field as decorative, motion-safe twinkling stars", () => {
    const { container } = render(<StarField />);
    const field = container.firstElementChild as HTMLElement;
    expect(field).toHaveAttribute("aria-hidden", "true");

    const stars = field.querySelectorAll("[data-star]");
    expect(stars).toHaveLength(66);
    for (const star of stars) {
      expect(star.className).toContain("motion-safe:animate-twinkle");
      // Delays stay within one 4s twinkle cycle so every star is mid-flicker on first paint.
      const delay = parseFloat((star as HTMLElement).style.animationDelay);
      expect(delay).toBeGreaterThanOrEqual(-4);
      expect(delay).toBeLessThanOrEqual(0);
    }
  });
});
