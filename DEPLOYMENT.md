# Deploying Nutriyet

Production target: **Vercel** + **Neon PostgreSQL**. Every integration has a keyless
fallback, so the app deploys and runs even before you add optional keys — add them as
you go to switch each feature from fallback to live.

## 1. Prerequisites
- A GitHub repo with this project (already pushed).
- A **Neon** project (pooled + direct connection strings).
- Accounts as needed: Razorpay, Resend, Cloudinary, Groq, Upstash, Google OAuth.
- **Node 20 or 22 LTS** recommended (the dev machine ran 21.x which pins Prisma 6).

## 2. Database (Neon)
1. Create a Neon project; copy the **pooled** (`-pooler` host) and **direct** URLs.
2. Set `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) in Vercel env vars.
3. Apply migrations against the production DB:
   ```bash
   npx prisma migrate deploy
   ```
4. (Optional) Seed reference data: `npm run db:seed`. Change `ADMIN_PASSWORD` first.

## 3. Vercel project
1. Import the GitHub repo into Vercel (Framework preset: **Next.js**).
2. Build command `next build`, output handled automatically. Prisma Client is
   generated during install/build.
3. Add **all** environment variables (see `.env.example`). At minimum:
   `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET` (+ `NEXTAUTH_SECRET`), `NEXTAUTH_URL`
   and `NEXT_PUBLIC_APP_URL` set to the production URL (e.g. `https://nutriyet.in`).
4. Deploy.

## 4. Post-deploy integration setup
- **Auth / Google**: set the OAuth redirect URI to
  `https://<domain>/api/auth/callback/google`. Generate `AUTH_SECRET` with `npx auth secret`.
- **Razorpay**: use live keys; add a webhook to `https://<domain>/api/webhooks/razorpay`
  with events `payment.captured` / `order.paid` and set `RAZORPAY_WEBHOOK_SECRET`.
- **Resend**: verify your sending domain; set `RESEND_API_KEY` and `EMAIL_FROM`.
- **Cloudinary**: set `CLOUDINARY_*` to enable real admin image/video uploads.
- **Groq**: set `GROQ_API_KEY` (and optionally `GROQ_MODEL`) to enable live AI.
- **Upstash Redis**: set `UPSTASH_REDIS_REST_URL/TOKEN` to enable caching and
  rate limiting (e.g. the AI chat limiter). Without it, limiting is a safe no-op.
- **Web Push (free, no vendor)**: generate a VAPID keypair with
  `npx web-push generate-vapid-keys`, set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY` (and optionally `VAPID_SUBJECT`), then **redeploy** — the
  public key is inlined into the client bundle at build time. Full guide:
  `docs/guides/push-notifications.md`.
- **Analytics** (optional): set `NEXT_PUBLIC_ANALYTICS_SRC` + `_DOMAIN`.
- **AI Marketing (social)**: to publish to Instagram for real, set
  `INSTAGRAM_ACCESS_TOKEN` (long-lived token for an IG Business/Creator account
  linked to a Facebook Page) and `INSTAGRAM_BUSINESS_ID` (optional
  `INSTAGRAM_API_VERSION`, default `v21.0`). Without them the hub still generates
  and queues drafts and simulates publishing. Set `CRON_SECRET` (also guards
  `/api/cron/marketing`), then add `SITE_URL` + `CRON_SECRET` as **GitHub repo
  secrets** so `.github/workflows/social-cron.yml` can trigger `/api/cron/social`
  every 30 min (Vercel Hobby crons are daily-only). Full guide:
  `docs/social-automation.md`.

## 5. Verify production
- `https://<domain>/` loads; `/sitemap.xml`, `/robots.txt`, `/manifest.webmanifest`
  return 200; `/opengraph-image`, `/icon`, `/apple-icon` render.
- Place a test order (Razorpay test mode) → order appears in `/admin/orders`; the
  webhook marks it paid.
- `/assistant` answers (Groq) or shows the friendly fallback.
- Install prompt appears (PWA) and `/offline` works when offline.

## 6. Hardening checklist
- [ ] Strong, unique `AUTH_SECRET`; rotate the seeded admin password.
- [ ] Upstash configured so `/api/ai/chat` (and auth/checkout) are rate-limited.
- [ ] All secrets in Vercel env vars only — never committed (`.env` is gitignored).
- [ ] `NEXT_PUBLIC_APP_URL` / `NEXTAUTH_URL` match the real domain (canonical URLs,
      OG images, sitemap, OAuth callbacks all derive from these).
- [ ] Razorpay webhook secret set and the endpoint reachable.
- [ ] Move to Node 20/22 LTS, then optionally bump Prisma to 7.

## Routing notes
- Security headers are applied in `middleware.ts`.
- `/admin` requires an `ADMIN` user; `/account` requires login (enforced by middleware
  and server layouts).
