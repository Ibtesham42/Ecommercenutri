import type { Metadata } from "next";
import { NotFoundContent } from "@/components/storefront/not-found-content";

export const metadata: Metadata = { title: "Page not found" };

/** Missing product/category/post etc. — rendered inside the storefront header + footer. */
export default function StorefrontNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <NotFoundContent />
    </div>
  );
}
