"use client";

import { cn } from "@/lib/utils";

/** 0–4: length, extra length, case mix, digits, symbols. */
export function scorePassword(pw: string): number {
  if (!pw) return 0;
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^a-zA-Z0-9]/.test(pw)) s++;
  return Math.min(4, s);
}

const LEVELS = [
  { label: "Too short", bar: "bg-destructive/70", text: "text-destructive" },
  { label: "Weak", bar: "bg-destructive", text: "text-destructive" },
  { label: "Medium", bar: "bg-amber-500", text: "text-amber-600" },
  { label: "Strong", bar: "bg-lime-500", text: "text-lime-600" },
  { label: "Very strong", bar: "bg-primary", text: "text-primary" },
];

/**
 * Animated password strength meter — MOBILE ONLY (`sm:hidden`) so the desktop
 * sign-up form stays visually unchanged. Pure presentation; submission rules
 * are untouched (server-side Zod remains authoritative).
 */
export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const score = scorePassword(password);
  const level = LEVELS[score];
  return (
    <div className="mt-2 sm:hidden" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn("h-full rounded-full transition-all duration-300 ease-out", level.bar)}
            style={{ width: `${Math.max(8, (score / 4) * 100)}%` }}
          />
        </div>
        <span className={cn("w-20 text-right text-xs font-medium", level.text)}>{level.label}</span>
      </div>
    </div>
  );
}

/** One live-validation row (✓ / ○), MOBILE ONLY via the parent's `sm:hidden`. */
export function LiveCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      className={cn(
        "flex items-center gap-1.5 text-xs transition-colors",
        ok ? "text-primary" : "text-muted-foreground/70",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-3.5 place-items-center rounded-full border text-[9px] font-bold transition-colors",
          ok ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
        )}
      >
        {ok ? "✓" : ""}
      </span>
      {label}
    </li>
  );
}
