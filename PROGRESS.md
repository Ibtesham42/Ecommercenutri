# Nutriyet — Progress Tracker

_Last updated: 2026-06-25 · Auto-maintained. Update at the end of every milestone._

## Snapshot

| Item                | Status                                                          |
| ------------------- | -------------------------------------------------------------- |
| Build               | ✅ passing (`next build`, 36 routes)                            |
| TypeScript          | ✅ `tsc --noEmit` clean                                         |
| ESLint              | ✅ clean                                                        |
| Runtime smoke       | ✅ stories rail renders; admin upload pages 200; Cloudinary active |
| Database (Neon)     | ✅ live, migrated, seeded                                       |
| Current milestone   | **M6 — SEO / PWA / Analytics / Deploy** (next up)              |

## Milestones

| Milestone | Scope                                                | Status        |
| --------- | ---------------------------------------------------- | ------------- |
| M0        | Foundation                                           | ✅ Complete    |
| M1        | Storefront + Auth + Products + Account               | ✅ Complete    |
| M2        | Cart → Checkout → Razorpay → Orders                   | ✅ Complete    |
| M3        | Admin panel                                          | ✅ Complete    |
| M4        | AI (Groq): assistant, product chat, search, recs     | ✅ Complete    |
| M5        | Stories viewer, Cloudinary uploads, image optimization | ✅ Complete  |
| M6        | SEO, PWA, analytics, email, notifications, deploy    | ⏳ Next        |

## M5 deliverables (this session)
- **Stories viewer** (`components/storefront/stories-viewer.tsx`): full-screen
  overlay, segmented progress, auto-advance (images 5 s / video on end), tap +
  keyboard nav, product CTA, tab-hidden pause, scroll lock. The storefront rail
  (`stories-rail.tsx`) opens it; `lib/actions/stories.ts#recordStoryView` tracks views.
- **Cloudinary uploads**: `lib/actions/admin/upload.ts` (signed, server-side) +
  `components/admin/image-upload-field.tsx` (file upload when configured, URL paste
  fallback). Wired into product/category/story admin forms (`cloudinaryReady` passed
  from the pages). `next.config.ts` body limit raised to 12 MB.
- **Image optimization**: `lib/cld.ts#cldUrl` injects `f_auto,q_auto` (+ resize) into
  Cloudinary URLs; no-op for other hosts.

## Pending credentials (optional — app runs without them)
| Integration | Env keys                                  | Effect if blank                  |
| ----------- | ----------------------------------------- | -------------------------------- |
| Cloudinary  | `CLOUDINARY_*`                            | ✅ configured — uploads live; else URL paste |
| Groq        | `GROQ_API_KEY`                            | ✅ configured — AI live; else friendly fallback |
| Razorpay    | `RAZORPAY_KEY_ID/SECRET/WEBHOOK_SECRET`   | Checkout uses mock-success flow  |
| Resend      | `RESEND_API_KEY`                          | Emails logged to console (set a key to send live) |
| Google OAuth| `AUTH_GOOGLE_ID/SECRET`                   | Only credentials login shown     |
| Upstash     | `UPSTASH_REDIS_REST_URL/TOKEN`            | Cache / rate-limit are no-ops    |

## Risks / blockers
- **Node 21.1.0 (EOL)** pins Prisma to 6. Move to Node 20/22 LTS, then bump Prisma 7.
- Neon **cold start** (`P1001`) on first connect after idle — retry once.
- `/api/ai/chat` is **not yet rate-limited** — add Upstash limiting before public launch.
- Stories viewer interactivity (auto-advance/tap) is client-only — not covered by the
  headless smoke test; verify visually in a browser.

## Next recommended task
**Start M6:** sitemap.xml + robots.txt, structured data (Organization/Website/Breadcrumb
in addition to existing Product JSON-LD), OG image route, PWA manifest + service worker,
analytics, and Vercel deployment config + production hardening (incl. AI rate limiting).
