import { afterEach, describe, expect, it, vi } from "vitest";

async function appUrl(vars: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
  return (await import("./env")).env.appUrl;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("env.appUrl", () => {
  it("prefers NEXT_PUBLIC_APP_URL", async () => {
    expect(await appUrl({ NEXT_PUBLIC_APP_URL: "https://nutriyet.in", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" })).toBe("https://nutriyet.in");
  });
  it("falls back to the Vercel production domain, never localhost, on a deployment", async () => {
    expect(await appUrl({ NEXT_PUBLIC_APP_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "nutriyet.in" })).toBe("https://nutriyet.in");
  });
  it("uses localhost only when nothing is configured", async () => {
    expect(await appUrl({ NEXT_PUBLIC_APP_URL: "", VERCEL_PROJECT_PRODUCTION_URL: "" })).toBe("http://localhost:3000");
  });
});
