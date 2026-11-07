import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("home page", () => {
  it("shows the Orbit Study brand", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { level: 1, name: /orbit study/i })).toBeInTheDocument();
  });
});
