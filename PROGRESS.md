# Nutriyet — Progress Tracker

_Last updated: 2026-06-25 · Auto-maintained. Update at the end of every milestone._

## Snapshot

| Item                | Status                                                          |
| ------------------- | -------------------------------------------------------------- |
| Build               | ✅ passing (`next build`, 51 routes)                            |
| TypeScript          | ✅ `tsc --noEmit` clean                                         |
| ESLint              | ✅ clean                                                        |
| Runtime smoke       | ✅ Appearance verified (announcement/theme/WhatsApp/SEO reflect on storefront; appearance sub-admin scoped) |
| Database (Neon)     | ✅ live, migrated (…`hero_slides`, `appearance_settings`), seeded |
| Current milestone   | **M0–M6 + RBAC + CMS Phases 1–3 — production-ready**           |

## CMS roadmap (WordPress-style admin management; one phase per turn)
✅ **Phase 1 — Hero Slider Manager**: `HeroSlide` model + `/admin/hero` (drag-drop reorder,
duplicate, schedule, publish, live preview) + premium storefront slider after Stories.
Gated by `appearance` permission.
✅ **Phase 2 — Product page UX redesign + mobile**: redesigned `product-purchase.tsx`
(savings price block, nutrition highlight chips, larger variant pills + per-variant price,
44px quantity stepper, Buy-now-primary hierarchy, delivery estimate, free-shipping progress,
trust badges, **sticky mobile add-to-cart bar** via IntersectionObserver); polished reviews.
✅ **Phase 3 — Appearance & Website Settings**: extended `StoreSetting` (branding, theme
colors, announcement bar, contact + business hours + maps + WhatsApp, SEO defaults + favicon).
`/admin/appearance` manager (appearance permission). Storefront wired: announcement bar,
theme-color override, uploaded logo (header/footer), WhatsApp button, footer hours, root
`generateMetadata` SEO defaults.
⏳ Backlog: 4) Homepage Section Builder · 5) Banner Manager · 6) Navigation Builder ·
7) Footer Builder · 8) Media Library · 9) Content/popups/ads. (+ optional full mobile audit.)

## Latest: Admin RBAC (sub-admins, permissions, store settings)
Roles `SUPER_ADMIN`/`ADMIN` with per-section `User.permissions`; new `StoreSetting`.
`/admin/admins` (main admin) adds/manages sub-admins (permission checkboxes, photo,
phone, contact email, address); self email/password + editable store contact/socials in
`/admin/settings`. Enforced in middleware + `guardSection` (pages) +
`requirePermission`/`requireSuperAdmin` (actions), all DB-fresh; dashboard widgets scoped
to permissions. (Deploy still requires `DATABASE_URL` at runtime — see the build fix.)

## Milestones

| Milestone | Scope                                                | Status        |
| --------- | ---------------------------------------------------- | ------------- |
| M0        | Foundation                                           | ✅ Complete    |
| M1        | Storefront + Auth + Products + Account               | ✅ Complete    |
| M2        | Cart → Checkout → Razorpay → Orders                   | ✅ Complete    |
| M3        | Admin panel                                          | ✅ Complete    |
| M4        | AI (Groq): assistant, product chat, search, recs     | ✅ Complete    |
| M5        | Stories viewer, Cloudinary uploads, image optimization | ✅ Complete  |
| M6        | SEO, PWA, analytics, notifications, deploy            | ✅ Complete    |

## M6 deliverables (this session)
- **SEO**: `app/sitemap.ts` (static + products + categories), `app/robots.ts`,
  Organization + WebSite (SearchAction) JSON-LD in root layout, BreadcrumbList on
  product + category pages (`lib/seo.ts` helpers).
- **Images**: generated `app/icon.tsx`, `app/apple-icon.tsx`, `app/opengraph-image.tsx`
  via `next/og`; `siteConfig.ogImage` → `/opengraph-image`.
- **PWA**: `app/manifest.ts`, `public/sw.js` (conservative network-first SW),
  `components/service-worker-register.tsx` (prod only), `app/offline/page.tsx`.
- **Analytics**: `components/analytics.tsx` (pluggable, no-op fallback) + env wiring.
- **Notifications**: `orderStatusEmail` (shipped/delivered/cancelled/refunded) sent
  from the admin `updateOrderStatus` action (best-effort, reuses Resend infra).
- **Hardening**: `/api/ai/chat` rate-limited via `limiters.ai` (Upstash, fail-open).
- **Docs**: `DEPLOYMENT.md` (Vercel + Neon + integrations + hardening checklist).

## Integrations (all optional; fallbacks active)
| Integration | Status in this env | Effect if blank                  |
| ----------- | ------------------ | -------------------------------- |
| Database (Neon) | ✅ live          | required                         |
| Groq        | ✅ configured       | AI shows friendly fallback       |
| Cloudinary  | ✅ configured       | admin images become URL-paste    |
| Razorpay    | set as needed       | checkout uses mock-success flow  |
| Resend      | set as needed       | emails logged to console         |
| Google OAuth| set as needed       | only credentials login shown     |
| Upstash     | set as needed       | cache + rate-limit are no-ops    |
| Analytics   | optional            | no script injected               |

## Risks / notes
- **Node 21.1.0 (EOL)** pins Prisma to 6. Use Node 20/22 LTS in production, then
  optionally bump Prisma 7.
- Neon **cold start** (`P1001`) on first connect after idle — retry once.
- Service worker interactivity (install/offline) is client-only — verify visually.
- Local smoke shows `localhost:3000` in sitemap/OG; production derives URLs from
  `NEXT_PUBLIC_APP_URL` — set it to the real domain on deploy.

## Next (operational, post-feature-complete)
Deploy to Vercel per `DEPLOYMENT.md`. Future iterations: real RAG (vector retrieval
behind the existing `lib/ai/retrieval.ts` seam), richer analytics/funnels, A/B tests,
more transactional notifications.
