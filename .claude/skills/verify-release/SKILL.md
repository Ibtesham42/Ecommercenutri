---
name: verify-release
description: Run Nutriyet's full verification gate before committing — typecheck, lint, production build, bundle budget, and runtime smoke tests (dev server, headless screenshots, disabled-state parity, DB round-trip). Use before any commit of non-trivial code changes.
---

# Nutriyet verification gate

**Definition of done:** typecheck ✅ · lint ✅ · production build ✅ · runtime smoke ✅.
Commit + push only after all pass.

## 1. Static gates

```bash
npm run typecheck && npm run lint && npm run build
```

- Windows gotcha: a running dev server holds `.next\trace` → build fails with
  `EPERM … .next\trace`. Stop the dev server (kill lingering `node` processes) first.
- **Bundle budget:** "First Load JS shared by all" must stay **~103 kB**. Heavy client
  features belong in lazy chunks (`next/dynamic ssr:false`, mount on in-view — see
  showcase / hero-reveal). Check the affected route's size delta in the build table.

## 2. Runtime smoke (drive the affected flow — not just the gates)

```bash
npm run dev   # background; poll http://localhost:3000 until 200
```

- **Server-rendered checks via curl:** fetch the page and grep for expected markup /
  `<meta name="robots">` / absence of markup in disabled states.
- **Disabled-state parity:** optional features must leave markup byte-identical when
  off — diff/grep the region before enabling and after disabling.
- **DB round-trips without the UI:** drop a temp script in `scripts/tmp-*.ts` (module
  resolution requires it inside the repo), run `npx tsx scripts/tmp-*.ts`, **delete it
  after**. PrismaClient auto-loads `.env` from the repo root. Neon cold start → retry
  once on P1001. Clean up any test rows you insert; reset any StoreSetting you toggled.
- **Screenshots (headless Edge on this machine):**
  ```bash
  EDGE="C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
  "$EDGE" --headless=new --disable-gpu --window-size=1280,900 \
    --virtual-time-budget=6000 --screenshot=out.png http://localhost:3000/PAGE
  ```
  - Mobile: `--window-size=390,844` (note: headless Edge renders ~40px wide of the
    viewport — compare against a known-good page like /login before calling something a
    responsive bug).
  - Animations: `--virtual-time-budget` fast-forwards rAF/timers, but **IntersectionObserver
    is unreliable under virtual time** — in-view-gated features may never arm. Use a
    `preview`-style prop or a temporary test page to force-arm, and verify engine state
    via `--dump-dom` (inspect inline `transform`/`opacity`).
  - JS-inserted images may miss the capture: warm the cache with a first run sharing
    `--user-data-dir`, add `--run-all-compositor-stages-before-draw`.
  - The welcome popup fires at ~10s and the PWA prompt can overlay shots — keep budgets
    under 10s or account for them.
- **Keyless mode:** if the change touches an integration, confirm the blank-key fallback
  still renders (mock checkout, console email, `X-AI-Fallback`, no-op cache).
- Reduced motion (DevTools emulation) for any new animation; check the engine chunk is
  absent from the network tab.

## 3. Before committing

- Delete every temp artifact (`scripts/tmp-*`, test pages under `app/`, scratch rows).
- `git status` — stage only intended files; migrations belong with their feature commit.
- Update `docs/*.md` for the feature area; `CLAUDE.md` only for global rules.
- Commit message describes behavior + verification; push to `main` per project practice.
