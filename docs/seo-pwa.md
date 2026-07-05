# SEO, Favicon, PWA / Service Worker, Media & Uploads

> Part of the [Nutriyet docs](../CLAUDE.md#documentation-index). The short "do not
> regress" versions of the invariants here also appear in `CLAUDE.md`.

## SEO & Social Share Manager

- `/admin/seo` (`appearance` permission) — admin CMS for all site-wide SEO/social
  metadata; **extends** the existing pipeline. Extended config lives in the single
  additive **`StoreSetting.seo` JSON blob** (no per-field migrations); core fields
  (siteName/metaTitle/metaDescription/ogImage/favicon/primary socials) stay in their own
  columns and remain editable from Appearance too.
- **`lib/seo-settings.ts#getSeoSettings()`** is the single resolver — folds columns +
  blob over `config/site.ts` defaults into a fully-resolved `SeoSettings` used by both
  the root `generateMetadata`/`generateViewport` (title, description, keywords,
  canonical, OG type/locale/image, Twitter card, `verification`
  google/bing/pinterest/yandex, `fb:app_id`, theme color, robots index) **and** the admin
  live previews.
- Analytics (GA4/GTM/Meta Pixel) inject via `components/seo-scripts.tsx`
  (`SeoScripts`/`SeoNoscript`, each self-gates on its ID, additive to the env-gated
  Plausible `<Analytics/>`).
- Save (`lib/actions/admin/seo.ts#updateSeoSettings`) writes columns + blob then
  `revalidatePath("/", "layout")` — metadata refreshes **without a redeploy**.
- UI (`components/admin/seo-manager.tsx` + `components/admin/seo/*`): tabbed editor
  (Global / Social / Search & Analytics / Links), **live multi-platform preview**
  (Google Search + Discover, WhatsApp, Facebook, LinkedIn, X, Telegram, Discord,
  Instagram DM, Gmail — `social-previews.tsx`), soft validation warnings,
  unsaved-changes guard, Reset-to-defaults, and a **URL Tester** (`fetchUrlPreview`
  server action, SSRF-guarded to the site origin). Schema:
  `lib/validations/seo.ts`; client-safe preview types: `lib/seo-preview.ts`.
- **OG image** is generated at the edge via `next/og` (`app/opengraph-image.tsx`);
  `siteConfig.ogImage` points at `/opengraph-image`.
- Organization/WebSite/Breadcrumb/Product/Article JSON-LD via `lib/seo.ts`. Dynamic
  DB-driven `sitemap.ts` + `robots.ts`.

## Favicon system — metadata-driven, NOT file-convention

App-Router file conventions (`app/favicon.ico`/`icon.tsx`/`apple-icon.tsx`) override
`metadata.icons`, so an admin-uploaded favicon never showed. They were removed:

- The brand default is generated at `app/brand-icon/route.tsx` +
  `app/brand-apple-icon/route.tsx` (`next/og`); root `generateMetadata().icons` points at
  `StoreSetting.favicon` (normalized through `cldFavicon` → real square PNG at
  48/96/192/180 for `icon`/`shortcut`/`apple`) or the brand routes. The versioned
  Cloudinary URL cache-busts the tab. **Don't re-add `app/favicon.ico`/`app/icon.*`.**
- **Classic `/favicon.ico` path is served dynamically** (browsers/bookmarks/Google fetch
  it directly, independent of the `<link>` tags). `next.config.ts` `rewrites()`
  (`beforeFiles`) maps `/favicon.ico` → `app/api/favicon/route.ts`, which proxies the
  bytes of `cldFavicon(favicon,48)` (fallback `/brand-icon`), `force-dynamic`. Serve via
  the rewrite+route, **never** an `app/favicon.ico` file.
- **PWA/Android install icon:** `app/manifest.ts` is `async` + `force-dynamic`; its
  `icons` come from `StoreSetting.favicon` via `cldFavicon` (32/180/192/512, brand-route
  fallback). Tab, classic path, apple-touch and installed-app icon all track the admin
  favicon with no build-time bake.

## Service worker — intentionally conservative (`public/sw.js`)

- Network-first for navigations with an `/offline` fallback, cache-first for static
  assets; **never** intercepts `/api`, `/admin`, `/account`, `/checkout`, or auth.
  Registered in **production only** (`components/service-worker-register.tsx`, which also
  calls `registration.update()`).
- **Critical invariant (`isCacheable`):** the SW must **only ever cache or serve a clean
  same-origin 200** (`response.ok && type === "basic" && !redirected`); redirects/opaque/
  non-OK responses pass straight through, never cached. Reason: an alias host (`www`)
  that 307-redirects to the apex must be allowed to redirect — a prior version cached the
  cross-origin `opaqueredirect`, which **blanked `www.nutriyet.in`** on browsers with the
  SW installed on that origin (SW + Cache are per-origin and survive redeploys). Bump
  `VERSION` when changing SW behavior so `activate` purges old caches. Don't reintroduce
  unconditional `cache.put`.
- PWA install prompt config lives in the `StoreSetting.pwa` blob (`lib/pwa-settings.ts`).
  Push handlers in the SW are additive (see `docs/marketing.md` +
  [guides/push-notifications.md](guides/push-notifications.md)).

## Cloudinary media & uploads

- **Uploads are signed + go DIRECT from the browser** (`ImageUploadField` →
  `POST /api/admin/upload-signature` → `https://api.cloudinary.com/v1_1/<cloud>/auto/upload`).
  The admin-gated signature route (`lib/cloudinary.ts#signUpload`, signs folder +
  timestamp only) returns a short-lived signature; file bytes never pass through the
  serverless function. Required because Vercel caps a function body at ~4.5 MB — routing
  media (especially videos) through the app made real videos fail. Images are downscaled
  client-side (`prepareBlob`) before upload; videos go untouched (client cap 100 MB =
  Cloudinary free-plan limit). `ImageUploadField` always accepts a pasted URL (keyless
  fallback).
- The older server-buffered route (`app/api/admin/upload/route.ts` → `uploadImage`,
  base64 data URI) is used only by `showcase-image-field.tsx` (small cutout images).
- Delivery: `cldUrl()`/`cldVideo()` from `lib/cld.ts` (`f_auto,q_auto`; no-op for
  non-Cloudinary URLs). `cldUrl` supports `gravity` (`g_auto`) and `dpr` (`dpr_auto`) on
  top of `w,h,c_fill|fit` — used for responsive, non-stretching banner crops.
  Video variants via `lib/video.ts` (see `docs/cms.md` → Hero video pipeline).
- Asset destruction: `lib/cloudinary.ts#destroyAssetByUrl` (original + derived + CDN
  invalidation), scoped to the `nutriyet/` namespace.
