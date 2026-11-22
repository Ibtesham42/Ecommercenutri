import type { FieldErrors, FieldValues } from "react-hook-form";
import { toast } from "sonner";
import { SESSION_EXPIRED_MESSAGE } from "@/lib/admin/direct-upload";

type Result = { ok: boolean; error?: string };

/** True when the browser still holds a signed-in session (best-effort). */
async function stillSignedIn(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    const data = (await res.json().catch(() => null)) as { user?: unknown } | null;
    return Boolean(data?.user);
  } catch {
    return true; // can't tell (offline) — don't claim the session expired
  }
}

/**
 * Run an admin server action from a client form without ever failing silently.
 * Admin actions THROW on an expired session / revoked permission (and on a
 * dropped connection); un-caught, that left the Save spinner running with no
 * message. Here every outcome resolves to `{ ok, error }` with a safe message.
 */
export async function runAdminAction<R extends Result>(fn: () => Promise<R>): Promise<R> {
  try {
    return await fn();
  } catch (err) {
    console.error("[admin] action failed:", err);
    // Every AdminResult failure variant is `{ ok: false; error; …optional }`.
    const fail = (error: string) => ({ ok: false, error }) as R;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return fail("Network connection lost. Please check your internet and retry.");
    }
    if (!(await stillSignedIn())) return fail(SESSION_EXPIRED_MESSAGE);
    return fail("Couldn't save. You may not have permission for this, or the server had a problem — please try again.");
  }
}

/**
 * `handleSubmit(onValid, toastInvalid)` — react-hook-form blocks submit on a
 * failed `required` rule without any visible message; surface the first one.
 */
export function toastInvalid<T extends FieldValues>(errors: FieldErrors<T>) {
  const first = Object.values(errors)[0] as { message?: unknown } | undefined;
  const message = typeof first?.message === "string" && first.message ? first.message : "Please fill in the required fields.";
  toast.error(message);
}

/** Message for a Save clicked while an upload is still running. */
export const UPLOAD_PENDING_MESSAGE = "Please wait for the upload to finish before saving.";
