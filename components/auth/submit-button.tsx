"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending}
      className={cn(
        "w-full",
        // Mobile-only premium treatment: 48px target, softer radius, gentle
        // press-down. Desktop (sm+) keeps the stock button exactly.
        "max-sm:h-12 max-sm:rounded-xl max-sm:text-base max-sm:font-semibold max-sm:shadow-elev-1 max-sm:transition-transform max-sm:active:scale-[0.98]",
        className,
      )}
    >
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  );
}
