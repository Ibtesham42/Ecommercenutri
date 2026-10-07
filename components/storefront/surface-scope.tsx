"use client";

import { useEffect } from "react";

/**
 * Mirrors the storefront design scope (`data-surface="shop"`, see globals.css)
 * onto <html>. The layout wrapper already carries the attribute for first
 * paint, but Radix dialogs/sheets/popovers portal into <body> — outside that
 * wrapper — so without this they'd render in the admin/root palette. Removed on
 * unmount, so client navigation to account/auth/admin drops back to root tokens.
 */
export function SurfaceScope() {
  useEffect(() => {
    const html = document.documentElement;
    html.dataset.surface = "shop";
    return () => {
      delete html.dataset.surface;
    };
  }, []);
  return null;
}
