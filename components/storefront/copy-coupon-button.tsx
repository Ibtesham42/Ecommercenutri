"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyCouponButton({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard?.writeText(code).then(
      () => {
        setCopied(true);
        toast.success(`Copied ${code}`);
        setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error("Couldn't copy — please note the code."),
    );
  }

  return (
    <Button size="sm" variant="outline" onClick={copy} className={cn("shrink-0 gap-1.5", className)}>
      {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
      {copied ? "Copied" : "Copy code"}
    </Button>
  );
}
