"use client";

import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

const LENGTH = 6;

/**
 * Six-box OTP field: auto-focus, auto-advance, backspace-to-previous, full
 * paste support and `autocomplete="one-time-code"` (iOS/Android SMS
 * autofill). Boxes flex-shrink so the row fits a 320px viewport. The parent
 * owns the value and gets `onComplete` exactly when all six digits are in.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled,
  autoFocus = true,
  error,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete: (code: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  error?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);

  function commit(next: string) {
    onChange(next);
    if (next.length === LENGTH) onComplete(next);
  }

  function handleChange(index: number, raw: string) {
    const digits = raw.replace(/\D/g, "");
    if (!digits) return;
    // Typing OR OS autofill dumping several digits into one box.
    const next = (value.slice(0, index) + digits).slice(0, LENGTH);
    commit(next);
    refs.current[Math.min(next.length, LENGTH - 1)]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const cut = value.length && index >= value.length - 1 ? value.length - 1 : index;
      onChange(value.slice(0, Math.max(0, cut)));
      refs.current[Math.max(0, cut)]?.focus();
    } else if (e.key === "ArrowLeft") {
      refs.current[Math.max(0, index - 1)]?.focus();
    } else if (e.key === "ArrowRight") {
      refs.current[Math.min(LENGTH - 1, index + 1)]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const digits = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, LENGTH);
    if (!digits) return;
    commit(digits);
    refs.current[Math.min(digits.length, LENGTH - 1)]?.focus();
  }

  return (
    <div
      className="flex justify-center gap-1.5 sm:gap-2"
      role="group"
      aria-label="One-time code"
    >
      {Array.from({ length: LENGTH }, (_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={LENGTH} // roomy so autofill/paste can land in one box
          value={value[i] ?? ""}
          onChange={(e) => handleChange(i, e.target.value)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          disabled={disabled}
          aria-label={`Digit ${i + 1} of ${LENGTH}`}
          className={cn(
            "aspect-square w-full min-w-0 max-w-12 rounded-xl border bg-background text-center font-heading text-xl font-semibold caret-primary shadow-elev-1 transition-all duration-150 outline-none",
            "focus:border-primary/60 focus:ring-2 focus:ring-primary/25 motion-safe:focus:scale-[1.04]",
            value[i] && "border-primary/40 bg-primary/5",
            error && "border-destructive/60 bg-destructive/5",
            disabled && "opacity-60",
          )}
        />
      ))}
    </div>
  );
}
