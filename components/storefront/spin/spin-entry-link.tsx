"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackClient } from "@/components/storefront/behavior-tracker";

export function SpinEntryLink({ source }: { source: string }) {
  return (
    <Button asChild className="h-11 shrink-0 rounded-lg px-5 text-[15px]">
      <Link href="/spin" onClick={() => trackClient({ type: "SPIN_ENTRY", source })}>
        Spin &amp; Win <ArrowRight className="size-4" aria-hidden />
      </Link>
    </Button>
  );
}
