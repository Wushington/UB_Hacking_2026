import { describe, expect, it } from "vitest";
import { prepareNotesPrint } from "./notes-print";

describe("notes PDF preview", () => {
  it("exports only notes, preserves structure and escapes titles", () => {
    const source = document.createElement("div");
    source.innerHTML = '<section><h2>Energy</h2><ul><li>First idea</li></ul><span class="katex">E = mc²</span></section>';
    const target = document.implementation.createHTMLDocument();
    prepareNotesPrint(target, source, '<img src=x onerror=alert(1)>', "Physics");
    expect(target.querySelector("h1")?.textContent).toBe('<img src=x onerror=alert(1)>');
    expect(target.querySelector("img")).toBeNull();
    expect(target.querySelector("h2")?.textContent).toBe("Energy");
    expect(target.querySelector("li")?.textContent).toBe("First idea");
    expect(target.querySelector(".katex")?.textContent).toBe("E = mc²");
    expect(target.querySelector(".export-subject")?.textContent).toBe("Physics");
    expect(source.querySelector("h2")).not.toBeNull();
    expect(target.querySelector("style")?.textContent).toContain("counter(page)");
  });
});