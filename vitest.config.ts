import { defineConfig } from "vitest/config";
import path from "path";

// Minimal config for isolated unit tests (lib/**/*.test.ts). No DB, no
// network, no Next.js runtime — Prisma and other side-effecting modules are
// mocked per-test. Added for Batch 1 of the production-safety audit; not
// wired into any existing build/lint/CI step.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  // Pure Node unit tests never import CSS — but Vite still probes the project
  // root for a postcss config during startup unless given an explicit one, and
  // this app's postcss.config.mjs (Tailwind v4's plugin-array format) isn't a
  // shape Vite's own PostCSS loader understands. Short-circuit the lookup.
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
