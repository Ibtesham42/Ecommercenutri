# Marketing Hub — User Guide

A simple, step-by-step guide to using the Marketing Hub at **Admin → Marketing**
(`/admin/marketing`). It needs the `marketing` admin permission (super admins always
have it). This guide explains the existing system only — no code knowledge needed.

---

## 1. The big picture

The Marketing Hub has two ways to message customers:

| | **Campaigns** | **Automations** |
| --- | --- | --- |
| What | One message you compose and send | A rule that sends itself when something happens |
| When | Now, at a scheduled time, or repeating daily/weekly/monthly | Automatically, when a customer matches the trigger |
| Example | "Flash sale this weekend!" | "Welcome! Here's 10% off" after someone signs up |
| Where | **Compose** tab | **Automations** tab |

The tabs across the top: **Overview** (stats + recent campaigns), **Campaigns**
(history + manage), **Compose** (create/send), **Segments** (saved audiences),
**Templates** (reusable content), **Automations** (trigger rules + history).

Both campaigns and automations can deliver on five channels — see §8 for which
ones are live in your store today.

---

## 2. Creating an automation (step by step)

Go to **Marketing → Automations → New automation**. The form fields:

1. **Name** — for your own reference, e.g. "Welcome offer".
2. **Trigger** — *when* it fires (see §3).
3. **Delay** — *how long after* the trigger event it sends (see §4). Enter a
   number and pick **hours** or **days** (days are stored as hours × 24).
4. **Channels** — where the message goes (see §5).
5. **Title + Message** — what the customer reads (see §6). The ✨ **AI assist**
   box can draft these for you: describe the message ("welcome message with a
   friendly tone offering 10% off") and press generate, then edit to taste.
6. **Image** (optional) — used by Email and Push (see §6).
7. **CTA text + URL** (optional) — the button/link (see §7).
8. **Coupon** (optional) — see §7, important note.
9. **Save** — the rule is created **active** by default and starts sending on the
   next automation run. Pause it right after saving if you're not ready.

## 3. What each trigger does

| Trigger | Who gets it | Notes |
| --- | --- | --- |
| **Welcome new customer** | A user whose account is at least `delay` old | Only looks back 14 days past the delay, so turning it on doesn't blast your entire old user base. |
| **Abandoned cart** | A signed-in customer who added something to the cart, then went quiet for `delay` without ordering | Based on real cart-add activity; guests (not signed in) can't be matched. Looks back 30 days. |
| **Win back inactive** | A customer who has ordered before, but not in the last `delay` | Use a long delay here — e.g. 30 or 60 **days**. |
| **After purchase** | Sends `delay` after an order is **delivered** | Fires once **per order** (a repeat customer can get it again for a new order). Great for review requests. Looks back 30 days. |

## 4. How the delay ("hours") works

The delay is the waiting time between the trigger event and the message:

- Welcome + delay **1 hour** → a new account gets the message about an hour after signing up.
- Abandoned cart + delay **24 hours** → sends a day after the last cart activity (if still no order).
- Win back + delay **45 days** → sends when a customer's last order is 45+ days old.
- After purchase + delay **3 days** → sends 3 days after delivery ("How was it? Leave a review").

Timing is not to-the-minute: messages go out on the next **automation run** after
someone becomes eligible (see §9 for run frequency).

## 5. Choosing channels

You can tick any combination; each recipient gets the message on every ticked
channel that can reach them:

- **In-App** — the notification bell 🔔 in the store header. Always works, reaches
  every signed-in user. Free.
- **Email** — a branded email. Needs an email address (all accounts have one). Free
  on the Resend free tier.
- **Push** — a real phone/desktop notification, even when the site is closed. Only
  reaches customers who clicked "Enable notifications" (Account page or the app
  install prompt). Completely free (VAPID). See `push-notifications.md`.
- **WhatsApp** — needs Meta WhatsApp Cloud API setup (§8). Recipients need a phone
  number on their profile/address.
- **SMS** — needs Twilio setup (§8), paid per message. Also needs a phone number.

A channel that isn't configured (or a recipient it can't reach — no phone, no push
subscription) is simply **skipped** and recorded as skipped; nothing breaks.
Good default: **In-App + Email**, add **Push** now that it's live.

## 6. Title, message, and image

- **Title** — short and specific; it's the email subject / notification headline.
  ("Your cart misses you 🛒", "Welcome to Nutriyet — 10% off inside")
- **Message** — 1–3 friendly sentences. Personalization: emails greet the customer
  by name automatically; you don't need to write it.
- **Image** — optional. Shows as the email banner and the push notification's large
  icon. In-App/WhatsApp/SMS ignore it. Upload via the image field (Cloudinary) or
  paste an image URL.

## 7. CTA button and coupon

- **CTA text + URL** — becomes the button in emails, the tap-action of a push
  notification, and the link on the in-app notification. Use full URLs
  (`https://nutriyet.in/products/...`) or a path (`/products`). Examples:
  "Shop now" → `/products`, "Complete your order" → `/cart`.
- **Coupon (important):** attaching a coupon records *which* coupon this
  message promotes, but it does **not** automatically insert the code into the
  text. **Write the code in the message yourself**, e.g. "Use code **WELCOME10**
  for 10% off." Create the coupon first at Admin → Coupons.

## 8. Which channels are live in this store today

| Channel | Status | Setup needed |
| --- | --- | --- |
| **In-App** | ✅ Working | None — built in. |
| **Email** | ✅ Working | Already configured (Resend + `EMAIL_FROM`). Free tier: 100 emails/day, 3,000/month. |
| **Push** | ✅ Working | VAPID keys configured (free forever). Customers must enable notifications once; see `push-notifications.md`. |
| **WhatsApp** | ⛔ Not configured | Needs a **Meta WhatsApp Cloud API** app (developers.facebook.com): set `WHATSAPP_TOKEN` + `WHATSAPP_PHONE_ID` in Vercel env and redeploy. Note: Meta charges per marketing conversation in India — not free at scale. |
| **SMS** | ⛔ Not configured | Needs a **Twilio** account: set `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` in Vercel env and redeploy. Paid per SMS. |

If you select an unconfigured channel, the Compose page shows a "Needs setup"
hint and those deliveries are skipped — the rest still send. There is **no**
paid subscription anywhere in the system itself; WhatsApp/SMS costs are the
providers' own messaging fees, and you can simply not use those channels.

**Scheduling requirement:** scheduled campaigns and automations are processed by
a cron job (`/api/cron/marketing`). Make sure **`CRON_SECRET`** is set in the
Vercel environment variables (any long random string) — the Vercel cron sends it
automatically once set.

## 9. When automations actually send

- The cron in `vercel.json` runs **once a day at 03:00 UTC ≈ 8:30 AM IST**
  (the maximum frequency Vercel's free Hobby plan allows). Every enabled
  automation is evaluated then, and newly-eligible customers get their messages.
  So in practice, delays are "at least X hours, delivered at the next daily run".
  (The Automations page mentions "~every 5 min" — that applies only if you
  upgrade to Vercel Pro and change the schedule, or point a free external cron
  like cron-job.org at the endpoint with the `CRON_SECRET`.)
- **Run now** button (Automations page) — runs all enabled rules immediately.
  Useful right after enabling a rule, or on the daily plan when you don't want
  to wait. It shows a full report: eligible, already-messaged, sent, failed, and
  the reason when nothing was sent.
- **Activation warning:** when you enable a rule, customers who *already* match
  the trigger (recent sign-ups, currently-inactive customers…) are eligible on
  the first run. The window bounds (14/30 days, §3) keep this reasonable, and
  each person is still messaged only once.

## 10. Who receives it, and duplicate prevention

- Only **active customer accounts** (never admins, never deactivated users).
- Every send is logged, and the log is unique per rule + person (per rule +
  **order** for After-purchase). A customer can **never get the same automation
  twice**, even across "Run now" clicks, cron overlaps, or pausing/resuming.
  There is also a safety cap of 500 recipients per rule per run.

## 11. Testing before it reaches real customers

- **Automations:** the 🧪 flask button on any rule = **Send test to me**. It sends
  the rule's actual message to *your own* admin account on all its channels and
  shows what happened per channel ("Test sent to you via In-App, Email · Push:
  Recipient has no active push subscription"). Tests are marked TEST in the
  history and don't use up anyone's once-only slot.
- **Campaigns:** the same **Send test to me** button is in Compose, next to Send
  now. It sends the current draft to you only — nothing is saved or counted.
- To receive the push part of a test, first enable notifications on your own
  device (Account page).
- Safe rehearsal for an automation: create it → it saves as active → **pause it**
  → 🧪 test it → tweak → activate when happy.

## 12. Checking results

**Automations** → **History** button: every recipient, with status —
**Sent** (all channels delivered), **Partial** (some channel skipped/failed —
the reason is shown), **Failed** (no channel delivered), **Test**. This is your
delivery log.

**Campaigns** → Overview cards + the Campaigns list show per campaign:

- **Sent** — deliveries attempted.
- **Delivered** — actually accepted (email handed to provider; push accepted by
  at least one of the user's devices; in-app always delivers).
- **Opened** — email opens (tracking pixel). *Email only — push/in-app opens
  aren't tracked.*
- **Clicked** — clicks on the email button/links, push notifications, and in-app
  notification links.
- **Conversions / Revenue** — orders placed within 7 days of clicking, and their
  value.

Automations track delivery status per recipient but not opens/clicks; campaign
numbers are where open/click analytics live.

## 13. Pause, edit, resume, delete

On the Automations page, each rule has:

- **Toggle switch** — pause (stops sending; history kept) / resume (asks for
  confirmation because already-matching customers become eligible).
- **Pencil** — edit anything (trigger, delay, content, channels). Takes effect
  from the next run; people already messaged stay messaged.
- **Trash** — delete the rule after confirmation.
- Campaigns: drafts can be edited freely; **sent campaigns are locked** — use
  Duplicate/Resend from the Campaigns list instead.

## 14. Troubleshooting ("my automation didn't send")

Work down this list:

1. **Is the rule enabled?** The toggle must be on.
2. **Press "Run now"** and read the report — it tells you exactly why nothing
   went out, e.g. "No accounts created in the eligibility window", "Every
   eligible recipient was already messaged", or a channel problem.
3. **Nobody is eligible yet.** Welcome only matches accounts created between
   `delay` and `delay + 14 days` ago; Abandoned cart needs *signed-in* cart
   activity; Win back needs past customers older than the delay.
4. **Waiting for the cron.** On the Hobby plan the automatic run is once a day
   (≈ 8:30 AM IST). Use "Run now" to send immediately.
5. **Scheduled campaign stuck at "Scheduled"?** Check `CRON_SECRET` is set in
   Vercel env vars and the cron shows runs under Vercel → project → Cron Jobs.
6. **A channel is skipped.** The history/test toast gives the reason: channel
   not configured (§8), recipient has no phone / no push subscription, etc.
7. **Email went to spam.** Verify your sending domain in Resend.
8. **Push not arriving.** See the troubleshooting table in `push-notifications.md`
   (most common: the device never enabled notifications, or permission denied).

## 15. Recipes (real examples)

### Welcome series
- Automations → New: trigger **Welcome new customer**, delay **1 hour**,
  channels In-App + Email + Push, title "Welcome to Nutriyet! 🌱", message
  "Thanks for joining! Enjoy 10% off your first order with code WELCOME10.",
  CTA "Shop now" → `/products`, attach the WELCOME10 coupon. Save → test on
  yourself → done. Every new customer now gets it ~1 hour after signing up
  (delivered at the next run).

### Abandoned cart nudge
- Trigger **Abandoned cart**, delay **24 hours**, In-App + Email + Push,
  title "You left something behind 🛒", message "Your cart is waiting — your
  picks are still in stock.", CTA "Complete your order" → `/cart`.

### Win back inactive customers
- Trigger **Win back inactive**, delay **45 days**, Email + Push,
  title "We miss you!", message "It's been a while — here's ₹100 off your next
  order with code COMEBACK100.", CTA "Browse what's new" → `/products`,
  attach the coupon (and mention the code in the text!).

### Review request after delivery
- Trigger **After purchase**, delay **3 days**, In-App + Email,
  title "How was your order?", message "We'd love your feedback — reviews help
  other health-conscious shoppers.", CTA "Write a review" → `/account/orders`.

### Flash sale (a campaign, not an automation)
- **Compose**: name "Weekend flash sale", channels In-App + Email + Push, title
  "⚡ 24-hour flash sale", message + image, CTA → a category or `/products`,
  audience **All users** (or a segment like "has ordered before"), then **Send
  now** — or schedule it for Saturday morning / set Repeat for a weekly promo.
  Watch opens/clicks/conversions on the Overview tab afterwards.

### Order confirmation — already automatic
Order confirmations, shipping/delivery updates, cancellations etc. are
**transactional emails built into the order flow** — they send by themselves and
are not part of the Marketing Hub. You don't need to create anything for them.
Use the **After purchase** trigger only for *marketing* follow-ups (reviews,
cross-sell), not order status.

---

*Related docs: `push-notifications.md` (push setup & troubleshooting),
`DEPLOYMENT.md` (environment variables).*
