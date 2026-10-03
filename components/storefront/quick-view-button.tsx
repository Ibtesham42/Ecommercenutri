"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Lazy-loaded: the modal (Dialog primitives, StarRating, cart store wiring)
// only enters the bundle when a shopper actually opens Quick View, keeping
// every product card's base weight unchanged.
const QuickViewDialog = dynamic(
  () => import("@/components/storefront/quick-view-dialog").then((m) => m.QuickViewDialog),
  { ssr: false },
);

export function QuickViewButton({
  productId,
  productName,
  wishlisted,
  className,
}: {
  productId: string;
  productName: string;
  wishlisted?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="icon"
        variant="secondary"
        aria-label={`Quick view ${productName}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "size-8 rounded-full border bg-card/95 shadow-elev-1 backdrop-blur hover:bg-card",
          className,
        )}
      >
        <Eye className="size-4" />
      </Button>
      {open && (
        <QuickViewDialog
          productId={productId}
          wishlisted={wishlisted}
          open={open}
          onOpenChange={setOpen}
        />
      )}
    </>
  );
}
