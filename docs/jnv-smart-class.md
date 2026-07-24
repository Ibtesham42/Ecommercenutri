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

## Code Studio

A second, independent learning module at `/jnv/code-studio` — sits alongside
the Notes Portal without touching any of its upload/browse/viewer code. Lets
students write and run HTML, CSS, JavaScript and Python entirely in the
browser, with an AI coding mentor.

**No server storage, by design**: student code is never sent to or stored on
any database, server, or cloud storage — the module has zero Prisma models
and zero upload endpoints. Everything lives in `window.localStorage` on the
student's own device (`lib/jnv/code-studio/local-store.ts`): per-project code
drafts (keyed by project id, capped at 40, oldest evicted first), editor
preferences (theme/font size), and the last-opened project id for a
"Continue where you left off" card on the hub. Clearing browser storage or
switching devices loses everything — that's intentional, not a bug to fix.

**Architecture**: `lib/jnv/code-studio/languages.ts` defines the 4 initial
languages, each tagged with a `runtime` — HTML/CSS/JS share one `"web"`
runtime (a real page mixes all three, so every web project ships all 3 files
and a live preview), Python is its own `"python"` runtime (console output
only, no live page preview). Adding a 5th language later means: one entry in
`languages.ts`, a starter project set in `lib/jnv/code-studio/projects.ts`,
and — only if it needs a genuinely new execution model — a new runner
alongside `use-python-runtime.ts`.

- **Editor**: CodeMirror 6 via `@uiw/react-codemirror`
  (`components/jnv/code-studio/code-editor-pane.tsx`) — syntax highlighting,
  autocomplete, bracket matching, light/dark theme, adjustable font size. Each
  file tab remounts the CodeMirror instance on switch (`key={fileType}`)
  deliberately, so undo history can't bleed from one file into another.
- **Live preview** (`components/jnv/code-studio/live-preview.tsx` +
  `lib/jnv/code-studio/build-preview-doc.ts`): combines the HTML/CSS/JS panes
  into one `srcDoc` document (replacing the `style.css`/`script.js`
  references the starter templates use, since there's no real file to fetch)
  and renders it in an iframe sandboxed WITHOUT `allow-same-origin` — an
  opaque origin that can't reach cookies, localStorage, or anything else in
  the app no matter what a student's script does. A small injected console
  bridge forwards `console.log`/`warn`/`error` and uncaught errors to the
  parent via `postMessage` for the Console panel.
- **Python execution**: Pyodide (CPython-to-WebAssembly), loaded lazily from
  the jsdelivr CDN only when a student first hits Run
  (`components/jnv/code-studio/use-python-runtime.ts`) — never bundled,
  never executed server-side. This is the only safe way to run arbitrary
  student Python without ever `eval`-ing untrusted code on a server.
- **Projects**: `lib/jnv/code-studio/projects.ts` — 13 starter projects
  across the 4 languages (3 HTML, 3 CSS, 5 JavaScript, 5 Python), each a
  small but genuinely working skeleton with `TODO` comments, plus a "Blank
  Project" option per language.
- **AI Coding Mentor**: a third distinct AI persona alongside Nutri
  (storefront) and Byte (Notes Portal CS assistant) — own system prompt
  (`lib/jnv/code-studio/ai-prompts.ts`), own orchestration
  (`lib/jnv/code-studio/ai-chat.ts`), own route
  (`app/api/jnv/code-studio/ai/chat/route.ts`) and rate limiter
  (`limiters.jnvCodeMentor`). Reuses only the Groq provider seam, same
  precedent as Byte. **Session-only by design**: the current code + last
  console output are sent fresh on every request as context and used only to
  build that one response — nothing is ever written server-side, and the
  chat UI (`components/jnv/code-studio/mentor-chat.tsx`) keeps the whole
  conversation in React state only, so closing the panel or the tab loses it
  permanently. Styled as the same messaging-app pattern as Byte (never locks
  the input, queues sends, bubbles/ticks/timestamps).

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
- **Code Studio has not had a live browser click-through either** — verified
  via typecheck/lint/build, curl smoke tests, and a real end-to-end request
  against the dev-configured Groq key (confirmed the AI Coding Mentor answers
  correctly). NOT yet verified in a real browser: CodeMirror actually
  mounting/typing, the live preview iframe rendering, Pyodide loading from
  the CDN and executing Python, and localStorage draft persistence across a
  reload. These are exactly the class of bug curl can't catch — worth a real
  click-through pass (or ask the user to try it live) before calling this
  production-ready.
