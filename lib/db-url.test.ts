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
  it("forces pgbouncer=true on the Supabase transaction pooler only", () => {
    const pooler = "postgresql://u:p@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres";
    expect(normalizeDbUrl(pooler)).toBe(`${pooler}?pgbouncer=true`);
    expect(normalizeDbUrl(`${pooler}?connection_limit=1`)).toBe(`${pooler}?connection_limit=1&pgbouncer=true`);
    expect(normalizeDbUrl(`${pooler}?pgbouncer=true`)).toBe(`${pooler}?pgbouncer=true`);
    const session = "postgresql://u:p@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres";
    expect(normalizeDbUrl(session)).toBe(session);
    expect(normalizeDbUrl("postgresql://u:p@127.0.0.1:5436/db")).toBe("postgresql://u:p@127.0.0.1:5436/db");
  });
});
