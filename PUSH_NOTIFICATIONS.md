# Push Notifications — Setup & Operations Guide

Nutriyet sends browser push notifications with the **Web Push standard (VAPID)** —
built into Chrome, Edge, Firefox and Safari. It is **completely free**: no OneSignal,
no Firebase account, no vendor, no monthly charges. The "keys" are just a
self-generated cryptographic pair that identifies your server to the browsers'
push services.

Everything is already implemented in this codebase (`web-push` npm package,
subscription APIs, service worker, Marketing Hub channel). The only setup step is
generating the VAPID keypair and putting it in the environment.

---

## 1. Initial setup

### Generate the keys (one time, free, no account)

```bash
npx web-push generate-vapid-keys
```

This prints a **Public Key** and a **Private Key**. The private key is a secret —
never commit it, never paste it into docs or chat.

### Configure locally

Add to `.env` (gitignored):

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<the public key>
VAPID_PRIVATE_KEY=<the private key>
VAPID_SUBJECT=mailto:support@nutriyet.in   # optional — this is already the default
```

Then **fully restart** the dev server (or rebuild). Two reasons: `NEXT_PUBLIC_*`
values are inlined into the client bundle at build/compile time, and the server
caches its VAPID state per process.

### Configure on Vercel (production)

1. Vercel Dashboard → your project → **Settings → Environment Variables**.
2. Add all three variables for **Production** (and Preview, using the **same**
   pair — subscriptions are bound to the public key, so a different Preview key
   would make Preview subscriptions useless in Production).
3. **Redeploy.** This is mandatory, not optional: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   is baked into the JavaScript bundle at build time. Saving the env var alone
   changes nothing until the next build.

### ⚠️ Key rotation warning

Generating **new** keys later invalidates **every existing subscription** — the
push services reject sends with 400/403 (VAPID mismatch), which the automatic
dead-subscription pruning does *not* catch (it only prunes 404/410). If you must
rotate: clear the `PushSubscription` table and let users re-enable notifications.

---

## 2. Environment variables

| Variable | Where | Meaning |
| --- | --- | --- |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | client + server | Public half of the keypair; browsers use it when subscribing. Build-inlined. |
| `VAPID_PRIVATE_KEY` | server only | Secret half; signs every push request. |
| `VAPID_SUBJECT` | server only | Contact URI sent to push services. Optional — defaults to `mailto:support@nutriyet.in`. |

Push features self-gate on the first two (`lib/env.ts` → `isConfigured.webPush()`).
With them blank, the whole system no-ops cleanly (keyless-fallback philosophy).

---

## 3. Browser support

| Platform | Support |
| --- | --- |
| Chrome / Edge / Firefox — desktop & Android | ✅ Full |
| Safari — macOS 13+ (Safari 16+) | ✅ |
| **iOS / iPadOS 16.4+** | ✅ **only from a Home-Screen-installed PWA** — Safari tabs cannot receive push on iOS |
| iOS < 16.4 | ❌ |

Web Push requires a **secure context**: HTTPS in production, or `localhost` in
development. Plain-HTTP LAN IPs cannot subscribe.

---

## 4. How users subscribe (permission flow)

Subscribing requires a **signed-in** user (subscriptions are stored per user for
audience targeting). There are two opt-in surfaces:

1. **Account page** (`/account`) — a "Push notifications" card with an Enable
   button (`components/account/push-optin.tsx`).
2. **PWA install prompt** (`components/storefront/pwa-install-prompt.tsx`) — after
   the user installs the app (or when already installed), a one-time friendly
   "enable notifications?" card appears before any browser prompt.

Flow: user clicks Enable → browser permission prompt (`default` → `granted` /
`denied`) → the service worker subscribes with the public key → the subscription
(endpoint + encryption keys) is stored in the `PushSubscription` table, **one row
per device/browser**. Both surfaces render nothing until VAPID keys are configured.

---

## 5. Sending from the admin panel

Admin → **Marketing Hub** (needs the `marketing` permission):

- **Compose** → toggle the **Push** channel (a "Needs setup" hint shows if keys
  are missing) → target an audience → **Send now**, **Schedule**, or save a draft.
- **Send test to me** — delivers the current compose content to *you only* (all
  selected channels) and reports a per-channel outcome toast. Use this to verify
  push end-to-end without messaging customers. Automations have the same test button.
- **Scheduling** — scheduled campaigns are dispatched by the marketing cron
  (`/api/cron/marketing`). On the Vercel **Hobby** plan the cron runs **once daily
  at 03:00 UTC** (plan limit), so a scheduled push waits for that tick. For
  near-real-time scheduling: Vercel Pro (`*/5 * * * *` in `vercel.json`) or point a
  free external cron (e.g. cron-job.org) at the endpoint with the `CRON_SECRET` bearer.
- **Automations** — WELCOME / ABANDONED_CART / WINBACK / POST_PURCHASE rules can
  include the Push channel; the same cron runs them.

### Delivery status (what the numbers mean for push)

- **Sent** — recipients attempted on the channel.
- **Delivered** — users whose browser push service accepted the message on at
  least one of their devices.
- **Clicked** — the notification was clicked (the CTA is routed through the
  click-tracking redirect, same as email links).
- **Opened** — *not tracked for push* (email-only pixel); clicks are the
  engagement signal for push.

---

## 6. Testing checklist

1. Keys in `.env` → **production build**: `npm run build && npm start`
   (the service worker registers **only in production builds** — push will not
   work under `npm run dev`).
2. Sign in → `/account` → enable push → allow the permission prompt.
3. Admin → Marketing → Compose → title/body + Push channel → **Send test to me**
   → an OS notification appears; click it → it opens the CTA URL.
4. Real campaign: target "Selected users" with your own user, send, click the
   notification, then check the campaign row's clicks counter.
5. Android Chrome: same flow on the live HTTPS domain; notification lands in the
   system tray. iPhone: install the PWA first (Share → Add to Home Screen), iOS 16.4+.

---

## 7. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| No "Enable" card on the account page | VAPID keys missing (card renders only when configured), or the browser doesn't support push. |
| Permission prompt never shows | Permission was previously **denied** — the site cannot re-ask. Reset it in the browser's site settings (padlock icon → Notifications → Allow), then retry. |
| Test says "Web Push is not configured (VAPID keys missing)" | Env vars not set **in the running process** — restart/redeploy after setting them. |
| Test says "Recipient has no active push subscription" | Your admin account hasn't enabled push on this device — do §6 step 2 first. |
| Works locally, not on Vercel | Env vars added but **no redeploy** (public key is build-inlined), or added to the wrong environment (Preview vs Production). |
| Nothing works in `npm run dev` | Expected — the service worker registers only in production builds. Use `npm run build && npm start`. |
| iPhone never prompts | iOS requires 16.4+ **and** the site installed as a PWA (Add to Home Screen). |
| Pushes suddenly fail for everyone (400/403 in logs) | VAPID keys were rotated — old subscriptions are invalid. Clear `PushSubscription`, users re-enable. |
| A user stopped receiving pushes | They cleared site data/uninstalled the PWA; dead endpoints (404/410) are pruned automatically on the next send. |
| Notification arrives but the image/icon is missing | `imageUrl` must be an absolute HTTPS URL; the icon falls back to the brand icon. |

---

## 8. Architecture (for developers)

- `lib/marketing/providers.ts#sendPush` — web-push send, env-gated, prunes dead endpoints.
- `lib/env.ts` — `isConfigured.webPush()` feature flag.
- `app/api/push/subscribe|unsubscribe` — auth-gated subscription persistence (`PushSubscription` model).
- `lib/push-client.ts` — browser-side permission + subscribe pipeline.
- `public/sw.js` — `push` (show notification) and `notificationclick` (focus/open URL) handlers.
- `lib/marketing/deliver.ts` — campaign PUSH adapter (click-tracked CTA); `lib/marketing/automation.ts` — automation delivery + `deliverToOne` (used by test sends).

Out of scope by design: subscriptions for signed-out visitors, per-device delivery
metrics, push open tracking.
