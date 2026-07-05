# CMS — Hero Slider, Banners, Homepage, 3D Showcase, Content Pages, Stories

> Part of the [Nutriyet docs](../CLAUDE.md#documentation-index). All admin CMS is gated
> by the **`appearance`** permission (super admins always pass).

## Conventions

Reuse RBAC (`requirePermission("appearance")` / `guardSection`), `AdminResult` actions,
Zod schemas in `lib/validations/admin.ts`, `ImageUploadField` + Cloudinary, `cldUrl` for
delivery. Reordering uses native HTML5 DnD + a `reorder(ids[])` action (no DnD library).
Singletons extend `StoreSetting`; lists are new additive models. Storefront CMS
components **render nothing when empty/disabled** (fully additive).

**Backlog (one phase per turn):** Navigation Builder (`MenuItem`); Footer Builder; Media
Library (`MediaAsset` + Cloudinary); popups/ads. SEO Phase 2: per-page/product/blog SEO
overrides, per-section share images, schema toggles, editable robots/sitemap.

## Hero Slider

- `HeroSlide` model; admin `/admin/hero` with drag-reorder, duplicate, schedule, publish
  toggle, live preview (`components/admin/hero-slider-manager.tsx`,
  `lib/actions/admin/hero.ts`, `lib/queries/home.ts`). Storefront
  `components/storefront/hero-slider.tsx` renders right after Stories **only when active
  slides exist**.
- **Video pipeline** — all video delivery goes through **`lib/video.ts`** (client-safe;
  HLS/DASH/watermark seams documented there). `cldVideoVariant` = H.264 MP4, `c_limit`
  (**never upscales/server-crops** — CSS `object-cover` frames it; the old
  `w_1920,c_fill` upscale was the "blurry hero video" bug), adaptive 1080/720/480 rung
  picked client-side from viewport + network (Save-Data/2g/3g step down) in
  `banner-video.tsx`. Per-slide **quality profile** (`HeroSlide.videoQuality`:
  max/balanced/eco → `q_auto:best/good/eco`), **poster** (auto first frame, picked
  thumbnail frame, or custom upload) and **`videoMeta`** (Json: resolution/duration/size/
  codec/fps/bitrate captured from the direct Cloudinary upload response via
  `ImageUploadField`'s `onUploadInfo` + XHR progress %).
- **Deleting/replacing slide media destroys the Cloudinary assets** (original + derived +
  CDN-invalidated) via `lib/cloudinary.ts#destroyAssetByUrl` — guarded so an asset shared
  by a duplicated slide is kept, and scoped to the `nutriyet/` namespace only.

## Product Reveal Animation (hero overlay)

Optional premium packet-pour animation overlaid on the hero slider (packet fades in →
jagged rip-strip tears off → packet tilts → makhana pieces fall/bounce/roll to rest via a
tiny semi-implicit Euler integrator → hold → fade → loop).

- Config in the additive **`StoreSetting.heroReveal` JSON blob** (migration `hero_reveal`;
  `lib/hero-reveal.ts` resolver — client-safe, `heroRevealLive` = enabled + packet image
  set) with every timeline/physics constant in `lib/hero-reveal-config.ts` (one tunable
  sheet: TIMELINE, PHYSICS, clip-path tear geometry, built-in SVG makhana sprite,
  responsive STAGE presets).
- Storefront `components/storefront/hero-reveal/*`: the shell (`hero-reveal-overlay.tsx`,
  statically imported by the homepage) is `aria-hidden` + `pointer-events-none` +
  `contain:strict` so it never shifts layout or blocks slider swipe/arrows/CTAs; the rAF
  engine (`reveal-engine.tsx` + `physics.ts`) is a **lazy chunk** (`next/dynamic
  ssr:false`, armed on first in-view via the shared showcase `useInView`, paused
  off-screen/tab-hidden, per-frame writes to refs only). Reduced-motion users get a
  static opened packet (engine chunk never loads); an ErrorBoundary→null keeps the hero
  from ever blanking.
- Homepage (`page.tsx`) wraps the slider in a `relative` div ONLY when live — disabled =
  markup byte-identical; the overlay auto-picks the side away from right-aligned slide
  copy (small top-corner stage on mobile, bottom corner md+).
- Admin card on `/admin/hero` (`components/admin/hero-reveal-card.tsx`,
  `updateHeroReveal` in `lib/actions/admin/hero.ts`): enable toggle (Zod blocks enabling
  without a packet image), packet/piece `ImageUploadField`s (folder `hero-reveal`;
  replaced images destroyed on Cloudinary), speed/delay/piece-count ranges, live preview
  Dialog rendering the real overlay with the `preview` prop (forces armed/active).

## Banner Manager

- `Banner` model + named-placement registry (`lib/banners.ts`: `homeTop`/`productsTop`/
  `categoryTop`); admin `/admin/banners` (create/edit, desktop+mobile images, link to
  product/category/URL, priority, schedule, publish, duplicate, delete).
- Storefront `<BannerStrip position>` (`components/storefront/banner-strip.tsx`, reads
  `lib/queries/banners.ts#getBanners`) renders active in-schedule banners by priority and
  renders nothing when empty. **New placement = add a key to `BANNER_POSITIONS` + drop a
  `<BannerStrip position>` in.**
- Banners support optional dark-mode images (`desktopImageDark`/`mobileImageDark`, light
  fallback), smart focal-point mobile crops (`cldUrl` `gravity:"auto"`/`dpr:"auto"`) and a
  responsive `<picture>` via shared `banner-card.tsx`; the admin form has a live
  theme/viewport preview.

## Homepage Section editor

- Every content section is editable, not just order/visibility. `HomeSection.content`
  (JSON) overrides typed defaults in `lib/home-content.ts`;
  `getHomeSectionsContent()` merges them. The editable sections (hero, aiBanner, catalog
  headings, whyChooseUs, testimonials) render from shared
  `components/storefront/home/*` components reused by the admin live preview
  (`components/admin/home-section-editor.tsx`). Edit/save/reset via
  `saveHomeSectionContent`/`resetHomeSectionContent`; homepage is identical until edited.
- stories/heroSlider keep their dedicated managers (editor kind `none`). Behavioral
  **`trending`** and **`combos`** (Shop by Goal) sections are registry-driven too.
- **Add a section:** add a key to `HOME_SECTIONS` + a content default + a keyed node in
  `app/(storefront)/page.tsx`.

## 3D Showcase

- Premium Apple/Tesla-style WebGL hero showcase at the top of the homepage —
  `@react-three/fiber` + `drei` + `@react-three/postprocessing` (procedural Lightformer
  environment — no external HDRI; MeshReflectorMaterial mirror floor; PBR/clearcoat
  product plane; contact shadow; idle float + cursor/gyro parallax + camera drift; subtle
  bloom/DoF/vignette; crossfade between products). Fully reduced-motion gated.
- **The whole WebGL stage is lazy** (`next/dynamic` `ssr:false`, mounts only once scrolled
  into view) so it never blocks first paint and shared First-Load JS stays ~103 kB; the
  render loop pauses off-screen/tab-hidden (IntersectionObserver + `frameloop`), is
  **perf-tiered** (mobile/low-power drops DoF/shadows/resolutions — lightweight heuristic,
  no `detect-gpu`), disposes textures on swap/unmount, survives WebGL context loss (error
  boundary → flat fallback image).
- Engine: `components/storefront/showcase-3d.tsx` (SSR chrome + lazy boundary) +
  `components/storefront/showcase/*`. **Catalog** of presets/flags in `lib/showcase.ts`
  (10 animations, 5 backgrounds, motion flags, 0-100 knobs); **all numeric look/motion
  constants** in `lib/showcase-config.ts` (one tunable place).
- Admin `/admin/showcase`: global enable (`StoreSetting.showcase3dEnabled`) + unlimited
  `ShowcaseItem` rows. **Admin uploads ONE image**:
  `components/admin/showcase-image-field.tsx` + `lib/showcase-image.ts` EXIF-correct it,
  remove the background **in-browser** (`@imgly/background-removal`, lazy WASM; needs the
  `onnxruntime-web` peer dep), alpha-bbox auto-frame, and upload BOTH the original
  (→ `image`) and the cutout (→ `imagePng`); the stage prefers the cutout.
  Low-confidence removal falls back to the original (toggle + URL-paste keyless fallback).
  Featured-product link, animation/background, rotation/float/zoom sliders, drag-reorder,
  duplicate, publish toggle, live WebGL preview (reuses the storefront component).
- Storefront reads `getActiveShowcase()`; renders nothing unless enabled with published
  items.

## Content pages & editors

- `/blog` + `/blog/[slug]` — `BlogPost` model, `lib/queries/blog.ts`; published posts
  (sanitized HTML), empty-state friendly, Article + Breadcrumb JSON-LD.
  **Admin** `/admin/blog` (`blog-manager.tsx`, `lib/actions/admin/blog.ts`): CRUD
  (title/auto-slug, excerpt, HTML content, cover, author, tag, publish toggle + date) with
  `<BulkBar>`; content `sanitizeRichText`-sanitized on save; saves revalidate blog +
  sitemap.
- `/shipping`, `/privacy`, `/terms` — `ContentPage` model overrides the professional
  defaults in `lib/legal-content.ts` (shared `LegalPageView`); works with zero rows.
  **Admin** `/admin/legal` (`legal-manager.tsx`, `lib/actions/admin/content.ts`):
  per-page editor — `saveContentPage` upserts a sanitized override; `resetContentPage`
  deletes it (falls back to default). Pre-fills from `legalDefaultHtml`, shows
  Custom/Default status.
- `/contact` — `ContactMessage` model; `submitContactMessage` (Zod + rate-limit + persist
  + best-effort email); business info, FAQ, map. **Admin inbox** `/admin/messages`
  (reply + status + delete + bulk).
- `/track` — public guest order tracking: `trackOrder(orderNumber, email)` matches the
  checkout email, returns a trimmed DTO + status timeline (no auth).
- `/support` — help hub. Footer "Track Order" points at `/track`.

## Stories

- Instagram-style **stories viewer** (`components/storefront/stories-viewer.tsx`):
  full-screen overlay, segmented progress, images auto-advance via rAF (5 s), videos via
  `ended`, tap/keyboard nav, product CTA, view tracking (best-effort,
  `lib/actions/stories.ts`).
- Story media can be any host, so the viewer/rail use plain `<img>` (not `next/image`)
  to avoid `remotePatterns`.
- Admin manager at `/admin/stories` (`stories` permission) with bulk publish/unpublish/
  delete.
