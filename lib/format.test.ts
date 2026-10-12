import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "@/lib/format";

// Server (Vercel, UTC) and browser (IST) must format the same instant the same
// way, or client components fail to hydrate. These instants sit on a UTC/IST
// day boundary, so they only pass when the formatters are pinned to IST.
describe("date formatting is pinned to IST", () => {
  it("formats a late-evening UTC instant as the next IST day", () => {
    // 20:00 UTC on 5 Jul = 01:30 IST on 6 Jul
    expect(formatDate("2026-07-05T20:00:00Z")).toBe("6 Jul 2026");
  });

  it("keeps an early-morning IST instant on the same IST day", () => {
    // 19:00 UTC on 4 Jul = 00:30 IST on 5 Jul
    expect(formatDate(new Date("2026-07-04T19:00:00Z"))).toBe("5 Jul 2026");
  });

  it("formats date-times in IST", () => {
    // 09:00 UTC = 14:30 IST
    expect(formatDateTime("2026-07-05T09:00:00Z")).toMatch(/^5 Jul 2026, 0?2:30\s?pm$/i);
  });
});
