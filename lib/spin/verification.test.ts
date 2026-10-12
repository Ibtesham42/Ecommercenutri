import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 2C: verified-claim rule, the per-browser limiter key, and the sign-up
 * callback that returns a new shopper to /spin. Prisma/email/auth are mocked.
 */

vi.mock("server-only", () => ({}));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers({ "x-forwarded-for": "198.51.100.4" }),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: () => unknown) => fn, revalidateTag: vi.fn() }));
const getCurrentUser = vi.fn();
vi.mock("@/lib/auth", () => ({ getCurrentUser, signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  limiters: { auth: {}, spinIp: {}, spinBrowser: {}, spinClaim: {} },
}));
vi.mock("@/lib/recommendations/events", () => ({ trackEvent: vi.fn() }));
vi.mock("@/lib/tokens", () => ({ createVerificationToken: vi.fn().mockResolvedValue("tok123"), createPasswordResetToken: vi.fn() }));
const sendEmail = vi.fn();
vi.mock("@/lib/email", () => ({ sendEmail }));
const prismaMock = { user: { findUnique: vi.fn(), create: vi.fn() } };
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { isVerifiedClaimant } = await import("@/lib/spin/service");
const { browserLimitKey } = await import("@/lib/spin/limits");
const { sendSpinVerificationEmail } = await import("@/lib/actions/spin");
const { registerAction } = await import("@/lib/actions/auth");

beforeEach(() => {
  vi.clearAllMocks();
});

const when = new Date("2026-10-01T00:00:00Z");

describe("isVerifiedClaimant", () => {
  const base = { email: "a@example.com", emailVerified: null, phone: null, phoneVerified: null };
  it("accepts a verified email or a verified phone", () => {
    expect(isVerifiedClaimant({ ...base, emailVerified: when })).toBe(true);
    expect(isVerifiedClaimant({ ...base, phone: "+919800000000", phoneVerified: when })).toBe(true);
  });
  it("rejects unverified accounts — a phone merely saved on the profile doesn't count", () => {
    expect(isVerifiedClaimant(base)).toBe(false);
    expect(isVerifiedClaimant({ ...base, phone: "+919800000000" })).toBe(false);
    expect(isVerifiedClaimant(null)).toBe(false);
  });
  it("a phone-login placeholder email is never an email verification", () => {
    expect(isVerifiedClaimant({ ...base, email: "u919800000000@phone.nutriyet.in", emailVerified: when })).toBe(false);
  });
});

describe("browserLimitKey", () => {
  it("uses a well-formed browser id as is", () => {
    expect(browserLimitKey("5f0c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", "1.2.3.4", "UA")).toBe(
      "anon:5f0c1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b",
    );
  });
  it("falls back to a stable one-way IP+UA hash for missing/forged ids", () => {
    const k = browserLimitKey(null, "1.2.3.4", "UA");
    expect(k).toMatch(/^fp:[a-f0-9]{32}$/);
    expect(browserLimitKey("not a uuid!", "1.2.3.4", "UA")).toBe(k);
    expect(k).not.toContain("1.2.3.4");
  });
});

describe("sign-up keeps the /spin callback (server side)", () => {
  const form = (callbackUrl?: string) => {
    const f = new FormData();
    f.set("name", "Asha");
    f.set("email", "asha@example.com");
    f.set("password", "Str0ng-pass!");
    if (callbackUrl !== undefined) f.set("callbackUrl", callbackUrl);
    return f;
  };

  beforeEach(() => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ id: "u1" });
  });

  it("puts next=/spin on the verification link", async () => {
    const res = await registerAction(undefined, form("/spin"));
    expect(res?.success).toBeTruthy();
    expect(sendEmail.mock.calls[0][0].html).toContain("verify-email?token=tok123&next=%2Fspin");
  });

  it("default sign-ups get exactly the old link", async () => {
    await registerAction(undefined, form());
    const html = sendEmail.mock.calls[0][0].html as string;
    expect(html).toContain("verify-email?token=tok123");
    expect(html).not.toContain("next=");
  });

  it("refuses off-site callbacks (open-redirect safe)", async () => {
    await registerAction(undefined, form("https://evil.example/x"));
    expect(sendEmail.mock.calls[0][0].html).not.toContain("next=");
  });
});

describe("verify-to-claim recovery: sendSpinVerificationEmail", () => {
  it("requires sign-in", async () => {
    getCurrentUser.mockResolvedValue(null);
    expect(await sendSpinVerificationEmail()).toMatchObject({ ok: false });
  });
  it("phone-login accounts are pointed at adding an email or verifying the phone", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1" });
    prismaMock.user.findUnique.mockResolvedValue({ email: "u91@phone.nutriyet.in", emailVerified: null, name: null });
    expect(await sendSpinVerificationEmail()).toMatchObject({ ok: false });
    expect(sendEmail).not.toHaveBeenCalled();
  });
  it("sends the standard verification link, returning to /spin", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1" });
    prismaMock.user.findUnique.mockResolvedValue({ email: "asha@example.com", emailVerified: null, name: "Asha" });
    expect(await sendSpinVerificationEmail()).toMatchObject({ ok: true });
    expect(sendEmail.mock.calls[0][0].to).toBe("asha@example.com");
    expect(sendEmail.mock.calls[0][0].html).toContain("next=%2Fspin");
  });
});
