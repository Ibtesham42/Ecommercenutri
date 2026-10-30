import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regression tests for the 2026-10-30 security audit: Web Push endpoint
 * allowlist (blind SSRF via the marketing push sender) and HTML escaping of
 * user-controlled names in transactional emails. Prisma + auth are mocked.
 */

const upsert = vi.fn();
vi.mock("@/lib/prisma", () => ({ prisma: { pushSubscription: { upsert } } }));
vi.mock("@/lib/auth", () => ({ getCurrentUser: vi.fn(async () => ({ id: "user_1" })) }));

const { POST } = await import("@/app/api/push/subscribe/route");
const emails = await import("@/lib/emails");

const KEYS = { p256dh: "BNcR".padEnd(87, "x"), auth: "tBHI".padEnd(22, "y") };

function subscribe(endpoint: unknown) {
  return POST(
    new Request("http://localhost/api/push/subscribe", {
      method: "POST",
      body: JSON.stringify({ endpoint, keys: KEYS }),
    }),
  );
}

describe("push subscribe endpoint allowlist", () => {
  beforeEach(() => upsert.mockReset());

  it.each([
    "https://fcm.googleapis.com/fcm/send/abc123",
    "https://updates.push.services.mozilla.com/wpush/v2/abc",
    "https://web.push.apple.com/QF8abc",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("accepts a real push service: %s", async (endpoint) => {
    const res = await subscribe(endpoint);
    expect(res.status).toBe(200);
    expect(upsert).toHaveBeenCalledOnce();
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://169.254.169.254/latest/meta-data/",
    "https://localhost:3000/api/cron/marketing",
    "https://fcm.googleapis.com.evil.example/x",
    "https://evilnotify.windows.com.attacker.io/x",
    "https://fcm.googleapis.com:8443/x",
    "https://user:pw@fcm.googleapis.com/x",
    "not a url",
    42,
  ])("rejects %s", async (endpoint) => {
    const res = await subscribe(endpoint);
    expect(res.status).toBe(400);
    expect(upsert).not.toHaveBeenCalled();
  });
});

describe("transactional emails escape user-controlled names", () => {
  const evil = `<a href="https://phish.example">Click to claim ₹5000</a>`;

  it.each([
    ["verificationEmail", () => emails.verificationEmail("https://nutriyet.in/v?t=1", evil)],
    ["passwordResetEmail", () => emails.passwordResetEmail("https://nutriyet.in/r?t=1", evil)],
    ["emailChangedNotice", () => emails.emailChangedNotice(`x@y.z${evil}`, evil)],
  ])("%s", (_name, build) => {
    const { html } = build();
    expect(html).not.toContain("phish.example\">");
    expect(html).not.toContain("<a href=\"https://phish");
    expect(html).toContain("&lt;a href=&quot;https://phish.example&quot;&gt;");
  });
});
