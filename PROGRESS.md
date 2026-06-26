# Nutriyet — Progress Tracker

_Last updated: 2026-06-25 · Auto-maintained. Update at the end of every milestone._

## Snapshot

| Item                | Status                                                          |
| ------------------- | -------------------------------------------------------------- |
| Build               | ✅ passing (`next build`, 52 routes)                            |
| TypeScript          | ✅ `tsc --noEmit` clean                                         |
| ESLint              | ✅ clean                                                        |
| Runtime smoke       | ✅ Favicon link normalized to an image (renders even from a stale `.pdf` asset); homepage identical by default after the section-content refactor; banner dark fields + brand-icon routes 200; admin guards 307 |
| Database (Neon)     | ✅ live, migrated (…`content_page`, `contact_message`, `banner` dark variants, `home_section.content`), seeded |
| Current milestone   | **M0–M6 + RBAC + CMS Phases 1–5 + content pages + CMS fixes — production-ready** |

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
`/admin/appearance` manager; storefront wired (announcement bar, theme override, logo,
WhatsApp, footer hours, root `generateMetadata` SEO).
✅ **Phase 4 — Homepage Section Builder**: `HomeSection` model + registry
(`lib/home-sections.ts`); homepage refactored to a keyed section map rendered in admin
order; `/admin/homepage` (drag-drop reorder + show/hide). Additive — identical until edited.
✅ **Phase 5 — Banner Manager**: `Banner` model + named placements registry
(`lib/banners.ts`: homeTop / productsTop / categoryTop); `/admin/banners` (create/edit,
desktop+mobile images, link to product/category/URL, priority, schedule, publish toggle,
duplicate, delete) gated by `appearance`; storefront `<BannerStrip position>` renders active
in-schedule banners by priority (server component, renders nothing when empty — fully additive).
✅ **Footer/nav content pages**: every footer + nav link now resolves (no 404s).
Added `/contact` (working form → `ContactMessage` + email), `/blog` + `/blog/[slug]`
(`BlogPost`, CMS-ready, 3 seeded posts), `/support` (help hub), `/track` (public guest
order tracking → existing Order system), and `/shipping` `/privacy` `/terms` (`ContentPage`
override + professional code defaults in `lib/legal-content.ts`). Footer "Track Order" →
`/track`; sitemap + SEO/JSON-LD updated. Admin editors for these land in a later CMS phase.
Sanitization moved to `lib/sanitize.ts` (`sanitize-html`; isomorphic-dompurify breaks the
Node-21 build).
✅ **CMS fixes/upgrades**:
- **Favicon**: removed the `app/favicon.ico`/`app/icon.tsx`/`app/apple-icon.tsx` file
  conventions (they overrode `metadata.icons`); brand defaults now at `/brand-icon` +
  `/brand-apple-icon`; root metadata drives icons from `StoreSetting.favicon`, normalized via
  `cldUrl` (f_auto) so any uploaded asset (incl. a stale `.pdf`) is delivered as an image and
  the versioned URL cache-busts. Favicon upload accepts `.png/.ico/.svg`.
- **Banner Manager**: `Banner` gains optional `desktopImageDark`/`mobileImageDark`; `cldUrl`
  gains `gravity`(g_auto smart crop)+`dpr`; storefront uses a shared `BannerCard` with a
  responsive `<picture>` (mobile/tablet/desktop, auto mobile crop, dark variants w/ light
  fallback); admin form adds dark uploads + a live theme/viewport preview.
- **Homepage Section editor**: `HomeSection.content` JSON + `lib/home-content.ts` defaults;
  the 8 content sections (hero, aiBanner, headings, why-choose-us, testimonials) are fully
  editable (text, buttons, colors, list items) with live preview, save and reset-to-default;
  homepage is pixel-identical until edited. stories/heroSlider keep their own managers.
⏳ Backlog: 6) Admin editors (blog/legal/contact-inbox) · 7) Navigation Builder ·
8) Footer Builder · 9) Media Library · 10) popups/ads. (+ optional full mobile audit.)

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
