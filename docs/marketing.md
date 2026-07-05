# Marketing Hub — Campaigns, Channels, Automation

> Part of the [Nutriyet docs](../CLAUDE.md#documentation-index). Gated by the
> **`marketing`** RBAC permission. Admin **user guide** (non-technical):
> [guides/marketing-hub.md](guides/marketing-hub.md). Push setup/ops:
> [guides/push-notifications.md](guides/push-notifications.md).

Multi-channel campaign system at **`/admin/marketing`**, built modular so channels and
automation slot in cleanly.

## Models (migrations `marketing_hub`, `marketing_automation`)

- `Campaign` (type, status, channels[], content title/body/imageUrl/ctaText/ctaUrl,
  `segmentType`+`segmentConfig` JSON targeting, optional `productId`/`couponId` (plain
  ids, no FK), `scheduledFor`/`recurrence`/`sentAt`, analytics counters audienceSize/sent/
  delivered/open/click/conversion/revenue), `CampaignEvent` (OPEN/CLICK/CONVERSION log),
  `CampaignTemplate` (built-in + custom), `AudienceSegment` (saved audiences),
  `AutomationRule` + `AutomationLog`, `PushSubscription`.
- Enums: `CampaignType`, `CampaignStatus`, `CampaignChannel`, `SegmentType`.

## lib/marketing/

- `channels.ts` — client-safe labels; `CHANNEL_LIVE` = all channels selectable.
- `audience.ts` — `resolveAudience`/`countAudience`: 9 segment types over existing
  User/Order/WishlistItem/Cart/Affiliate data; Recipient carries `phone` = user.phone ??
  latest address phone.
- `deliver.ts` — `dispatchCampaign` via a per-channel **adapter registry**; In-App→
  `notify`, Email→`marketingEmail`+`sendEmail`, Push/WhatsApp/SMS→`providers.ts`;
  `dispatchDueCampaigns` for cron.
- `providers.ts` — **env-gated channel providers**: `sendPush` (Web Push/VAPID via
  `web-push`, prunes dead subs), `sendWhatsApp` (Meta Cloud API), `sendSMS` (Twilio);
  each no-ops until its keys are set (same keyless philosophy as email).
- `ai.ts` — `generateCampaignContent` via the Groq seam (generateText + JSON parse,
  heuristic fallback).
- `templates.ts` — built-ins, `ensureBuiltInTemplates` idempotent.
- `conversion.ts` — `recordCampaignConversion` credits a campaign from the `nut_campaign`
  cookie, called best-effort in `createOrder`.
- `automation.ts` — see Automation below.

## Channels

In-App + Email always work; **Push/WhatsApp/SMS are real adapters, env-gated**
(`isConfigured.webPush/whatsapp/sms`). Web Push: `PushSubscription` model +
`/api/push/(un)subscribe` + additive SW `push`/`notificationclick` handlers
(`public/sw.js`, VERSION bumped — fetch/cache invariant untouched) + an account opt-in
(`components/account/push-optin.tsx`, renders only when VAPID configured + supported).
Compose shows a "needs setup" hint for selected-but-unconfigured channels (those
recipients are skipped).

## Delivery, scheduling, tracking

- "Send now" dispatches immediately; **scheduled** campaigns set
  `status=SCHEDULED`+`scheduledFor` and are processed by `GET/POST /api/cron/marketing`
  (guarded by `CRON_SECRET`, wired in `vercel.json`). **Schedule is `0 3 * * *` (daily) —
  the max the Vercel Hobby plan allows; on Pro bump to `*/5 * * * *`, or point an external
  cron (cron-job.org) at the endpoint with the `CRON_SECRET` bearer.**
- Tracking: `/api/marketing/open/[id]` (1×1 pixel → OPEN) and `/api/marketing/click/[id]`
  (CLICK + attribution cookie → redirect). Email links are click-wrapped;
  conversions/revenue accrue from orders within the 7-day cookie window.
- **Recurring campaigns** (`Campaign.recurrence` = DAILY/WEEKLY/MONTHLY, null = one-off):
  a recurring campaign is a **series parent** — it stays SCHEDULED, each due fire spawns a
  one-off child snapshot dispatched for its own per-occurrence analytics, then the parent
  re-arms via `nextRun(recurrence, from)` (skips missed windows). Cancel stops the series.

## Automation rules

`AutomationRule` + `AutomationLog`: trigger-based flows — `WELCOME` / `ABANDONED_CART` /
`WINBACK` / `POST_PURCHASE`, each with `delayHours`, channels, content (+ optional
coupon). `runAutomations` (same cron, after campaign dispatch) computes eligibility from
existing user/order/cart/OrderEvent data, **dedups via `AutomationLog
@@unique([ruleId, key])`** (key = userId, or orderId for post-purchase), delivers via
in-app + email (catch-up bounds avoid blasting old users on first enable; per-run cap).
Admin **Automations** tab manages rules + manual "Run now".

## Admin UI

`lib/actions/admin/marketing.ts`, `lib/queries/marketing.ts` — tabbed (`MarketingTabs`):
**Overview** (sent/delivered/opened/clicked/conversions/revenue + recent), **Campaigns**
(list + history, bulk delete/cancel via `<BulkBar>`, per-row send/schedule/duplicate/
resend/cancel), **Compose** (`campaign-editor.tsx` — rich content + image, AI assist,
channel toggles, audience targeting with live recipient count, attach product/coupon,
send-now / schedule / save-draft), **Segments** (CRUD with live counts), **Templates**
(built-in + custom CRUD). Sent campaigns are immutable (duplicate/resend instead).

## Conventions

Reuses `AdminResult`/`BulkOutcome`, Zod (`lib/validations/marketing.ts`),
`requirePermission("marketing")`, `notify`/`sendEmail`, the Groq provider seam,
`ImageUploadField`. Degrades gracefully — Email no-ops to console without Resend, AI
falls back to a heuristic without Groq.
