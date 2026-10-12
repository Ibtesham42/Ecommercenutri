import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/**
 * Loads the real public/sw.js in a sandbox and checks its routing rules:
 * personal pages (incl. Spin & Win coupon codes) are never intercepted, and
 * invariant #1 (only clean same-origin 200s are cacheable) still holds.
 */
const source = readFileSync(path.resolve(__dirname, "../public/sw.js"), "utf8");
const sandbox: Record<string, unknown> = {
  URL,
  self: { addEventListener: () => {}, location: { origin: "https://nutriyet.in" }, clients: {} },
  caches: {},
  fetch: () => Promise.reject(new Error("no network in tests")),
};
vm.runInNewContext(source, sandbox);
const shouldBypass = sandbox.shouldBypass as (u: URL) => boolean;
const isCacheable = sandbox.isCacheable as (r: unknown) => boolean;
const u = (p: string) => new URL(p, "https://nutriyet.in");

describe("service worker", () => {
  it("never intercepts /spin (personal coupon codes)", () => {
    expect(shouldBypass(u("/spin"))).toBe(true);
    expect(shouldBypass(u("/spin?_rsc=abc"))).toBe(true);
    expect(shouldBypass(u("/spin/anything"))).toBe(true);
  });

  it("keeps the existing personal/admin bypasses and still serves public pages", () => {
    for (const p of ["/account", "/checkout", "/admin/spin", "/api/track"]) expect(shouldBypass(u(p))).toBe(true);
    for (const p of ["/", "/products", "/offers", "/spinach-recipes"]) expect(shouldBypass(u(p))).toBe(false);
  });

  it("invariant #1: only clean same-origin 200s are cacheable", () => {
    expect(isCacheable({ ok: true, type: "basic", redirected: false })).toBe(true);
    expect(isCacheable({ ok: true, type: "basic", redirected: true })).toBe(false);
    expect(isCacheable({ ok: true, type: "opaque", redirected: false })).toBe(false);
    expect(isCacheable({ ok: false, type: "basic", redirected: false })).toBe(false);
  });

  it("cache VERSION was bumped for the routing change", () => {
    expect(source).toMatch(/const VERSION = "nutriyet-v5";/);
  });
});
