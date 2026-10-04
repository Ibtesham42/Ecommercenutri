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
