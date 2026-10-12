import { Prisma } from "@prisma/client";

/**
 * One-shot retry: Neon scales to zero and the first query after idle can throw
 * P1001 — retrying once warms the connection back up. Same pattern already
 * used privately inside a handful of query modules (JNV, social, analytics,
 * BI, marketing, intelligence); this is a shared copy for the core
 * storefront/checkout read paths that had none. Intentionally not imported
 * by those existing modules — they keep their own copies untouched.
 */
export async function withDbRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("[db] query failed, retrying once:", err);
    await new Promise((r) => setTimeout(r, 400));
    return fn();
  }
}

/**
 * Postgres aborted a transaction to break a deadlock (40P01) or a
 * serialization conflict (40001); Prisma surfaces both as P2034. The whole
 * transaction rolled back, so re-running it from the start is safe.
 */
export function isTransientTxError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2034") return true;
  const msg = err instanceof Error ? err.message : "";
  return /40P01|40001|deadlock detected|could not serialize access/i.test(msg);
}

/**
 * Run an interactive transaction, retrying ONLY on transient abort errors
 * (above) — at most `attempts` runs in total, with a short jittered backoff.
 * Business errors thrown inside the transaction propagate unchanged.
 */
export async function withTxRetry<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await run();
    } catch (err) {
      if (i >= attempts || !isTransientTxError(err)) throw err;
      await new Promise((r) => setTimeout(r, 40 * i + Math.floor(Math.random() * 60)));
    }
  }
}

/**
 * Interactive-transaction limits for short, contended write paths (Spin &
 * Win claims, single-use offer checkout). Prisma's defaults (maxWait 2 s,
 * timeout 5 s) can trip on a Neon cold start or while queued behind a
 * serialising lock; these stay well under Vercel's function limit.
 */
export const TX_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const;
