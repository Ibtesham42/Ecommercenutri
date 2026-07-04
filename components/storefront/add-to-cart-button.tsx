"use client";

import * as React from "react";
import { useRef, useState } from "react";
import { ShoppingCart, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Add-to-cart button with premium micro-interactions: a click ripple, the
 * Button primitive's press/scale feedback, a hover icon lift, and a brief success
 * state ("Added" + checkmark) that reverts after ~1.4s. `onAdd` does the actual
 * cart mutation (which also bumps the header cart icon via the store). All motion
 * is reduced-motion friendly. Keeps existing behavior — purely additive UX.
 */
export function AddToCartButton({
  onAdd,
  disabled,
  label = "Add to cart",
  addedLabel = "Added",
  className,
  variant = "outline",
  size = "lg",
  iconClassName = "size-5",
}: {
  onAdd: () => void;
  disabled?: boolean;
  label?: string;
  addedLabel?: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
  iconClassName?: string;
}) {
  const [added, setAdded] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function spawnRipple(e: React.PointerEvent<HTMLButtonElement>) {
    if (prefersReducedMotion()) return;
    const btn = e.currentTarget;
    const rect = btn.getBoundingClientRect();
    const d = Math.max(rect.width, rect.height);
    const span = document.createElement("span");
    span.className = "btn-ripple";
    span.style.width = span.style.height = `${d}px`;
    span.style.left = `${e.clientX - rect.left - d / 2}px`;
    span.style.top = `${e.clientY - rect.top - d / 2}px`;
    span.addEventListener("animationend", () => span.remove());
    btn.appendChild(span);
  }

  function handleClick() {
    if (disabled) return;
    onAdd();
    setAdded(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setAdded(false), 1400);
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onPointerDown={spawnRipple}
      onClick={handleClick}
      disabled={disabled}
      aria-live="polite"
      data-heat="add-to-cart"
      className={cn(
        "relative overflow-hidden",
        added && "border-primary text-primary",
        className,
      )}
    >
      <span className="relative z-10 inline-flex items-center gap-2">
        {added ? (
          <Check className={cn(iconClassName, "animate-pop")} />
        ) : (
          <ShoppingCart
            className={cn(
              iconClassName,
              "transition-transform duration-200 group-hover/button:-translate-y-px",
            )}
          />
        )}
        {added ? addedLabel : label}
      </span>
    </Button>
  );
}
