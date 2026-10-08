"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { toast } from "sonner";
import {
  Plus,
  Tag,
  X,
  Loader2,
  MapPin,
  CreditCard,
  Banknote,
  Check,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { trackClient } from "@/components/storefront/behavior-tracker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AddressForm,
  type AddressData,
} from "@/components/account/address-form";
import { CartEmpty } from "@/components/storefront/cart/cart-empty";
import { OrderTotals } from "@/components/storefront/cart/order-totals";
import { StickyTotalBar } from "@/components/storefront/cart/sticky-total-bar";
import { useViewportPosition } from "@/components/storefront/use-viewport-position";
import { useCart } from "@/lib/store/cart";
import { useHydrated } from "@/lib/use-hydrated";
import { formatPrice } from "@/lib/format";
import {
  computeBreakdown,
  PRICING_DEFAULTS,
  type PriceBreakdown,
  type PricingSettings,
} from "@/lib/pricing";
import {
  applyCoupon,
  createOrder,
  previewOrderPricing,
  verifyPayment,
} from "@/lib/actions/checkout";

type RazorpayResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  order_id: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (response: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

type AppliedCoupon = { code: string; discount: number };
type PaymentMethod = "RAZORPAY" | "COD";

export function CheckoutClient({
  addresses,
  razorpayEnabled,
  userName,
  settings = PRICING_DEFAULTS,
}: {
  addresses: AddressData[];
  razorpayEnabled: boolean;
  userName: string;
  settings?: PricingSettings;
}) {
  const router = useRouter();
  const items = useCart((s) => s.items);
  const clearCart = useCart((s) => s.clear);

  const mounted = useHydrated();
  // Seeded from props, not only the effect below: effect-scheduled updates can
  // wait on the pricing server action, leaving no address picked for seconds.
  const [selectedId, setSelectedId] = useState<string>(addresses[0]?.id ?? "");
  const [addressOpen, setAddressOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponPending, startCoupon] = useTransition();
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("RAZORPAY");
  const [codAvailable, setCodAvailable] = useState(false);

  // Keep a valid address selected as the list changes (e.g. after adding one).
  useEffect(() => {
    if (addresses.length === 0) return;
    setSelectedId((prev) =>
      prev && addresses.some((a) => a.id === prev) ? prev : addresses[0].id,
    );
  }, [addresses]);

  const payload = useMemo(
    () => items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    [items],
  );

  // Optimistic client breakdown; corrected by the server (authoritative re-price
  // from the DB, so admin delivery/GST and coupon values always win).
  const optimistic = computeBreakdown(
    items.map((i) => ({
      unitPrice: i.price,
      quantity: i.quantity,
      gstRate: i.gstRate,
      deliveryCharge: i.deliveryCharge,
    })),
    settings,
    coupon?.discount ?? 0,
  );

  const payloadKey = JSON.stringify(payload);
  const couponCode = coupon?.code;
  // Keyed by what it priced: a response for an older cart/coupon/payment method
  // must never outrank the instant optimistic figures for the current one.
  const pricingKey = `${payloadKey}|${couponCode ?? ""}|${paymentMethod}`;
  const [server, setServer] = useState<{ key: string; breakdown: PriceBreakdown } | null>(null);
  useEffect(() => {
    if (payload.length === 0) {
      setServer(null);
      setCodAvailable(false);
      return;
    }
    let active = true;
    void previewOrderPricing({ items: payload, couponCode, paymentMethod }).then((res) => {
      if (!active || !res.ok) return;
      setServer({ key: pricingKey, breakdown: res.breakdown });
      setCodAvailable(res.codAvailable);
      // If COD became unavailable (e.g. cart changed), fall back to online.
      if (!res.codAvailable && paymentMethod === "COD") setPaymentMethod("RAZORPAY");
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey, couponCode, paymentMethod]);

  const breakdown = server?.key === pricingKey ? server.breakdown : optimistic;
  const { codFee, total } = breakdown;

  // The sticky pay bar shows whenever the summary's pay button is off screen.
  const ctaRef = useRef<HTMLButtonElement>(null);
  const showSticky = useViewportPosition(ctaRef, mounted && items.length > 0) !== "visible";

  if (!mounted) {
    return <div className="h-72 animate-pulse rounded-xl bg-muted" />;
  }

  if (items.length === 0) {
    return <CartEmpty description="Add something wholesome before checking out." />;
  }

  function onApplyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    startCoupon(async () => {
      const res = await applyCoupon({ code, items: payload });
      if (res.ok) {
        setCoupon({ code: res.code, discount: res.discount });
        toast.success(`Coupon ${res.code} applied`);
      } else {
        setCoupon(null);
        toast.error(res.error);
      }
    });
  }

  async function onPlaceOrder() {
    if (!selectedId) {
      toast.error("Please select a delivery address.");
      return;
    }
    setPlacing(true);
    // Journey-funnel "Payment" stage — the shopper committed to paying.
    trackClient({ type: "PAYMENT_START", path: "/checkout" });
    const res = await createOrder({
      items: payload,
      addressId: selectedId,
      couponCode: coupon?.code,
      paymentMethod,
    });

    if (!res.ok) {
      toast.error(res.error);
      setPlacing(false);
      return;
    }

    // COD or keyless / mock flow — order already placed server-side.
    if (res.cod || res.mock || !res.razorpay) {
      clearCart();
      router.push(`/checkout/success?order=${res.orderNumber}`);
      return;
    }

    // Live Razorpay flow.
    const rzp = res.razorpay;
    if (!window.Razorpay) {
      toast.error("Payment library failed to load. Please retry.");
      setPlacing(false);
      return;
    }
    const checkout = new window.Razorpay({
      key: rzp.keyId,
      amount: rzp.amount,
      currency: rzp.currency,
      name: rzp.name,
      description: rzp.description,
      ...(rzp.image ? { image: rzp.image } : {}),
      order_id: rzp.razorpayOrderId,
      prefill: rzp.prefill,
      theme: { color: rzp.themeColor },
      handler: (response) => {
        void (async () => {
          const verify = await verifyPayment({
            orderId: rzp.orderId,
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          if (verify.ok) {
            clearCart();
            router.push(`/checkout/success?order=${verify.orderNumber}`);
          } else {
            toast.error(verify.error);
            setPlacing(false);
          }
        })();
      },
      modal: {
        ondismiss: () => {
          setPlacing(false);
          toast("Payment cancelled — your order is saved as pending.");
        },
      },
    });
    checkout.open();
  }

  const placeLabel =
    paymentMethod === "RAZORPAY" && razorpayEnabled
      ? `Pay ${formatPrice(total)}`
      : `Place order · ${formatPrice(total)}`;
  const placeDisabled = placing || addresses.length === 0;
  const itemCount = items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div>
      {razorpayEnabled && (
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      )}

      <CheckoutSteps />

      {/* One column below lg in reading order — address, payment, summary + pay,
          then the item review. From lg the steps sit left of a sticky summary
          (the left wrapper only becomes a box at lg; below it, `contents` lets
          `order` interleave its sections with the summary). */}
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12 xl:gap-16">
        <div className="contents lg:block lg:space-y-12">
          <section aria-labelledby="checkout-address" className="order-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <StepHeading id="checkout-address" n={1}>
                Delivery address
              </StepHeading>
              {addresses.length > 0 && (
                <Button
                  variant="outline"
                  className="h-11 gap-1.5 rounded-lg border-foreground/30 bg-transparent px-4"
                  onClick={() => setAddressOpen(true)}
                >
                  <Plus className="size-4" /> Add new address
                </Button>
              )}
            </div>

            {addresses.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-5 py-8 text-center">
                <MapPin className="mx-auto size-6 text-muted-foreground" strokeWidth={1.5} />
                <p className="mt-3 text-sm text-muted-foreground">
                  Add a delivery address to continue.
                </p>
                <Button className="mt-4 h-11 gap-1.5 rounded-lg px-5" onClick={() => setAddressOpen(true)}>
                  <Plus className="size-4" /> Add address
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="checkout-address">
                {addresses.map((a) => (
                  <label key={a.id} className={choiceCard(selectedId === a.id)}>
                    <input
                      type="radio"
                      name="address"
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                      checked={selectedId === a.id}
                      onChange={() => setSelectedId(a.id)}
                    />
                    <span className="min-w-0 text-sm">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium">
                        {a.fullName}
                        <span className="rounded bg-oat px-1.5 py-0.5 text-xs font-semibold uppercase tracking-[0.1em] text-oat-foreground">
                          {a.type}
                        </span>
                      </span>
                      <span className="mt-1 block text-muted-foreground [overflow-wrap:anywhere]">
                        {a.line1}
                        {a.line2 ? `, ${a.line2}` : ""}
                        <br />
                        {a.city}, {a.state} {a.pincode}
                      </span>
                      <span className="mt-1 block text-muted-foreground">{a.phone}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <section aria-labelledby="checkout-payment" className="order-2">
            <StepHeading id="checkout-payment" n={2} className="mb-4">
              Payment method
            </StepHeading>
            <div className="grid gap-3 sm:grid-cols-2" role="radiogroup" aria-labelledby="checkout-payment">
              <label className={choiceCard(paymentMethod === "RAZORPAY")}>
                <input
                  type="radio"
                  name="payment"
                  className="mt-0.5 size-4 shrink-0 accent-primary"
                  checked={paymentMethod === "RAZORPAY"}
                  onChange={() => setPaymentMethod("RAZORPAY")}
                />
                <span className="min-w-0 text-sm">
                  <span className="flex items-center gap-2 font-medium">
                    <CreditCard className="size-4 text-foreground/70" strokeWidth={1.75} />
                    {razorpayEnabled ? "Pay online" : "Pay online (demo)"}
                  </span>
                  <span className="mt-1 block text-muted-foreground">
                    UPI, cards, net banking &amp; wallets via Razorpay.
                  </span>
                </span>
              </label>
              {codAvailable && (
                <label className={choiceCard(paymentMethod === "COD")}>
                  <input
                    type="radio"
                    name="payment"
                    className="mt-0.5 size-4 shrink-0 accent-primary"
                    checked={paymentMethod === "COD"}
                    onChange={() => setPaymentMethod("COD")}
                  />
                  <span className="min-w-0 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <Banknote className="size-4 text-foreground/70" strokeWidth={1.75} /> Cash on Delivery
                    </span>
                    <span className="mt-1 block text-muted-foreground">
                      Pay in cash when your order arrives
                      {codFee > 0 ? ` · +${formatPrice(codFee)} fee` : ""}.
                    </span>
                  </span>
                </label>
              )}
            </div>
          </section>

          <section aria-labelledby="checkout-items" className="order-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <StepHeading id="checkout-items" n={3}>
                Review items
              </StepHeading>
              <Link
                href="/cart"
                className="inline-flex h-11 items-center px-1 text-sm font-medium underline underline-offset-4"
              >
                Edit cart
              </Link>
            </div>
            <ul className="divide-y divide-border border-b border-border">
              {items.map((item) => (
                <li key={item.variantId} className="flex items-center gap-4 py-4">
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-oat">
                    {item.image && (
                      <Image src={item.image} alt="" fill sizes="64px" className="object-cover" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="line-clamp-2 font-medium leading-snug">{item.name}</p>
                    <p className="mt-0.5 text-muted-foreground">
                      {item.weightLabel} · Qty {item.quantity}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <aside
          aria-labelledby="checkout-summary"
          className="order-3 h-fit rounded-xl border border-border bg-card p-5 sm:p-6 lg:order-none lg:sticky lg:top-28"
        >
          <h2 id="checkout-summary" className="font-heading text-subheading">
            Order summary
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {itemCount} {itemCount === 1 ? "item" : "items"}
          </p>

          {/* Coupon */}
          <div className="mt-5">
            {coupon ? (
              <div className="flex items-center justify-between gap-2 rounded-lg bg-primary/[0.07] py-1 pr-1 pl-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 font-medium text-primary">
                  <Tag className="size-4 shrink-0" strokeWidth={1.75} />
                  <span className="truncate">{coupon.code} applied</span>
                </span>
                <button
                  type="button"
                  className="grid size-10 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => {
                    setCoupon(null);
                    setCouponInput("");
                  }}
                  aria-label={`Remove coupon ${coupon.code}`}
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <label htmlFor="checkout-coupon" className="sr-only">
                  Coupon code
                </label>
                <Input
                  id="checkout-coupon"
                  placeholder="Coupon code"
                  className="h-11 rounded-lg"
                  value={couponInput}
                  autoComplete="off"
                  onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && onApplyCoupon()}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 rounded-lg border-foreground/30 bg-transparent px-4"
                  onClick={onApplyCoupon}
                  disabled={couponPending || !couponInput.trim()}
                >
                  {couponPending ? <Loader2 className="size-4 animate-spin" aria-label="Applying" /> : "Apply"}
                </Button>
              </div>
            )}
          </div>

          <div className="mt-5 border-t border-border pt-5">
            <OrderTotals breakdown={breakdown} couponCode={coupon?.code} />
          </div>

          <Button
            ref={ctaRef}
            className="mt-6 h-12 w-full gap-2 rounded-lg text-[15px]"
            onClick={onPlaceOrder}
            disabled={placeDisabled}
          >
            {placing ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Processing…
              </>
            ) : (
              placeLabel
            )}
          </Button>
          {addresses.length === 0 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Add a delivery address to place your order.
            </p>
          )}
          <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" strokeWidth={1.75} /> 100% secure payments
          </p>
          {!razorpayEnabled && paymentMethod === "RAZORPAY" && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Demo mode — no payment gateway configured. Orders are simulated.
            </p>
          )}
        </aside>
      </div>

      <StickyTotalBar
        show={showSticky}
        total={total}
        note={paymentMethod === "COD" ? "Cash on Delivery" : undefined}
      >
        <Button
          className="h-12 w-full gap-2 rounded-lg text-[15px]"
          onClick={onPlaceOrder}
          disabled={placeDisabled}
        >
          {placing ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Processing…
            </>
          ) : paymentMethod === "RAZORPAY" && razorpayEnabled ? (
            "Pay now"
          ) : (
            "Place order"
          )}
        </Button>
      </StickyTotalBar>

      <Dialog open={addressOpen} onOpenChange={setAddressOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add delivery address</DialogTitle>
          </DialogHeader>
          <AddressForm
            address={{
              id: "",
              fullName: userName,
              phone: "",
              line1: "",
              line2: "",
              city: "",
              state: "",
              pincode: "",
              type: "HOME",
              isDefault: addresses.length === 0,
            }}
            onSuccess={() => {
              setAddressOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Selectable address / payment card — the whole card is the radio's label. */
function choiceCard(selected: boolean) {
  return cn(
    "flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
    selected ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/30",
  );
}

function StepHeading({
  id,
  n,
  className,
  children,
}: {
  id: string;
  n: number;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className={cn("flex items-center gap-3 font-heading text-subheading", className)}>
      <span
        aria-hidden
        className="grid size-7 shrink-0 place-items-center rounded-full bg-oat font-sans text-xs font-semibold text-oat-foreground"
      >
        {n}
      </span>
      {children}
    </h2>
  );
}

/** Presentational checkout progress — Cart (done) → Checkout (active) → Confirmation. */
function CheckoutSteps() {
  const steps = [
    { label: "Cart", state: "done" as const, href: "/cart" },
    { label: "Checkout", state: "active" as const, href: undefined },
    { label: "Confirmation", state: "upcoming" as const, href: undefined },
  ];
  return (
    <ol className="flex max-w-xl items-center gap-2 sm:gap-3" aria-label="Checkout progress">
      {steps.map((s, i) => {
        const label = (
          <>
            <span
              className={cn(
                "grid size-6 place-items-center rounded-full text-[11px] font-semibold",
                s.state === "done" && "bg-primary text-primary-foreground",
                s.state === "active" && "border border-primary text-primary",
                s.state === "upcoming" && "border border-border text-muted-foreground",
              )}
            >
              {s.state === "done" ? <Check className="size-3.5" aria-hidden /> : i + 1}
            </span>
            <span
              className={cn(
                "text-sm",
                s.state === "active" ? "font-medium text-foreground" : "text-muted-foreground",
                s.state === "upcoming" && "max-sm:sr-only",
              )}
            >
              {s.label}
              {s.state === "done" && <span className="sr-only"> (completed)</span>}
            </span>
          </>
        );
        return (
          <Fragment key={s.label}>
            <li className="flex items-center gap-2" aria-current={s.state === "active" ? "step" : undefined}>
              {s.href ? (
                <Link href={s.href} className="flex min-h-11 items-center gap-2 hover:underline hover:underline-offset-4">
                  {label}
                </Link>
              ) : (
                label
              )}
            </li>
            {i < steps.length - 1 && (
              <li aria-hidden className={cn("h-px flex-1", s.state === "done" ? "bg-primary/40" : "bg-border")} />
            )}
          </Fragment>
        );
      })}
    </ol>
  );
}
