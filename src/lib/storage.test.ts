import { describe, expect, it } from "vitest";
import { newObjectKey } from "./storage";

describe("newObjectKey", () => {
  it("namespaces keys by owner and purpose", () => {
    expect(newObjectKey("user_123", "lecture_image")).toMatch(/^users\/user_123\/lecture_image\/[0-9a-f-]{36}$/);
  });

  it("randomizes every key so keys can't be guessed or collide", () => {
    expect(newObjectKey("u", "lecture_audio")).not.toBe(newObjectKey("u", "lecture_audio"));
  });
});
