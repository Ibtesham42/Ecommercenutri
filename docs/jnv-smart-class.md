# JNV Smart Class Portal

An isolated education mini-platform living inside the same Next.js app as the
Nutriyet storefront, but functionally and visually unrelated to it. Built for
Jawahar Navodaya Vidyalaya Smart Classes, teaching Classes 6–10.

## Isolation model

- **No public discovery.** `/jnv` has no link from the storefront nav, header,
  footer, homepage, search, or `app/sitemap.ts`. Every `/jnv*` page sets
  `robots: { index: false, follow: false, nocache: true }`. Reachable only by
  a shared direct URL (`https://nutriyet.in/jnv`).
- **No shared UI.** `app/jnv/` is a sibling of `(storefront)`/`(account)`/
  `admin` under `app/`, so it never inherits the storefront header/footer.
  `app/jnv/layout.tsx` renders its own header/footer and overrides
  `title`/`openGraph`/`twitter`/`icons` so the browser tab, share cards and
  favicon never show the Nutriyet identity. (The root layout's
  organization/website JSON-LD and `<link rel="canonical">` still point at
  nutriyet.in — that's invisible structured data, not user-facing branding,
  and `noindex` keeps crawlers from surfacing it; left as-is rather than
  forking the root layout.)
- **Own theme.** Plain Tailwind blue/emerald utility classes throughout
  (`bg-blue-600`, `text-emerald-*`, `dark:` variants) — deliberately not
  wired into the storefront's `--primary`/`--gold` oklch tokens in
  `globals.css`, so the two design systems can't leak into each other.
- **Own auth model.** The admin side (`/admin/jnv`) reuses the existing
  RBAC/session infrastructure (`requirePermission("jnv")` /
  `guardSection("jnv")`) — teachers are admins or sub-admins with the `jnv`
  permission. The student side has **no login at all**; access control is
  URL obscurity only, matching the brief. Favorites and "Continue Learning"
  are therefore per-device, stored in `localStorage`
  (`lib/jnv/local-store.ts`), not in the DB.
- **No shared writes.** Nothing in this module touches `Product`, `Order`,
  `User` (except a nullable `createdById`/`uploadedById` attribution FK),
  `Cart`, or any commerce/marketing table.

## Data model (`prisma/schema.prisma`, migration `jnv_smart_class`)

- `JnvFolder` — self-relation (`parentId`) for unlimited nesting.
  `classLevel` (6–10) is denormalized onto **every** node (not just roots) so
  folder/resource queries never need to walk the tree to filter by class.
- `JnvResource` — one uploaded file. `fileKind` (`PDF`/`PPT`/`DOC`/`XLS`/
  `IMAGE`/`AUDIO`/`VIDEO`/`ZIP`/`OTHER`) is detected client-side from the
  filename/MIME at upload time (`lib/jnv/catalog.ts#detectJnvFileKind`).
  Assignments are `JnvResource` rows with `isAssignment: true` + `dueAt`
  rather than a separate model.
- `JnvAnnouncement` — `classLevel: null` = school-wide; pinnable.

## Backend

- `lib/actions/admin/jnv.ts` — folder CRUD/move/reorder, resource CRUD +
  bulk delete, announcement CRUD. Every export starts
  `requirePermission("jnv")`, returns `AdminResult<T>`, revalidates
  `/admin/jnv` and `/jnv` (layout). Deletes destroy the Cloudinary asset
  best-effort (`destroyAssetByUrl`) after the DB row is gone.
- `lib/actions/jnv-public.ts` — the **only** public write path:
  `recordJnvDownload(id)`, a fire-and-forget download-count bump, rate-limited
  per IP (`lib/rate-limit.ts`, fail-open) and never throws.
- `lib/queries/jnv.ts` — all reads (folders, breadcrumbs, resources, class
  summaries, search, dashboard stats, announcements), shared by both the
  admin pages and the student portal so they can never drift. Wrapped in a
  one-shot retry for Neon cold-start `P1001`.
- Uploads reuse the existing admin-gated signed-upload pipeline
  (`app/api/admin/upload-signature`, `lib/cloudinary.ts#signUpload`) — files
  go browser → Cloudinary directly, never through a serverless function.
  `components/admin/jnv/jnv-file-field.tsx` wraps
  `uploadToCloudinary` from `image-upload-field.tsx` for arbitrary
  educational file types (not just images/video).

## Student portal routes

| Route | Purpose |
| --- | --- |
| `/jnv` | Class picker (5 cards) + school-wide pinned announcements + Favorites/Continue Learning |
| `/jnv/class/[level]` | Root subject folders for one class + class announcements |
| `/jnv/class/[level]/folder/[folderId]` | Breadcrumbs, subfolders, resources |
| `/jnv/resource/[id]` | Viewer: embedded PDF (`<iframe>`), Office docs (Office Online embed), image (`cldUrl` high-res), video/audio (native players); Download/Open/Fullscreen/Print/Share/Favorite |
| `/jnv/search` | Class + subject/type + keyword search across all resources |

## Known follow-ups

- `moveJnvFolder` / `reorderJnvFolders` actions exist but aren't wired to a
  drag-and-drop UI yet — folders can currently only be created flat under the
  folder you're viewing.
- The upload dialog has only been verified via a DB-level round-trip script,
  not a live authenticated browser upload through Cloudinary.
