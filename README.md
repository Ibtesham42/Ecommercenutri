# Nutriyet 🌿

AI-powered health & nutrition e-commerce platform for **nutriyet.in**.

Premium makhana, dry fruits, seeds, protein and wellness products, with an AI
nutrition expert, natural-language search, Instagram-style stories, Razorpay
checkout and a full admin panel.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, RSC, Server Actions) + TypeScript |
| UI | Tailwind CSS v4 + shadcn/ui + lucide-react |
| Database | PostgreSQL (Neon) + Prisma 6 |
| Auth | NextAuth v5 (Auth.js) — Google + Credentials |
| Email | Resend |
| Payments | Razorpay |
| Media | Cloudinary |
| AI | Groq via the Vercel AI SDK (`llama-3.3-70b-versatile`) |
| Cache / rate-limit | Upstash Redis |

> Every integration has a **graceful keyless fallback** — the app runs
> end-to-end with empty API keys (mock checkout, console-logged emails,
> "AI not configured" states, no-op cache). Fill keys in `.env` to go live.

## Getting started

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
#   → set DATABASE_URL to your Neon connection string (required)
#   → other keys are optional; leave blank to use fallbacks

# 3. Set up the database
npm run db:generate     # generate Prisma client
npm run db:migrate      # create tables (needs DATABASE_URL)
npm run db:seed         # seed categories, products, admin user, coupons, stories

# 4. Run the dev server
npm run dev             # http://localhost:3000
```

Default admin (from the seed): `admin@nutriyet.in` / `ChangeMe123!`
(override via `ADMIN_EMAIL` / `ADMIN_PASSWORD` before seeding).

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:migrate` | Apply Prisma migrations |
| `npm run db:seed` | Seed sample data |
| `npm run db:studio` | Open Prisma Studio |

## Environment

See [`.env.example`](./.env.example) for the full, documented list. The only
value required to boot with a database is `DATABASE_URL`.

## Project structure

```
app/
  (storefront)/   public storefront (landing, catalog, PDP, cart, checkout)
  (auth)/         login, register, password reset, email verification
  (account)/      user dashboard
  admin/          role-gated admin panel
  api/            route handlers (auth, checkout, webhooks, AI, stories)
components/        ui (shadcn), storefront, admin, stories, ai, shared
lib/              prisma, auth, redis, cloudinary, razorpay, groq, email, …
prisma/           schema.prisma, seed.ts, migrations
config/           site config
types/            shared TypeScript types
```

## Build roadmap

- **M0 — Foundation**  scaffold, schema, service clients, branded shell
- **M1** — Storefront + Auth + Products
- **M2** — Cart + Checkout + Orders + Razorpay
- **M3** — Admin panel
- **M4** — AI (Groq) features
- **M5** — Stories + PWA + SEO/perf/security + deployment

## Notes

- **Node:** Node 20 or 22 LTS is recommended (Prisma 7 and several deps require
  it). The project is pinned to Prisma 6 to support Node 18.18+/21.
- **Deployment:** Vercel-ready. Docker/VPS artifacts arrive in M5.
