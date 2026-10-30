import { hasLocalDb } from "@/lib/test/local-db-env"; // must stay first: pins DB + blanks live keys
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Reset/verification tokens on a real (local, disposable) Postgres: only the
 * SHA-256 is stored, the raw emailed token still works, and a reset link is
 * strictly single-use even under concurrent submits.
 *
 *   SPIN_TEST_DATABASE_URL=... npx vitest run lib/tokens.int.test.ts
 */

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), revalidatePath: vi.fn(), unstable_cache: (fn: () => unknown) => fn }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: vi.fn(), delete: vi.fn() }),
  headers: async () => new Headers({ "x-forwarded-for": "127.0.0.1" }),
}));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("@/lib/auth", () => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@/lib/email", () => ({ sendEmail: vi.fn() }));

const ctx = hasLocalDb
  ? {
      prisma: (await import("@/lib/prisma")).prisma,
      tokens: await import("@/lib/tokens"),
      auth: await import("@/lib/actions/auth"),
    }
  : null;

const EMAIL = "reset@tokens.test";

function resetForm(token: string, password: string) {
  const fd = new FormData();
  fd.set("token", token);
  fd.set("password", password);
  return fd;
}

describe.skipIf(!ctx)("hashed auth tokens (integration)", () => {
  if (!ctx) return;
  const { prisma, tokens, auth } = ctx;

  async function cleanup() {
    await prisma.passwordResetToken.deleteMany({ where: { email: EMAIL } });
    await prisma.verificationToken.deleteMany({ where: { identifier: EMAIL } });
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  }

  beforeAll(async () => {
    await cleanup();
    await prisma.user.create({ data: { email: EMAIL } });
  });
  afterAll(async () => {
    await cleanup();
    await prisma.$disconnect();
  });

  it("stores only the hash of a reset token; the stored value is not a usable link", async () => {
    const raw = await tokens.createPasswordResetToken(EMAIL);
    const row = await prisma.passwordResetToken.findFirstOrThrow({ where: { email: EMAIL } });
    expect(row.token).not.toBe(raw);
    expect(row.token).toBe(tokens.hashToken(raw));

    const leaked = await auth.resetPasswordAction(undefined, resetForm(row.token, "Leaked-pass-123"));
    expect(leaked?.error).toMatch(/invalid or has expired/);
  });

  it("a reset link works once, even when submitted concurrently", async () => {
    const raw = await tokens.createPasswordResetToken(EMAIL);
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => auth.resetPasswordAction(undefined, resetForm(raw, `New-pass-${i}-abc`))),
    );
    expect(results.filter((r) => r?.success).length).toBe(1);
    const again = await auth.resetPasswordAction(undefined, resetForm(raw, "Replay-pass-123"));
    expect(again?.error).toMatch(/invalid or has expired/);
  });

  it("email verification accepts the raw token, never the stored hash", async () => {
    const raw = await tokens.createVerificationToken(EMAIL);
    const row = await prisma.verificationToken.findFirstOrThrow({ where: { identifier: EMAIL } });
    expect(row.token).toBe(tokens.hashToken(raw));
    expect((await auth.verifyEmailToken(row.token)).ok).toBe(false);
    expect((await auth.verifyEmailToken(raw)).ok).toBe(true);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: EMAIL } });
    expect(user.emailVerified).not.toBeNull();
  });
});
