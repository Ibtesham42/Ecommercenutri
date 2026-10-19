import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeRefCode, withinRefWindow } from "@/lib/affiliate/ref-cookie";
import {
  affiliateSettingsSchema,
  commissionRuleSchema,
  markPayoutPaidSchema,
  payoutDetailsSchema,
  setCommissionSchema,
} from "@/lib/validations/affiliate";

const DAY = 86_400_000;

describe("referral cookie", () => {
  it("normalises codes and rejects junk", () => {
    expect(normalizeRefCode("AliceFit")).toBe("alicefit");
    expect(normalizeRefCode("a")).toBeNull();
    expect(normalizeRefCode("alice<script>")).toBeNull();
    expect(normalizeRefCode(undefined)).toBeNull();
  });

  it("enforces the configured window against the click time", () => {
    const now = Date.UTC(2026, 9, 19);
    expect(withinRefWindow(String(now - 6 * DAY), 7, now)).toBe(true);
    expect(withinRefWindow(String(now - 8 * DAY), 7, now)).toBe(false);
    expect(withinRefWindow(String(now - 29 * DAY), 30, now)).toBe(true);
    // Cookies set before the timestamp existed were browser-capped at 30 days.
    expect(withinRefWindow(null, 7, now)).toBe(true);
    expect(withinRefWindow("garbage", 7, now)).toBe(true);
  });
});

describe("payout details", () => {
  const ok = (v: unknown) => payoutDetailsSchema.safeParse(v).success;
  it("needs a real UPI ID for UPI", () => {
    expect(ok({ payoutMethod: "UPI", upiId: "alice@okhdfc" })).toBe(true);
    expect(ok({ payoutMethod: "UPI", upiId: "" })).toBe(false);
    expect(ok({ payoutMethod: "UPI", upiId: "alice" })).toBe(false);
  });
  it("needs name, account number and IFSC for bank transfer", () => {
    const bank = { payoutMethod: "BANK_TRANSFER", accountName: "Alice", bankAccount: "1234 5678 9012", bankIfsc: "hdfc0001234" };
    const parsed = payoutDetailsSchema.safeParse(bank);
    expect(parsed.success && parsed.data.bankAccount).toBe("123456789012");
    expect(parsed.success && parsed.data.bankIfsc).toBe("HDFC0001234");
    expect(ok({ ...bank, bankIfsc: "HDFC1234" })).toBe(false);
    expect(ok({ ...bank, bankAccount: "12ab" })).toBe(false);
    expect(ok({ ...bank, accountName: "" })).toBe(false);
  });
  it("doesn't offer RazorpayX to affiliates yet", () => {
    expect(ok({ payoutMethod: "RAZORPAYX" })).toBe(false);
  });
});

describe("admin money inputs", () => {
  it("caps percentage commissions at 100%", () => {
    expect(setCommissionSchema.safeParse({ affiliateId: "a", commissionType: "PERCENT", commissionValue: 150 }).success).toBe(false);
    expect(setCommissionSchema.safeParse({ affiliateId: "a", commissionType: "FIXED", commissionValue: 15000 }).success).toBe(true);
    expect(commissionRuleSchema.safeParse({ scope: "ROLE", role: "BLOGGER", type: "PERCENT", value: 101 }).success).toBe(false);
    expect(affiliateSettingsSchema.safeParse({ affiliateDefaultCommissionType: "PERCENT", affiliateDefaultCommissionValue: 200 }).success).toBe(false);
  });
  it("requires a transfer reference to mark a payout paid", () => {
    expect(markPayoutPaidSchema.safeParse({ payoutId: "p", method: "UPI", reference: "" }).success).toBe(false);
    expect(markPayoutPaidSchema.safeParse({ payoutId: "p", method: "UPI", reference: "UTR412345" }).success).toBe(true);
  });
});

describe("admin affiliate actions RBAC", () => {
  it('every exported action starts with requirePermission("affiliates")', () => {
    const src = readFileSync(path.resolve(__dirname, "../actions/admin/affiliates.ts"), "utf8");
    const chunks = src.split("export async function ").slice(1);
    expect(chunks.length).toBeGreaterThan(15);
    for (const chunk of chunks) {
      const name = chunk.slice(0, chunk.indexOf("("));
      const firstAwait = chunk.split(/\r?\n/).find((l) => l.includes("await "));
      expect(firstAwait?.trim(), name).toMatch(/^(const \w+ = )?await requirePermission\("affiliates"\);$/);
    }
  });
});

describe("payout audit trail", () => {
  it("appends attributed, timestamped lines and shows affiliates only the reason", async () => {
    const { appendPayoutAudit, rejectionAuditText, payoutRejectionReason, payoutAuditLines } = await import(
      "@/lib/affiliate/payout-audit"
    );
    const at = new Date(Date.UTC(2026, 9, 19, 14, 2));
    let notes = appendPayoutAudit(null, "affiliate alicefit", "Requested", at);
    notes = appendPayoutAudit(notes, "ops@nutriyet.in", rejectionAuditText("invalid UPI"), at);
    expect(payoutAuditLines(notes)).toEqual([
      "[2026-10-19 14:02 UTC · affiliate alicefit] Requested",
      "[2026-10-19 14:02 UTC · ops@nutriyet.in] Rejected — reason: invalid UPI",
    ]);
    expect(payoutRejectionReason(notes)).toBe("invalid UPI");
    expect(payoutRejectionReason("legacy plain reason")).toBe("legacy plain reason");
    expect(payoutRejectionReason(appendPayoutAudit(null, "ops@x", "Approved"))).toBeNull();
  });
});
