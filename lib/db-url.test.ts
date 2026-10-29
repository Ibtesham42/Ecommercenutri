import { describe, it, expect } from "vitest";
import { normalizeDbUrl } from "./db-url";

const URL_ = "postgresql://u:p@host:6543/postgres?pgbouncer=true";

describe("normalizeDbUrl", () => {
  it("leaves a clean URL untouched", () => {
    expect(normalizeDbUrl(URL_)).toBe(URL_);
  });
  it("repairs the dashboard-paste shapes that broke prod", () => {
    for (const raw of [`"${URL_}"`, `'${URL_}'`, `  ${URL_}\n`, `DATABASE_URL=${URL_}`, `DATABASE_URL="${URL_}"`]) {
      expect(normalizeDbUrl(raw)).toBe(URL_);
    }
  });
  it("returns undefined for missing/blank values", () => {
    expect(normalizeDbUrl(undefined)).toBeUndefined();
    expect(normalizeDbUrl('  ""  ')).toBeUndefined();
  });
});
