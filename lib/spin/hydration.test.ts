import { afterAll, describe, expect, it, vi } from "vitest";

/**
 * B3 regression: /spin's result panel (a client component) SSR-renders the
 * claim deadline (`formatDateTime`) and coupon expiry (`formatDate`). Vercel
 * renders in UTC; the shopper's browser hydrates in IST. If the formatters
 * follow the machine zone the text differs and React throws #418.
 *
 * Simulates both sides by loading lib/format fresh under each TZ (its
 * Intl formatters are created at module load) and requires identical output.
 * The machine running the suite may itself be in IST, so the zone is forced.
 */

const ORIGINAL_TZ = process.env.TZ;
afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

async function formatterIn(tz: string) {
  process.env.TZ = tz;
  vi.resetModules();
  return import("@/lib/format");
}

// A claim deadline and a coupon expiry, incl. instants on the UTC/IST day edge.
const INSTANTS = [
  "2026-10-12T05:18:00.000Z", // ordinary daytime — date-time differs by 5:30 if unpinned
  "2026-10-12T20:00:00.000Z", // 01:30 IST next day — date differs if unpinned
  "2026-10-12T18:29:59.000Z", // 23:59:59 IST
];

describe("/spin date rendering is identical on a UTC server and an IST browser", () => {
  it("formatDateTime (claim deadline) and formatDate (offer validity) match", async () => {
    const server = await formatterIn("UTC");
    const serverOut = INSTANTS.map((i) => [server.formatDateTime(i), server.formatDate(i)]);
    const browser = await formatterIn("Asia/Kolkata");
    const browserOut = INSTANTS.map((i) => [browser.formatDateTime(i), browser.formatDate(i)]);
    expect(serverOut).toEqual(browserOut);
  });

  it("renders in IST (the business zone) even on a UTC server", async () => {
    const server = await formatterIn("UTC");
    expect(server.formatDate("2026-10-12T20:00:00.000Z")).toBe("13 Oct 2026");
    expect(server.formatDateTime("2026-10-12T05:18:00.000Z")).toMatch(/^12 Oct 2026, 10:48\s?am$/i);
  });
});
