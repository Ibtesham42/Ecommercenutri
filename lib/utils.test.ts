import { describe, it, expect } from "vitest";
import { safeRedirectPath } from "./utils";

describe("safeRedirectPath", () => {
  it("keeps internal paths (with query/hash)", () => {
    expect(safeRedirectPath("/checkout")).toBe("/checkout");
    expect(safeRedirectPath("/products?c=seeds#top", "/")).toBe("/products?c=seeds#top");
  });

  it("falls back for anything that could leave the site", () => {
    for (const bad of [
      null,
      undefined,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "/\r\n\\evil.example",
      "javascript:alert(1)",
      "products",
    ]) {
      expect(safeRedirectPath(bad, "/fallback")).toBe("/fallback");
    }
  });
});
