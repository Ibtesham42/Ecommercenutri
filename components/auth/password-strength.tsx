"use client";

import { Check } from "lucide-react";
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
  { label: "Fair", bar: "bg-gold", text: "text-gold-foreground dark:text-gold" },
  { label: "Strong", bar: "bg-sage-deep", text: "text-sage-deep" },
  { label: "Very strong", bar: "bg-primary", text: "text-primary" },
];

/**
 * Segmented password strength meter. Advisory only — the 8-character minimum
 * is enforced by the form and, authoritatively, by the server's Zod schema.
 */
export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  // Under 8 characters is always "Too short", whatever the character mix.
  const score = password.length < 8 ? 0 : scorePassword(password);
  const level = LEVELS[score];
  return (
    <div className="flex items-center gap-3" aria-live="polite">
      <div className="grid flex-1 grid-cols-4 gap-1" aria-hidden>
        {[1, 2, 3, 4].map((i) => (
          <span
            key={i}
            className={cn(
              "h-1 rounded-full transition-colors duration-300",
              i <= Math.max(1, score) ? level.bar : "bg-border",
            )}
          />
        ))}
      </div>
      <span className={cn("min-w-20 text-right text-xs font-medium", level.text)}>
        <span className="sr-only">Password strength: </span>
        {level.label}
      </span>
    </div>
  );
}

/** One requirement row in a live checklist (✓ when met). */
export function LiveCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <li
      className={cn(
        "flex items-center gap-2 text-[13px] transition-colors",
        ok ? "text-foreground/80" : "text-muted-foreground",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-4 place-items-center rounded-full border transition-colors",
          ok ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
        )}
      >
        {ok && <Check className="size-2.5" strokeWidth={3} />}
      </span>
      <span>
        <span className="sr-only">{ok ? "Done: " : "Not yet: "}</span>
        {label}
      </span>
    </li>
  );
}
