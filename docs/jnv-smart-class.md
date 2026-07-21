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
| `/jnv/class/[level]` | Subject folders + subject-nav chips + "Recently added"/"Most downloaded" rails + class announcements |
| `/jnv/class/[level]/folder/[folderId]` | Breadcrumbs, subfolders, resources |
| `/jnv/resource/[id]` | Viewer: embedded PDF (`<iframe>`), Office docs (Office Online embed), image (zoom/pan), video (theatre mode + resume position); Next/Prev/Jump-to-chapter nav; Download/Open/Fullscreen/Print/Share/Favorite; "Ask Byte about this" |
| `/jnv/search` | Class + subject + type + keyword search across all resources |

Every route also has its own `loading.tsx` (route-shaped skeleton, not one
generic spinner) and the whole module shares a single `app/jnv/error.tsx`
boundary — an unhandled error anywhere under `/jnv` shows a JNV-branded
fallback with a "Try again" reset instead of leaking to a bare default error
page (there is no root-level `app/error.tsx` in this codebase, so before this
existed a JNV crash had no branded fallback at all).

## Classroom Presentation Mode

A client-side toggle (`components/jnv/presentation-provider.tsx`, persisted
per device) for teaching on a smart board/projector: hides header/footer
chrome, expands content to full width, and scales the whole module via root
`font-size` (`app/jnv/presentation.css`, `html.jnv-presentation`) so every
rem-based Tailwind utility grows together without per-component overrides.
Also includes a laser-pointer overlay, a "Dark Stage" toggle (forces the
real `.dark` class on `<html>` directly — not via next-themes' `setTheme()`
— so it never leaks into the site's actual theme preference), and keyboard
shortcuts (`F` fullscreen, `Esc` exit presentation). The resource viewer
adds its own Next/Prev/Jump-to-chapter keyboard nav (arrow keys) reusing the
same "don't fire while typing" guard (`isTypingTarget`, exported from
`presentation-provider.tsx`).

## Byte — the CS Teaching AI

A dedicated Computer Science teaching assistant for Classes 6–10, entirely
separate from the storefront's Nutri assistant: own persona/system prompt
(`lib/jnv/ai-prompts.ts`), own orchestration (`lib/jnv/ai-chat.ts`), own
route (`app/api/jnv/ai/chat/route.ts`) and rate limiter
(`limiters.jnvAi`). It reuses only the provider seam
(`lib/ai/provider.ts#getModel`/`aiAvailable`) — that's shared Groq
plumbing/infra, not branding, so isolation is preserved. The student-facing
chat (`components/jnv/jnv-ai-chat.tsx`, launched via
`components/jnv/jnv-ai-launcher.tsx`) behaves like a real messaging app: the
input is never locked, messages queue client-side and get answered in
order, bubbles have tails/timestamps/sent-ticks.

**Resource-aware**: opening "Ask Byte about this" on a resource
(`components/jnv/ai-context-provider.tsx` carries the context without
prop-drilling) resolves real context server-side —
`lib/jnv/ai-context.ts#buildJnvResourceContext` sends title/subject/
description always, plus real extracted PDF text
(`lib/jnv/extract-pdf-text.ts`, `pdfjs-dist@4` legacy Node build, capped at
20 pages/12000 chars, Redis-cached 1h per resource) when the file is a PDF
and actually deliverable. Other file kinds (image/PPT/DOC) fall back to
metadata-only context — Byte is instructed to say so honestly rather than
pretend it read the file. **Security note**: `fileUrl` is admin-supplied and
only Zod-validated as "a URL" at the DB boundary, so both
`extractPdfText` and the delivery check below verify the URL is actually on
our own Cloudinary account (`lib/cloudinary.ts#isTrustedCloudinaryUrl`)
before ever fetching it — otherwise a malicious/compromised admin account
could turn either into an SSRF primitive that fires on every public,
unauthenticated student page view. The `jnvResourceCreateSchema` enforces
the same check at ingestion (defense in depth, not just at the fetch call
sites).

## Teacher AI Toolkit

`/admin/jnv/ai-toolkit` — generate any of 18 content types (lesson plans,
question papers, worksheets, Bloom's-taxonomy questions, etc.; catalog in
`lib/jnv/teacher-content-types.ts`) from a topic, fully editable before
copy / `.txt` download / PDF export (`lib/pdf/jnv-content-pdf.tsx` +
`app/api/admin/jnv/export-pdf`). Uses `generateText` (buffered), not
`streamText` — the admin flow is generate-then-edit, not live chat, so this
fits the existing `AdminResult<T>` server-action convention
(`lib/actions/admin/jnv-ai.ts`) better than a streaming route. The backend
also accepts an optional `resourceId` to generate FROM an existing uploaded
resource instead of a free-text topic (reuses the same
`buildJnvResourceContext` as Byte) — **not yet wired to the toolkit's admin
UI**, so that code path is currently unreachable from the UI. A resource
picker in `jnv-ai-toolkit-manager.tsx` would close this gap.

## Known follow-ups

- `moveJnvFolder` / `reorderJnvFolders` actions exist but aren't wired to a
  drag-and-drop UI yet — folders can currently only be created flat under the
  folder you're viewing.
- The upload dialog has only been verified via a DB-level round-trip script,
  not a live authenticated browser upload through Cloudinary.
- **All PDF resources currently fail to preview/download/print in
  production**: Cloudinary's "Restricted media types" account security
  setting blocks PDF delivery — confirmed empirically (raw, signed, AND
  authenticated delivery all return 401 identically against the real
  account), so this is not fixable in code. Needs the account owner to
  allow PDF/ZIP delivery in the Cloudinary console (Settings → Security).
  The app degrades gracefully in the meantime
  (`lib/jnv/check-delivery.ts` + a banner in `ResourceViewer`) rather than
  showing a silently broken preview.
- The Teacher AI Toolkit's `resourceId` support (generate from an existing
  resource) has no UI yet — see above.
- No live browser click-through has been done on the Presentation
  Mode/viewer/chat interactions added across this module's redesign
  (typecheck/lint/build/curl-smoke only) — the `claude-in-chrome` extension
  was declined in the session that built these features.
