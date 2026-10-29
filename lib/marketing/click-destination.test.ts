import { describe, it, expect } from "vitest";
import { resolveClickDestination as dest } from "./click-destination";

const BASE = "https://nutriyet.in";

describe("resolveClickDestination", () => {
  it("allows same-origin paths and absolute same-origin URLs", () => {
    expect(dest("/products?sort=new", BASE, null)).toBe("https://nutriyet.in/products?sort=new");
    expect(dest("https://nutriyet.in/blog", BASE, null)).toBe("https://nutriyet.in/blog");
  });

  it("allows an off-site URL only when it is the campaign's own CTA", () => {
    const cta = "https://instagram.com/nutriyet";
    expect(dest(cta, BASE, cta)).toBe(cta);
    expect(dest("https://evil.example/login", BASE, cta)).toBe(BASE);
  });

  it("refuses open-redirect payloads", () => {
    for (const to of [
      "https://evil.example",
      "//evil.example/x",
      "/\evil.example",
      "javascript:alert(1)",
      "https://nutriyet.in.evil.example/",
      "https://nutriyet.in@evil.example/",
    ]) {
      expect(new URL(dest(to, BASE, null)).origin).toBe(BASE);
    }
  });
});
