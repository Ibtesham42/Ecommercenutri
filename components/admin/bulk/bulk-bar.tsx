"use client";

import { useState, type ReactNode } from "react";
import { X, Loader2, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export type BulkAction = {
  key: string;
  label: string;
  icon?: LucideIcon;
  destructive?: boolean;
  /** When set, clicking opens a confirm dialog before running. */
  confirm?: { title: string; description: string; actionLabel?: string };
};

/**
 * Floating action bar shown while ≥1 admin table row is selected. Reusable across
 * every module — pass the selection count, the available actions, and an async
 * `onRun(key)` that performs the bulk server action. Destructive actions can carry
 * a `confirm` dialog. Mobile-friendly (wraps, sticks to the bottom).
 */
export function BulkBar({
  count,
  actions,
  onRun,
  onClear,
  pending,
  children,
}: {
  count: number;
  actions: BulkAction[];
  onRun: (key: string) => void;
  onClear: () => void;
  pending?: boolean;
  /** Optional extra controls (e.g. a status <select>) rendered before the action buttons. */
  children?: ReactNode;
}) {
  const [confirming, setConfirming] = useState<BulkAction | null>(null);
  if (count === 0) return null;

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 flex justify-center px-3">
        <div className="pointer-events-auto flex w-full max-w-3xl flex-wrap items-center gap-2 rounded-2xl border bg-background/95 p-2 pl-3 shadow-elev-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <span className="text-sm font-medium tabular-nums">{count} selected</span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={onClear}
            disabled={pending}
            aria-label="Clear selection"
          >
            <X className="size-4" />
          </Button>
          {children}
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            {actions.map((a) => (
              <Button
                key={a.key}
                size="sm"
                variant={a.destructive ? "outline" : "outline"}
                className={a.destructive ? "text-destructive hover:text-destructive" : ""}
                disabled={pending}
                onClick={() => (a.confirm ? setConfirming(a) : onRun(a.key))}
              >
                {a.icon && <a.icon className="size-4" />}
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <AlertDialog open={!!confirming} onOpenChange={(o) => !o && setConfirming(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirming?.confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirming?.confirm?.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                confirming?.destructive ? "bg-destructive text-white hover:bg-destructive/90" : ""
              }
              onClick={(e) => {
                e.preventDefault();
                const key = confirming?.key;
                setConfirming(null);
                if (key) onRun(key);
              }}
            >
              {confirming?.confirm?.actionLabel ?? "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
