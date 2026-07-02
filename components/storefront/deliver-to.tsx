"use client";

import { useEffect, useState } from "react";
import { MapPin, ChevronDown, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocation } from "@/lib/store/location";
import { cn } from "@/lib/utils";

/**
 * Delivery-location chip + PIN-code selector. Lives on the deep-green header.
 * The chosen PIN is persisted (Zustand → localStorage) and mirrored to a cookie
 * so it could be read server-side later; today it just reflects in the header
 * chip. No pricing/serviceability logic is changed — purely additive UX.
 */
export function DeliverTo({ className }: { className?: string }) {
  const pincode = useLocation((s) => s.pincode);
  const setPincode = useLocation((s) => s.setPincode);

  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  useEffect(() => setMounted(true), []);

  // Show the saved PIN only after mount to avoid an SSR/CSR hydration mismatch.
  const label = mounted && pincode ? pincode : "India";

  function openDialog() {
    setValue(pincode ?? "");
    setError(null);
    setOpen(true);
  }

  function persist(pin: string | null) {
    setPincode(pin);
    // Mirror to a cookie (1y) so the value is available beyond this client store.
    document.cookie = pin
      ? `nut_pincode=${pin}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
      : `nut_pincode=; path=/; max-age=0; samesite=lax`;
  }

  function save() {
    const pin = value.trim();
    if (!/^\d{6}$/.test(pin)) {
      setError("Please enter a valid 6-digit PIN code.");
      return;
    }
    // Tiny delay just for a confirming "checking" affordance (no network call).
    setChecking(true);
    setTimeout(() => {
      persist(pin);
      setChecking(false);
      setOpen(false);
      toast.success(`Delivering to ${pin}`);
    }, 350);
  }

  function clear() {
    persist(null);
    setValue("");
    setError(null);
    setOpen(false);
    toast("Delivery location cleared");
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={cn(
          // Light mobile header (<lg) vs deep-green desktop chrome (lg+).
          "flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground lg:text-surface-deep-foreground/80 lg:hover:bg-white/10 lg:hover:text-surface-deep-foreground",
          className,
        )}
        aria-label="Set delivery location"
      >
        <MapPin className="size-4 shrink-0 text-primary lg:text-gold" />
        <span className="truncate">
          Deliver to{" "}
          <span className="font-semibold text-foreground lg:text-surface-deep-foreground">{label}</span>
        </span>
        <ChevronDown className="size-3.5 shrink-0 opacity-70" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose delivery location</DialogTitle>
            <DialogDescription>
              Enter your PIN code to personalise delivery for your area.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-xl border bg-muted/40 px-3 py-2.5 text-sm">
              <MapPin className="size-4 text-primary" />
              <span className="text-muted-foreground">Country</span>
              <span className="ml-auto font-medium">India</span>
            </div>

            <div>
              <label htmlFor="deliver-pincode" className="text-sm font-medium">
                PIN code
              </label>
              <Input
                id="deliver-pincode"
                inputMode="numeric"
                autoComplete="postal-code"
                maxLength={6}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value.replace(/\D/g, "").slice(0, 6));
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder="e.g. 400001"
                className="mt-1.5 h-11"
                autoFocus
                aria-invalid={!!error}
              />
              {error ? (
                <p className="mt-1.5 text-xs text-destructive">{error}</p>
              ) : (
                <p className="mt-1.5 text-xs text-muted-foreground">
                  We deliver across India · free shipping over ₹499.
                </p>
              )}
            </div>

            {mounted && pincode && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Check className="size-3.5" /> Currently delivering to {pincode}
              </p>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            {mounted && pincode && (
              <Button type="button" variant="ghost" onClick={clear}>
                Clear
              </Button>
            )}
            <Button type="button" onClick={save} disabled={checking} className="gap-2">
              {checking && <Loader2 className="size-4 animate-spin" />}
              {checking ? "Checking…" : "Save location"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
