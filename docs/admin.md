# Admin — RBAC, Conventions, Bulk Actions

> Part of the [Nutriyet docs](../CLAUDE.md#documentation-index). The repeatable
> "add an admin module" workflow is the `admin-module` skill (`.claude/skills/`).

## Roles & permissions (RBAC)

- **Two admin roles** (`Role` enum): `SUPER_ADMIN` (main admin — full access, manages
  admins + store settings + own credentials) and `ADMIN` (sub-admin — access limited to
  the sections in `User.permissions`). `USER` is a customer.
- **Permission keys** (`lib/permissions.ts`): `products, stories, orders, returns,
  categories, coupons, inventory, customers, ai, appearance, affiliates, marketing`.
  A sub-admin only reaches a section if its key is in their `permissions` array; super
  admins always pass. Dashboard + Settings are available to every admin (dashboard only
  renders widgets the admin may see).
- **Enforcement is layered & DB-fresh** (a stale JWT can't grant access):
  - `middleware.ts` — coarse gate: any admin (`ADMIN`/`SUPER_ADMIN`) may enter `/admin`.
  - `lib/auth.ts#getAdminUser` — loads role + permissions from the DB for the session user
    (null if not an admin or `isActive=false`). All admin authz derives from this.
  - Pages: `guardSection("key")` (`lib/admin-guard.ts`) redirects unauthorized sub-admins
    to `/admin`. Super-admin-only pages (`/admin/admins`, store settings) check `isSuperAdmin`.
  - Server actions: `requirePermission("key")` / `requireSuperAdmin()` (throw `FORBIDDEN`).
  - Nav (`components/admin/admin-nav.tsx`) filters items by the same permissions.
- **Admin management** (`/admin/admins`, SUPER_ADMIN only): create/edit/activate/delete
  sub-admins (name, login email, password, phone, contact email, address, photo,
  permission checkboxes). Guards: can't delete/deactivate self or a super admin; emails
  unique; deactivated admins can't sign in (checked in the credentials `authorize`).
- **Self-service + store settings** (`/admin/settings`): any admin can change their own
  email + password; SUPER_ADMIN edits `StoreSetting` (support email/phone, address,
  socials, announcement). Storefront footer reads `getStoreSettings()` (DB) with a
  `config/site.ts` fallback.

## Action & form conventions

- Admin actions live in `lib/actions/admin/*`, start with `await requirePermission(...)`,
  and return the shared `AdminResult<T>` (`{ ok: true, data? } | { ok: false, error }`,
  from `lib/actions/admin/types`). Zod schemas in `lib/validations/admin.ts`.
- Forms are RHF client components that call the action and toast the result (`sonner`).
  Prices are entered in **rupees** in the UI and converted to **paise** before the call;
  the server schema validates paise authoritatively.
- Numeric knobs use **native `<input type="range" … className="accent-primary">`** with
  the live value in the `<Label>` (shadcn Slider exists but is unused).
- Reordering uses **native HTML5 DnD** + a `reorder(ids[])` server action (no DnD library).
- After writes, call the module's `revalidate()` helper (`revalidatePath` of the admin
  page + affected storefront paths).
- Live previews render the **real storefront component** with a `toPreview(watch())`
  adapter (see showcase/hero managers).

## Bulk actions (shared foundation)

- `useBulkSelection(ids)` (`lib/admin/use-bulk-selection.ts`, prunes stale ids), the
  floating `<BulkBar>` (`components/admin/bulk/bulk-bar.tsx`, built-in confirm dialog for
  destructive actions; optional `children` slot for inline controls like the Orders status
  `<select>`), `toastBulk` (`lib/admin/run-bulk.ts`) and client-side `downloadCsv`
  (`lib/admin/csv-export.ts`).
- Each module exposes one `bulk<Entity>Action(ids, action)` server action returning
  `AdminResult<BulkOutcome>` (`{ done, skipped, note? }`) that **reuses the existing
  single-record guards**.
- **Delete policy = deactivate (reversible) + safe hard-delete only** (no soft-delete
  column): categories with products and coupons used by orders are skipped/deactivated;
  customers are deleted only with zero orders (else deactivated; scoped to `role:USER`).
- Wired into: Products, Categories, Coupons, Customers, Messages, Affiliates, Orders
  (status update via `bulkUpdateOrderStatus`/`transitionOrderStatus`, sequential invoice
  PDF download, CSV export, shipping-label stub), Returns (approve/reject/mark-refunded
  via `bulkReturnAction`; bulk refund settles to the original method, skips COD/manual),
  Stories/Hero/Banners (publish/unpublish/delete), Reviews (`/admin/reviews`, `products`
  permission — approve/hide via `isApproved` + delete + export; recomputes the product
  rating aggregate) and Notifications (`/admin/notifications`, `customers` permission —
  bulk mark read/unread/delete).
- To add a module: drop checkboxes + `<BulkBar>` into its client table and add a
  `bulk<Entity>Action`.

## Consumer Survey admin

- `/admin/survey` (`customers` permission): copy/open **share-link** card (the only place
  the `/survey` URL surfaces), KPIs (total / last-7d / opt-in % / cities),
  responses-over-time bars, per-question counts + percentages, top cities, expandable raw
  responses and CSV export at `/admin/survey/export`. See `docs/growth.md` for the
  public-side details.
