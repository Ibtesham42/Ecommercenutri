/**
 * Import FIRST in every DB integration test (before Prisma or any lib that
 * reads env). Points Prisma at the disposable local database named by
 * SPIN_TEST_DATABASE_URL — refusing anything that isn't localhost — and blanks
 * every live-service credential. Prisma's runtime loads `.env` for variables
 * that are NOT already set, so pre-setting them (even to "") guarantees the
 * test process can never reach the production DB, Razorpay, Upstash, email,
 * SMS, AI, push or media services.
 */

export const TEST_DB_URL = process.env.SPIN_TEST_DATABASE_URL ?? "";
export const hasLocalDb = /^postgres(ql)?:\/\/[^@]+@(localhost|127\.0\.0\.1)(:\d+)?\//.test(TEST_DB_URL);
if (TEST_DB_URL && !hasLocalDb) {
  throw new Error("SPIN_TEST_DATABASE_URL must point at localhost — refusing to run.");
}

const DEAD = "postgresql://nobody:nobody@127.0.0.1:1/none?connect_timeout=1";
process.env.DATABASE_URL = hasLocalDb ? TEST_DB_URL : DEAD;
process.env.DIRECT_URL = hasLocalDb ? TEST_DB_URL : DEAD;

for (const key of [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
  "NEXT_PUBLIC_RAZORPAY_KEY_ID",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "RESEND_API_KEY",
  "SMTP_HOST",
  "SMTP_USER",
  "SMTP_PASS",
  "GROQ_API_KEY",
  "VAPID_PRIVATE_KEY",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "AUTH_GOOGLE_ID",
  "AUTH_GOOGLE_SECRET",
  "MSG91_AUTH_KEY",
]) {
  process.env[key] = "";
}
