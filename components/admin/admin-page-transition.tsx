"use client";

import { usePathname } from "next/navigation";

/**
 * Fades admin page content in on each navigation. Keying on the pathname remounts
 * the wrapper so the CSS `animate-fade-up` (reduced-motion gated in globals.css)
 * re-triggers per route. Purely presentational — no effect on data or behavior.
 */
export function AdminPageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="animate-fade-up">
      {children}
    </div>
  );
}
