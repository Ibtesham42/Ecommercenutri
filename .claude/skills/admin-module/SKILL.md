---
name: admin-module
description: Add or extend a Nutriyet admin section end-to-end (RBAC guard, AdminResult server actions, Zod, manager UI, bulk actions, nav). Use when creating a new /admin page, adding CRUD for a new model, or wiring bulk actions into an existing admin table.
---

# Add / extend a Nutriyet admin module

Follow the existing conventions exactly — every admin module in this repo is built the
same way. Reference implementations: **hero** (`app/admin/hero`, `lib/actions/admin/hero.ts`,
`components/admin/hero-slider-manager.tsx`) for CRUD+reorder+preview; **coupons** for
simple CRUD; **survey** for a read/analytics module.

## Checklist

1. **Permission.** Pick an existing key from `lib/permissions.ts` (`products, stories,
   orders, returns, categories, coupons, inventory, customers, ai, appearance,
   affiliates, marketing`). Only add a new key if genuinely a new domain (it must be
   added to `PERMISSIONS`, the admin-editor checkboxes, and existing admins' arrays).

2. **Model / config.**
   - List-like data → new additive Prisma model + migration named after the feature
     (`npx prisma migrate dev --name <feature>`). Money = Int paise. Index FKs.
   - Singleton config → additive `StoreSetting` column, or a JSON blob resolved by a
     client-safe `lib/<feature>.ts` (Blob type → `Required<Blob>` → DEFAULTS → pure
     `resolve(blob: unknown)` → `get<Feature>Settings()` with defaults-on-error; see
     `lib/growth-settings.ts` / `lib/hero-reveal.ts`).
   - Neon cold start: first connection can throw P1001 — retry once.

3. **Validation.** Zod schema in `lib/validations/admin.ts` (or a feature file). Inputs
   typed `unknown` server-side; prices validated in paise; enums derived from the
   feature catalog when one exists.

4. **Server actions** in `lib/actions/admin/<feature>.ts`:
   - `"use server"`; every action starts `await requirePermission("<key>")`.
   - Return `AdminResult<T>` (`{ ok: true, data? } | { ok: false, error }`) from
     `lib/actions/admin/types`. First Zod issue message on parse failure.
   - Shared `revalidate()` helper: admin path + affected storefront paths
     (`revalidatePath("/", "layout")` when storefront-visible).
   - Slug/code uniqueness enforced; deletes follow the policy: deactivate (reversible) +
     safe hard-delete only (refuse/deactivate when referenced by orders etc.).
   - Replaced Cloudinary media → `destroyAssetByUrl` (guarded against shared URLs,
     `nutriyet/` namespace only).

5. **Page** `app/admin/<feature>/page.tsx` (server): `await guardSection("<key>")`,
   fetch via `Promise.all`, map dates → ISO strings, pass
   `cloudinaryReady={isConfigured.cloudinary()}` if uploads are involved.
   `metadata: { robots: { index: false } }`.

6. **Manager UI** `components/admin/<feature>-manager.tsx` (client):
   - Record CRUD → RHF + Dialog editor; flat settings card → useState (growth-manager
     pattern). Toast `AdminResult` via sonner, then `router.refresh()`.
   - Prices entered in rupees, converted to paise before the action call.
   - Numeric knobs: native `<input type="range" className="… accent-primary">` with the
     live value in the `<Label>`. Reorder: native HTML5 DnD + `reorder(ids[])` action.
   - Media: `ImageUploadField` (direct signed Cloudinary upload + URL-paste fallback,
     per-feature `folder`).
   - Live preview renders the REAL storefront component via a `toPreview(values)`
     adapter (hero/showcase pattern).
   - Cards: `rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5`.

7. **Bulk actions** (for tables): `useBulkSelection(ids)` + `<BulkBar>`
   (`components/admin/bulk/bulk-bar.tsx`) + one `bulk<Entity>Action(ids, action)`
   returning `AdminResult<BulkOutcome>` that reuses the single-record guards; toast via
   `toastBulk`. CSV: client `downloadCsv` or an export route using `lib/csv.ts#toCsv`
   guarded by `requirePermission`.

8. **Nav.** Add the item to `components/admin/admin-nav.tsx` with the same permission key.

9. **Docs.** Update the relevant `docs/*.md`; touch `CLAUDE.md` only if a global
   convention changed.

10. **Verify** with the `verify-release` skill (typecheck, lint, build, smoke) before
    committing.
