"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Loader2, Pause, Pencil, Play, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteSpinCampaign, saveSpinCampaign, setSpinCampaignActive, verifySpinEligibility } from "@/lib/actions/admin/spin";
import { APPROVED_ELIGIBILITY, DEFAULT_PRIZES, approvedSuggestionFor, type PrizeTier } from "@/lib/spin/config";
import { downloadCsv } from "@/lib/admin/csv-export";
import { probabilities, productCandidates } from "@/lib/spin/selection";
import { formatDateTime, formatPrice, paiseToRupees, rupeesToPaise } from "@/lib/format";

type SaleMode = "STACK" | "BEST_OF" | "EXCLUDE";

/** One eligible variant exactly as the catalogue has it now (verification table). */
export type SpinEligibleVariant = {
  variantId: string;
  productId: string;
  productName: string;
  weightLabel: string;
  grams: number | null;
  stock: number;
  price: number;
  active: boolean;
  /** Approved-list entry this looks like — a hint for the reviewer, never the rule. */
  suggestion: string | null;
};

export type SpinCampaignRow = {
  id: string;
  name: string;
  isActive: boolean;
  startsAt: string | null;
  endsAt: string | null;
  prizes: PrizeTier[];
  eligibleVariantIds: string[];
  minStock: number;
  weightCap: number;
  claimWindowHours: number;
  offerValidDays: number;
  maxClaims: number | null;
  claimCount: number;
  minOrder: number | null;
  maxDiscount: number | null;
  saleMode: SaleMode;
  eligible: SpinEligibleVariant[];
  verification: {
    verified: boolean;
    verifiedAt: string | null;
    verifiedBy: string | null;
    missing: string[]; // verified variants that no longer exist
    changed: string[]; // verified variants whose product/size changed
    renamed: string[]; // name-only changes (informational)
    unlisted: number; // listed IDs not found in the catalogue
  };
  stats: {
    spins: number;
    pending: number;
    claimed: number;
    redeemed: number;
    expired: number;
    byPercent: { percent: number; count: number }[];
  };
};

export type SpinVariantOption = {
  id: string;
  productId: string;
  productName: string;
  weightLabel: string;
  weightInGrams: number | null;
  stock: number;
  active: boolean;
  onSale: boolean;
  /** Claimed-but-unused offers on this variant's product (reserved stock). */
  productReserved: number;
};

const SALE_MODES: { value: SaleMode; label: string; hint: string }[] = [
  { value: "BEST_OF", label: "Best of (recommended)", hint: "Customer pays the lower of the sale price and the offer price from MRP — never both." },
  { value: "EXCLUDE", label: "Skip sale items", hint: "Items already on sale get no extra discount." },
  { value: "STACK", label: "Stack on sale price", hint: "Offer % is taken off the current sale price." },
];

type FormState = {
  id?: string;
  name: string;
  isActive: boolean;
  startsAt: string; // datetime-local
  endsAt: string;
  prizes: { percent: string; weight: string }[];
  eligibleVariantIds: string[];
  minStock: string;
  weightCap: string;
  claimWindowHours: string;
  offerValidDays: string;
  maxClaims: string;
  minOrder: string; // rupees
  maxDiscount: string; // rupees
  saleMode: SaleMode;
};

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toForm(c: SpinCampaignRow | null): FormState {
  if (!c) {
    return {
      name: "Spin & Win",
      isActive: false,
      startsAt: "",
      endsAt: "",
      prizes: DEFAULT_PRIZES.map((p) => ({ percent: String(p.percent), weight: String(p.weight) })),
      // Nothing pre-selected: the admin ticks exact variants, then verifies them.
      eligibleVariantIds: [],
      minStock: "5",
      weightCap: "200",
      claimWindowHours: "24",
      offerValidDays: "7",
      maxClaims: "",
      minOrder: "",
      maxDiscount: "",
      saleMode: "BEST_OF",
    };
  }
  return {
    id: c.id,
    name: c.name,
    isActive: c.isActive,
    startsAt: toLocalInput(c.startsAt),
    endsAt: toLocalInput(c.endsAt),
    prizes: c.prizes.map((p) => ({ percent: String(p.percent), weight: String(p.weight) })),
    eligibleVariantIds: c.eligibleVariantIds,
    minStock: String(c.minStock),
    weightCap: String(c.weightCap),
    claimWindowHours: String(c.claimWindowHours),
    offerValidDays: String(c.offerValidDays),
    maxClaims: c.maxClaims == null ? "" : String(c.maxClaims),
    minOrder: c.minOrder == null ? "" : String(paiseToRupees(c.minOrder)),
    maxDiscount: c.maxDiscount == null ? "" : String(paiseToRupees(c.maxDiscount)),
    saleMode: c.saleMode,
  };
}

const int = (v: string) => Math.round(Number(v));
const optInt = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));
const optPaise = (v: string) => (v.trim() === "" ? null : rupeesToPaise(Number(v)));

function campaignState(c: SpinCampaignRow): { label: string; tone: "default" | "secondary" | "outline" } {
  const now = Date.now();
  if (!c.isActive) return { label: "Paused", tone: "outline" };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: "Scheduled", tone: "secondary" };
  if (c.endsAt && new Date(c.endsAt).getTime() <= now) return { label: "Ended", tone: "outline" };
  if (c.maxClaims != null && c.claimCount >= c.maxClaims) return { label: "All claimed", tone: "outline" };
  return { label: "Live", tone: "default" };
}

export function SpinManager({
  campaigns,
  variants,
}: {
  campaigns: SpinCampaignRow[];
  variants: SpinVariantOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<FormState | null>(null);
  const [verifying, setVerifying] = useState<SpinCampaignRow | null>(null);
  const [pending, start] = useTransition();

  function act(fn: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.success(success);
        router.refresh();
      } else toast.error(res.error ?? "Something went wrong.");
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-muted-foreground">
          The prize product is drawn server-side, weighted by live stock above the reserve; the discount tier by
          its weight. Only one campaign should be live at a time — the newest live one is used. A campaign can
          only be enabled after its exact eligible variants are verified against the live catalogue.
        </p>
        <Button onClick={() => setEditing(toForm(null))} className="gap-1.5">
          <Plus className="size-4" /> New campaign
        </Button>
      </div>

      {campaigns.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
          No campaigns yet. Create one (paused), tick the exact eligible variants, verify them, then enable it.
        </div>
      )}

      {campaigns.map((c) => {
        const state = campaignState(c);
        return (
          <div key={c.id} className="rounded-2xl border bg-card p-4 shadow-elev-1 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">{c.name}</h2>
                  <Badge variant={state.tone}>{state.label}</Badge>
                  {c.verification.verified && c.verification.missing.length + c.verification.changed.length === 0 ? (
                    <Badge variant="secondary" className="gap-1">
                      <ShieldCheck className="size-3.5" /> Eligibility verified
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="size-3.5" />
                      {c.verification.verified ? "Catalogue changed — re-verify" : "Needs verification"}
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {c.startsAt ? formatDateTime(c.startsAt) : "No start date"} →{" "}
                  {c.endsAt ? formatDateTime(c.endsAt) : "no end date"} · {c.eligibleVariantIds.length} eligible
                  variants · tiers {c.prizes.map((p) => `${p.percent}%`).join(" / ")}
                </p>
                {c.verification.verifiedAt && (
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Verified by {c.verification.verifiedBy ?? "an admin"} on {formatDateTime(c.verification.verifiedAt)}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setVerifying(c)}>
                  <ShieldCheck className="size-4" /> Verify eligibility
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={pending || (!c.isActive && !c.verification.verified)}
                  title={!c.isActive && !c.verification.verified ? "Verify the eligible products first" : undefined}
                  onClick={() =>
                    act(() => setSpinCampaignActive(c.id, !c.isActive), c.isActive ? "Campaign paused" : "Campaign enabled")
                  }
                >
                  {c.isActive ? <Pause className="size-4" /> : <Play className="size-4" />}
                  {c.isActive ? "Pause" : "Enable"}
                </Button>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(toForm(c))}>
                  <Pencil className="size-4" /> Edit
                </Button>
                {c.stats.spins === 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-destructive"
                    disabled={pending}
                    onClick={() => {
                      if (window.confirm(`Delete "${c.name}"? It has never been played.`)) {
                        act(() => deleteSpinCampaign(c.id), "Campaign deleted");
                      }
                    }}
                  >
                    <Trash2 className="size-4" /> Delete
                  </Button>
                )}
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-6">
              {(
                [
                  ["Spins", c.stats.spins],
                  ["Awaiting sign-in", c.stats.pending],
                  ["Claimed", c.stats.claimed],
                  ["Redeemed", c.stats.redeemed],
                  ["Expired", c.stats.expired],
                  c.maxClaims != null
                    ? ["Claims / cap", `${c.claimCount} / ${c.maxClaims}`]
                    : ["Claims (no cap)", c.claimCount],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="bg-card px-3 py-2.5">
                  <dt className="truncate text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
                </div>
              ))}
            </dl>
            {(c.stats.byPercent.length > 0 || c.stats.claimed > 0) && (
              <p className="mt-2.5 text-xs text-muted-foreground">
                {c.stats.byPercent.length > 0 &&
                  `Awarded: ${c.stats.byPercent.map((p) => `${p.percent}% × ${p.count}`).join(", ")}`}
                {c.stats.byPercent.length > 0 && c.stats.claimed > 0 && " · "}
                {c.stats.claimed > 0 &&
                  `Redemption rate ${Math.round((c.stats.redeemed / c.stats.claimed) * 100)}%`}
              </p>
            )}
          </div>
        );
      })}

      <Dialog open={verifying !== null} onOpenChange={(o) => !o && setVerifying(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Verify eligible products{verifying ? ` — ${verifying.name}` : ""}</DialogTitle>
          </DialogHeader>
          {verifying && (
            <VerifyEligibility
              campaign={verifying}
              onDone={() => {
                setVerifying(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Edit campaign" : "New campaign"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <CampaignEditor
              initial={editing}
              variants={variants}
              onDone={() => {
                setEditing(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CampaignEditor({
  initial,
  variants,
  onDone,
}: {
  initial: FormState;
  variants: SpinVariantOption[];
  onDone: () => void;
}) {
  const [f, setF] = useState<FormState>(initial);
  const [query, setQuery] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [saving, start] = useTransition();
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setF((s) => ({ ...s, [k]: v }));

  const selected = useMemo(() => new Set(f.eligibleVariantIds), [f.eligibleVariantIds]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, { productName: string; items: SpinVariantOption[] }>();
    for (const v of variants) {
      if (q && !`${v.productName} ${v.weightLabel}`.toLowerCase().includes(q)) continue;
      if (selectedOnly && !selected.has(v.id)) continue;
      const g = map.get(v.productId) ?? { productName: v.productName, items: [] };
      g.items.push(v);
      map.set(v.productId, g);
    }
    return [...map.values()];
  }, [variants, query, selectedOnly, selected]);

  // Live preview with the exact selection maths the server uses.
  const preview = useMemo(() => {
    const cands = productCandidates(
      variants.map((v) => ({
        variantId: v.id,
        productId: v.productId,
        stock: v.stock,
        variantActive: v.active,
        productActive: v.active,
      })),
      {
        eligibleVariantIds: f.eligibleVariantIds,
        minStock: int(f.minStock) || 0,
        weightCap: int(f.weightCap) || 1,
        reserved: new Map(variants.map((v) => [v.productId, v.productReserved])),
      },
    );
    const probs = probabilities(cands);
    const names = new Map(variants.map((v) => [v.productId, v.productName]));
    return cands
      .map((c, i) => ({ name: names.get(c.productId) ?? c.productId, sizes: c.variantIds.length, p: probs[i] }))
      .sort((a, b) => b.p - a.p);
  }, [variants, f.eligibleVariantIds, f.minStock, f.weightCap]);

  const tierWeights = f.prizes.map((p) => Math.max(0, int(p.weight) || 0));
  const tierTotal = tierWeights.reduce((a, b) => a + b, 0);
  // Same rules the server enforces (lib/validations/spin.ts) — shown inline as you type.
  const tierPercents = f.prizes.map((p) => int(p.percent));
  const tierProblem =
    tierTotal === 0
      ? "At least one tier needs a weight above 0."
      : new Set(tierPercents).size !== tierPercents.length
        ? "Each tier needs a different discount %."
        : tierPercents.some((p) => !Number.isFinite(p) || p < 1 || p > 50)
          ? "Discounts must be between 1% and 50%."
          : null;

  function toggle(id: string, on: boolean) {
    set("eligibleVariantIds", on ? [...f.eligibleVariantIds, id] : f.eligibleVariantIds.filter((x) => x !== id));
  }

  function save() {
    start(async () => {
      const res = await saveSpinCampaign({
        id: f.id,
        name: f.name,
        isActive: f.isActive,
        startsAt: f.startsAt ? new Date(f.startsAt).toISOString() : null,
        endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : null,
        prizes: f.prizes.map((p) => ({ percent: int(p.percent), weight: int(p.weight) })),
        eligibleVariantIds: f.eligibleVariantIds,
        minStock: int(f.minStock),
        weightCap: int(f.weightCap),
        claimWindowHours: int(f.claimWindowHours),
        offerValidDays: int(f.offerValidDays),
        maxClaims: optInt(f.maxClaims),
        minOrder: optPaise(f.minOrder),
        maxDiscount: optPaise(f.maxDiscount),
        saleMode: f.saleMode,
      });
      if (res.ok) {
        toast.success("Campaign saved");
        onDone();
      } else toast.error(res.error);
    });
  }

  const field = "space-y-1.5";
  const sectionTitle = "text-sm font-semibold text-foreground";

  return (
    <div className="space-y-7">
      <section className="grid gap-4 sm:grid-cols-2">
        <div className={`${field} sm:col-span-2`}>
          <Label htmlFor="spin-name">Campaign name</Label>
          <Input id="spin-name" value={f.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className={field}>
          <Label htmlFor="spin-start">Starts (optional)</Label>
          <Input id="spin-start" type="datetime-local" value={f.startsAt} onChange={(e) => set("startsAt", e.target.value)} />
        </div>
        <div className={field}>
          <Label htmlFor="spin-end">Ends (optional)</Label>
          <Input id="spin-end" type="datetime-local" value={f.endsAt} onChange={(e) => set("endsAt", e.target.value)} />
        </div>
        <label className="flex items-center gap-3 sm:col-span-2">
          <Switch checked={f.isActive} onCheckedChange={(v) => set("isActive", v)} />
          <span className="text-sm">
            Enabled (live within its dates)
            <span className="block text-xs text-muted-foreground">
              Only possible once the eligible products are verified — save it paused first.
            </span>
          </span>
        </label>
      </section>

      <section className="border-t pt-6">
        <h3 className={sectionTitle}>Prize tiers</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          The discount shown on the wheel and how often it&apos;s drawn. Weight 0 hides a tier.
        </p>
        <table className="mt-3 w-full max-w-md text-sm">
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="pb-1.5 font-medium">Discount %</th>
              <th scope="col" className="pb-1.5 font-medium">Weight</th>
              <th scope="col" className="pb-1.5 text-right font-medium">Chance</th>
              <th scope="col" className="w-10 pb-1.5"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {f.prizes.map((p, i) => (
              <tr key={i}>
                <td className="py-1 pr-2">
                  <Input id={`tier-p-${i}`} type="number" min={1} max={50} value={p.percent} aria-label={`Tier ${i + 1} discount %`}
                    className="h-9 w-24 tabular-nums"
                    onChange={(e) => set("prizes", f.prizes.map((x, j) => (j === i ? { ...x, percent: e.target.value } : x)))} />
                </td>
                <td className="py-1 pr-2">
                  <Input id={`tier-w-${i}`} type="number" min={0} max={1000} value={p.weight} aria-label={`Tier ${i + 1} weight`}
                    className="h-9 w-24 tabular-nums"
                    onChange={(e) => set("prizes", f.prizes.map((x, j) => (j === i ? { ...x, weight: e.target.value } : x)))} />
                </td>
                <td className="py-1 text-right tabular-nums text-muted-foreground">
                  {tierTotal > 0 ? `${((tierWeights[i] / tierTotal) * 100).toFixed(1)}%` : "—"}
                </td>
                <td className="py-1 text-right">
                  {f.prizes.length > 2 && (
                    <Button type="button" size="icon" variant="ghost" className="size-9" aria-label={`Remove ${p.percent || "this"}% tier`}
                      onClick={() => set("prizes", f.prizes.filter((_, j) => j !== i))}>
                      <X className="size-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {tierProblem && <p role="alert" className="mt-2 text-xs text-destructive">{tierProblem}</p>}
        {f.prizes.length < 8 && (
          <Button type="button" size="sm" variant="outline" className="mt-3 gap-1.5"
            onClick={() => set("prizes", [...f.prizes, { percent: "", weight: "10" }])}>
            <Plus className="size-4" /> Add tier
          </Button>
        )}
      </section>

      <section className="grid gap-4 border-t pt-6 sm:grid-cols-3">
        <h3 className={`${sectionTitle} sm:col-span-3`}>Rules &amp; limits</h3>
        <div className={`${field} sm:col-span-3`}>
          <Label htmlFor="spin-sale">With items already on sale</Label>
          <select id="spin-sale" value={f.saleMode} onChange={(e) => set("saleMode", e.target.value as SaleMode)}
            className="h-9 w-full rounded-md border bg-transparent px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {SALE_MODES.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
          </select>
          <p className="text-xs text-muted-foreground">{SALE_MODES.find((m) => m.value === f.saleMode)?.hint}</p>
        </div>
        <NumberField id="spin-min-stock" label="Stock reserve (never offer at/below)" value={f.minStock} onChange={(v) => set("minStock", v)} />
        <NumberField id="spin-cap" label="Stock weight cap" value={f.weightCap} onChange={(v) => set("weightCap", v)} />
        <NumberField id="spin-max-claims" label="Max claims (blank = no cap)" value={f.maxClaims} onChange={(v) => set("maxClaims", v)} />
        <NumberField id="spin-window" label="Claim window (hours)" value={f.claimWindowHours} onChange={(v) => set("claimWindowHours", v)} />
        <NumberField id="spin-validity" label="Offer valid (days)" value={f.offerValidDays} onChange={(v) => set("offerValidDays", v)} />
        <div />
        <NumberField id="spin-min-order" label="Min. order ₹ (optional)" value={f.minOrder} onChange={(v) => set("minOrder", v)} />
        <NumberField id="spin-max-disc" label="Max. discount ₹ (optional)" value={f.maxDiscount} onChange={(v) => set("maxDiscount", v)} />
      </section>

      <section className="border-t pt-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className={sectionTitle}>Eligible products ({f.eligibleVariantIds.length} variants)</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Stored by exact variant ID — tick each product size yourself; nothing is selected automatically.
              &ldquo;Approved list?&rdquo; labels are name-based hints only. Changing this list clears the
              verification, so the campaign stays off until the new list is verified.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input className="h-9 sm:flex-1" placeholder="Search products…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search products" />
          <label className="flex h-9 shrink-0 items-center gap-2 text-sm">
            <Switch checked={selectedOnly} onCheckedChange={setSelectedOnly} aria-label="Show selected variants only" />
            Selected only
          </label>
        </div>
        <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border">
          {groups.map((g) => (
            <div key={g.productName + g.items[0]?.id} className="border-b p-3 last:border-b-0">
              <p className="text-sm font-medium">{g.productName}</p>
              <div className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1.5">
                {g.items.map((v) => (
                  <label key={v.id} className="flex min-h-8 items-center gap-2 text-sm">
                    <Checkbox checked={selected.has(v.id)} onCheckedChange={(on) => toggle(v.id, on === true)} />
                    <span>{v.weightLabel}</span>
                    <span className={`text-xs tabular-nums ${v.stock <= (int(f.minStock) || 0) ? "text-destructive" : "text-muted-foreground"}`}>
                      {v.stock} in stock
                    </span>
                    {v.onSale && <span className="text-xs text-muted-foreground">· on sale</span>}
                    {approvedSuggestionFor(v.productName, v.weightLabel, v.weightInGrams) && (
                      <span className="text-xs text-muted-foreground">· approved list?</span>
                    )}
                    {!v.active && <span className="text-xs text-destructive">· inactive</span>}
                  </label>
                ))}
              </div>
            </div>
          ))}
          {groups.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              {selectedOnly && f.eligibleVariantIds.length === 0 ? "No variants selected yet." : "No products match."}
            </p>
          )}
        </div>
      </section>

      <section className="border-t pt-6">
        <h3 className={sectionTitle}>Prize product chances (live stock)</h3>
        {preview.length === 0 ? (
          <p className="mt-2 text-sm text-destructive">No selected variant has stock above the reserve — the wheel would not spin.</p>
        ) : (
          <ul className="mt-2 divide-y rounded-xl border text-sm">
            {preview.map((p) => (
              <li key={p.name} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0 truncate">{p.name} <span className="text-xs text-muted-foreground">({p.sizes} size{p.sizes > 1 ? "s" : ""})</span></span>
                <span className="tabular-nums">{(p.p * 100).toFixed(1)}%</span>
              </li>
            ))}
          </ul>
        )}
        {f.minOrder && <p className="mt-2 text-xs text-muted-foreground">Min. order {formatPrice(optPaise(f.minOrder) ?? 0)} applies to the whole order value.</p>}
      </section>

      {/* Sticky save bar: always reachable in a long form. */}
      <div className="sticky bottom-0 -mx-4 -mb-4 flex items-center justify-between gap-3 border-t bg-popover/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-popover/85">
        <p className="min-w-0 truncate text-xs text-muted-foreground">
          {f.eligibleVariantIds.length} variant{f.eligibleVariantIds.length === 1 ? "" : "s"} · {f.prizes.length} tiers
          {f.isActive ? " · enabled" : " · paused"}
        </p>
        <Button onClick={save} disabled={saving || Boolean(tierProblem)} className="shrink-0 gap-1.5">
          {saving && <Loader2 className="size-4 animate-spin" />} Save campaign
        </Button>
      </div>
    </div>
  );
}

function NumberField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

/**
 * Explicit, recorded check of the exact mapping against the live catalogue.
 * Shows every selected variant with its IDs and size, how it lines up with the
 * business-approved list (hints), and anything that changed since a previous
 * verification. Verifying never enables the campaign.
 */
function VerifyEligibility({ campaign: c, onDone }: { campaign: SpinCampaignRow; onDone: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [saving, start] = useTransition();
  const v = c.verification;
  const offList = c.eligible.filter((e) => !e.suggestion);
  const checklist = APPROVED_ELIGIBILITY.map((a) => ({
    label: a.label,
    sizes: a.grams.map((g) => (g >= 1000 ? `${g / 1000} kg` : `${g} g`)).join(", "),
    matches: c.eligible.filter((e) => e.suggestion === a.label),
  }));

  function exportCsv() {
    downloadCsv(
      `spin-eligibility-${c.id}`,
      ["Product", "Size", "Grams", "Variant ID", "Product ID", "Stock", "Price (₹)", "Active", "Approved list hint"],
      c.eligible.map((e) => [
        e.productName,
        e.weightLabel,
        e.grams == null ? "" : String(e.grams),
        e.variantId,
        e.productId,
        String(e.stock),
        String(paiseToRupees(e.price)),
        e.active ? "yes" : "no",
        e.suggestion ?? "not on approved list",
      ]),
    );
  }

  function verify() {
    start(async () => {
      const res = await verifySpinEligibility({ id: c.id, variantIds: c.eligibleVariantIds, confirmed });
      if (res.ok) {
        toast.success("Eligibility verified. Enable the campaign when you're ready.");
        onDone();
      } else toast.error(res.error);
    });
  }

  const problems = [
    ...v.missing.map((m) => `No longer in the catalogue: ${m}`),
    ...v.changed.map((m) => `Product or size changed: ${m}`),
    ...(v.unlisted > 0 ? [`${v.unlisted} selected variant ID(s) don't exist any more — edit the campaign to remove them.`] : []),
  ];

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Check every row against the live catalogue — the product, the size and the variant ID. Only these exact
        variants can ever be offered, and only while their product and size stay as verified. Verifying doesn&apos;t
        enable the campaign.
      </p>

      {v.verifiedAt && (
        <p className="text-sm">
          Last verified by {v.verifiedBy ?? "an admin"} on {formatDateTime(v.verifiedAt)}
          {v.verified ? "." : " — the eligible list has changed since, so it needs verifying again."}
        </p>
      )}
      {(problems.length > 0 || v.renamed.length > 0) && (
        <ul className="space-y-1 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          {problems.map((p) => (
            <li key={p} className="text-destructive">{p}</li>
          ))}
          {v.renamed.map((r) => (
            <li key={r} className="text-muted-foreground">Renamed (same product and size): {r}</li>
          ))}
        </ul>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">Selected variants ({c.eligible.length})</h3>
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={exportCsv} disabled={c.eligible.length === 0}>
            <Download className="size-4" /> Download CSV
          </Button>
        </div>
        <div className="mt-2 overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Product</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Variant ID</th>
                <th className="px-3 py-2 font-medium">Product ID</th>
                <th className="px-3 py-2 text-right font-medium">Stock</th>
                <th className="px-3 py-2 font-medium">Approved list (hint)</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {c.eligible.map((e) => (
                <tr key={e.variantId}>
                  <td className="px-3 py-2">
                    {e.productName}
                    {!e.active && <span className="ml-1 text-xs text-destructive">(inactive)</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    {e.weightLabel}
                    {e.grams != null && <span className="text-xs text-muted-foreground"> · {e.grams} g</span>}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{e.variantId}</td>
                  <td className="px-3 py-2 font-mono text-xs">{e.productId}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.stock}</td>
                  <td className={`px-3 py-2 text-xs ${e.suggestion ? "text-muted-foreground" : "text-destructive"}`}>
                    {e.suggestion ?? "Not on the approved list — check"}
                  </td>
                </tr>
              ))}
              {c.eligible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-muted-foreground">No eligible variants selected. Edit the campaign first.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {offList.length > 0 && (
          <p className="mt-2 text-xs text-destructive">
            {offList.length} selected variant{offList.length > 1 ? "s don't" : " doesn't"} look like the approved list.
            Keep {offList.length > 1 ? "them" : "it"} only if that&apos;s intended.
          </p>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold">Approved list checklist (name hints)</h3>
        <ul className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
          {checklist.map((a) => (
            <li key={a.label} className="rounded-lg border px-3 py-2">
              <span className="font-medium">{a.label}</span>{" "}
              <span className="text-xs text-muted-foreground">({a.sizes})</span>
              <div className={`text-xs ${a.matches.length ? "text-muted-foreground" : "text-destructive"}`}>
                {a.matches.length
                  ? a.matches.map((m) => `${m.productName} ${m.weightLabel}`).join(" · ")
                  : "No selected variant looks like this item"}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <label className="flex items-start gap-3 rounded-xl border p-3 text-sm">
        <Checkbox checked={confirmed} onCheckedChange={(on) => setConfirmed(on === true)} className="mt-0.5" />
        <span>
          I checked each product, size and variant ID above against the live catalogue, and these are exactly the
          variants this campaign may offer.
        </span>
      </label>

      <div className="flex justify-end gap-2 border-t pt-4">
        <Button onClick={verify} disabled={!confirmed || saving || c.eligible.length === 0} className="gap-1.5">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />} Record verification
        </Button>
      </div>
    </div>
  );
}
