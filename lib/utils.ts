import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Only allow same-origin, absolute internal paths for post-auth redirects.
 * Blocks open redirects: external URLs, protocol-relative (`//evil.com`),
 * backslash tricks (`/\evil.com`) and control characters — URL parsers strip
 * tab/CR/LF, so "/<TAB>/evil.com" would otherwise become `//evil.com`. The
 * resolved-origin check is the backstop. Returns `fallback` for anything else.
 */
export function safeRedirectPath(
  url: string | null | undefined,
  fallback = "/account",
): string {
  if (typeof url !== "string" || !/^\/(?![/\\])/.test(url)) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(url)) return fallback;
  try {
    const probe = "http://same-origin.invalid";
    if (new URL(url, probe).origin !== probe) return fallback;
  } catch {
    return fallback;
  }
  return url;
}
