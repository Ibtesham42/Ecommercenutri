import Link from "next/link";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2 font-heading text-xl font-extrabold tracking-tight",
        className,
      )}
    >
      <span className="grid size-8 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <Leaf className="size-5" />
      </span>
      <span>
        Nutri<span className="text-primary">yet</span>
      </span>
    </Link>
  );
}
