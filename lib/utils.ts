import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Only allow same-origin, absolute internal paths for post-auth redirects.
 * Blocks open redirects: external URLs, protocol-relative (`//evil.com`) and
 * backslash tricks (`/\evil.com`). Returns `fallback` for anything else.
 */
export function safeRedirectPath(
  url: string | null | undefined,
  fallback = "/account",
): string {
  if (typeof url === "string" && /^\/(?![/\\])/.test(url)) return url;
  return fallback;
}
