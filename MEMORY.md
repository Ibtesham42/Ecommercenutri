# Nutriyet — Working Memory

Fast-loading project context for contributors and AI agents. This is **state and
decisions only** — see `CLAUDE.md` for the full guide, `PROGRESS.md` for the tracker,
`CHANGELOG.md` for history. Do not duplicate those here.

## Current milestone
**Feature-complete (M0–M6) + Admin RBAC + CMS Phase 1.** All milestones done plus
sub-admin RBAC and the **Homepage Hero Slider Manager** (first WordPress-style CMS phase).
Plus **CMS Phase 2 (product-page UX redesign)**. Build/typecheck/lint green (50 routes);
DB live + migrated (`admin_rbac`, `hero_slides`); Groq + Cloudinary configured. **Active CMS
roadmap** (one phase per turn): ✅1 hero slider · ✅2 product-page UX · 3 appearance/settings ·
4 section builder · 5 banners · 6 navigation · 7 footer · 8 media library · 9 content.
Remaining ops: deploy per `DEPLOYMENT.md`.

## Architecture decisions that bite if forgotten
- **Money = integer paise** everywhere. UI collects rupees and converts at the edge
  (`rupeesToPaise`/`paiseToRupees`). Server schemas validate paise.
- **Server is authoritative** for price/stock/role. The client cart (Zustand +
  localStorage) is re-priced in `lib/orders.ts#priceCart` at checkout.
- **Stock** is decremented on the **PAID** transition; admin cancel/refund of a paid
  order restocks once (open→closed guard prevents double restock).
- **Keyless fallbacks** via `lib/env.ts#isConfigured` — the app must run with blank
  keys (mock checkout, console emails, "AI not configured", URL-based admin images).
- **`lib/auth.config.ts` must stay edge-safe** (no Prisma/bcrypt) — it runs in
  middleware. Admin actions call `requireAdmin()`; admin routes are guarded by both
  middleware and the `/admin` layout.
- **Admin forms** = RHF client components → admin server actions returning `AdminResult`.
  Product edits keep variant/image ids so active carts survive.
- **AI lives in `lib/ai/*`** behind seams: provider registry (`provider.ts`) and
  retrieval (`retrieval.ts` → `ContextChunk[]`, swap for vectors later). Keep logic out
  of routes (`chat.ts`/`search.ts`). Chat streams plain text via `toTextStreamResponse`.
- **Groq `llama-3.3-70b-versatile` has no `json_schema` support** → use
  `generateText` + JSON parse, never `generateObject`, for structured AI output.
- AI must **degrade gracefully** with no key (friendly `X-AI-Fallback` message);
  recommendations are DB-driven so they never need a key.
- **Image uploads are signed + server-side** (`lib/actions/admin/upload.ts` →
  `lib/cloudinary.ts`); `ImageUploadField` falls back to a pasted URL when Cloudinary
  is unconfigured. Optimize delivery with `cldUrl()` (`lib/cld.ts`); story media uses
  plain `<img>` (arbitrary hosts) so it bypasses `next/image` remotePatterns.
- **CMS is permission-gated + additive**: all CMS admin features use the `appearance`
  permission. Storefront CMS elements (e.g. the hero slider after Stories) render **only
  when data exists**, so the homepage degrades to its current form otherwise. Reordering
  uses native HTML5 DnD + a `reorder(ids[])` server action (no DnD library). Reuse
  `HeroSlideContent` from `hero-slider.tsx` for the admin live preview.
- **SEO/PWA/icons are file-convention + generated**: `app/sitemap.ts`, `robots.ts`,
  `manifest.ts`, and `next/og` `icon.tsx`/`apple-icon.tsx`/`opengraph-image.tsx` (no
  binary assets). Structured-data helpers in `lib/seo.ts`. Service worker
  (`public/sw.js`) is conservative + prod-only; never caches api/admin/account/checkout.
- **Rate limiting fails open** (`lib/rate-limit.ts`); `/api/ai/chat` uses `limiters.ai`.
  Analytics is pluggable/no-op. Both run only when their env keys are set.

## Pending integrations (all optional; fallbacks active)
- **Groq** (`GROQ_API_KEY`) — a live key is set; AI is fully working. Toggles +
  model/temperature/prompt editable at `/admin/ai-settings` (`AISetting`).
- **Cloudinary** (`CLOUDINARY_*`) — needed for M5 real uploads (admin images are
  URL-based today). `lib/cloudinary.ts` ready.
- **Razorpay / Resend / Google / Upstash** — see `PROGRESS.md` table.

## Known issues / constraints
- **Node 21.1.0 (EOL)** pins Prisma 6. Move to Node 20/22 LTS before Prisma 7.
- **Neon scale-to-zero**: first DB hit after idle throws `P1001` (cold start) — retry once.
- Admin **image management is URL-based** until Cloudinary upload lands in M5.
- `/api/ai/chat` is **not yet rate-limited** — add Upstash limiting before public launch.

## Future roadmap
M4 AI (assistant/search/recommendations/product chat) → M5 stories viewer +
Cloudinary uploads + image optimization → M6 SEO + PWA + analytics + notifications +
Vercel production deploy.
