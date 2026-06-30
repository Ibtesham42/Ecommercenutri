"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Script from "next/script";
import { toast } from "sonner";
import {
  ShoppingBag,
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
import { useCart } from "@/lib/store/cart";
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

  const [mounted, setMounted] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [addressOpen, setAddressOpen] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  const [couponPending, startCoupon] = useTransition();
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("RAZORPAY");
  const [codAvailable, setCodAvailable] = useState(false);

  useEffect(() => setMounted(true), []);

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
  const [server, setServer] = useState<PriceBreakdown | null>(null);
  useEffect(() => {
    if (payload.length === 0) {
      setServer(null);
      setCodAvailable(false);
      return;
    }
    let active = true;
    void previewOrderPricing({ items: payload, couponCode, paymentMethod }).then((res) => {
      if (!active || !res.ok) return;
      setServer(res.breakdown);
      setCodAvailable(res.codAvailable);
      // If COD became unavailable (e.g. cart changed), fall back to online.
      if (!res.codAvailable && paymentMethod === "COD") setPaymentMethod("RAZORPAY");
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payloadKey, couponCode, paymentMethod]);

  const { subtotal, shipping, shippingSaved, codFee, tax, total, discount } =
    server ?? optimistic;

  if (!mounted) {
    return <div className="h-72 animate-pulse rounded-xl bg-muted" />;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-16 text-center">
        <ShoppingBag className="mx-auto size-12 text-muted-foreground/40" />
        <p className="mt-4 text-lg font-semibold">Your cart is empty</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Add something wholesome before checking out.
        </p>
        <Button asChild className="mt-6">
          <Link href="/products">Browse products</Link>
        </Button>
      </div>
    );
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

  const placeLabel = placing
    ? "Processing…"
    : paymentMethod === "COD" || !razorpayEnabled
      ? `Place order · ${formatPrice(total)}`
      : `Pay ${formatPrice(total)}`;

  return (
    <div className="space-y-6">
      {razorpayEnabled && (
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      )}

      <CheckoutSteps />

      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      {/* Left: address + items */}
      <div className="space-y-8">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <MapPin className="size-4 text-primary" /> Delivery address
            </h2>
            <Button
              className="h-9 gap-1.5 px-4 shadow-sm"
              onClick={() => setAddressOpen(true)}
            >
              <Plus className="size-4" /> Add new address
            </Button>
          </div>

          {addresses.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              Add a delivery address to continue.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {addresses.map((a) => (
                <label
                  key={a.id}
                  className={`cursor-pointer rounded-xl border p-4 transition ${
                    selectedId === a.id
                      ? "border-primary ring-1 ring-primary"
                      : "hover:border-foreground/20"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="radio"
                      name="address"
                      className="mt-1 size-4 accent-primary"
                      checked={selectedId === a.id}
                      onChange={() => setSelectedId(a.id)}
                    />
                    <div className="text-sm">
                      <p className="font-medium">
                        {a.fullName}
                        <span className="ml-2 text-xs uppercase text-muted-foreground">
                          {a.type}
                        </span>
                      </p>
                      <p className="text-muted-foreground">
                        {a.line1}
                        {a.line2 ? `, ${a.line2}` : ""}
                        <br />
                        {a.city}, {a.state} {a.pincode}
                      </p>
                      <p className="text-muted-foreground">{a.phone}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 font-semibold">Order items ({items.length})</h2>
          <ul className="space-y-3">
            {items.map((item) => (
              <li key={item.variantId} className="flex gap-3 rounded-xl border p-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-accent/30">
                  {item.image && (
                    <Image
                      src={item.image}
                      alt={item.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  )}
                </div>
                <div className="flex flex-1 items-center justify-between">
                  <div className="text-sm">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.weightLabel} · Qty {item.quantity}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Right: summary */}
      <aside className="h-fit space-y-4 rounded-2xl border p-5 shadow-elev-1 lg:sticky lg:top-24">
        <h2 className="font-semibold">Order summary</h2>

        {/* Coupon */}
        <div>
          {coupon ? (
            <div className="flex items-center justify-between rounded-lg bg-primary/10 px-3 py-2 text-sm">
              <span className="flex items-center gap-1.5 font-medium text-primary">
                <Tag className="size-3.5" /> {coupon.code}
              </span>
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => {
                  setCoupon(null);
                  setCouponInput("");
                }}
                aria-label="Remove coupon"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Coupon code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && onApplyCoupon()}
              />
              <Button
                type="button"
                variant="outline"
                onClick={onApplyCoupon}
                disabled={couponPending || !couponInput.trim()}
              >
                {couponPending ? <Loader2 className="size-4 animate-spin" /> : "Apply"}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t pt-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span className="font-medium">{formatPrice(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-primary">
              <span>Discount</span>
              <span className="font-medium">−{formatPrice(discount)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery</span>
            <span className={shipping === 0 ? "font-semibold text-primary" : "font-medium"}>
              {shipping === 0 ? "Free Delivery" : formatPrice(shipping)}
            </span>
          </div>
          {shipping === 0 && shippingSaved > 0 && (
            <p className="text-xs font-medium text-primary">
              You saved {formatPrice(shippingSaved)} on shipping
            </p>
          )}
          {codFee > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Cash on Delivery fee</span>
              <span className="font-medium">{formatPrice(codFee)}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatPrice(total)}</span>
          </div>
          {tax > 0 && (
            <p className="text-xs text-muted-foreground">
              Inclusive of GST {formatPrice(tax)}
            </p>
          )}
        </div>

        {/* Payment method */}
        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-semibold">Payment method</p>
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${
              paymentMethod === "RAZORPAY" ? "border-primary ring-1 ring-primary" : "hover:border-foreground/20"
            }`}
          >
            <input
              type="radio"
              name="payment"
              className="mt-0.5 size-4 accent-primary"
              checked={paymentMethod === "RAZORPAY"}
              onChange={() => setPaymentMethod("RAZORPAY")}
            />
            <span>
              <span className="flex items-center gap-1.5 font-medium">
                <CreditCard className="size-4 text-primary" />
                {razorpayEnabled ? "Pay online" : "Pay online (demo)"}
              </span>
              <span className="block text-xs text-muted-foreground">
                UPI, cards, net banking &amp; wallets via Razorpay.
              </span>
            </span>
          </label>
          {codAvailable && (
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm transition ${
                paymentMethod === "COD" ? "border-primary ring-1 ring-primary" : "hover:border-foreground/20"
              }`}
            >
              <input
                type="radio"
                name="payment"
                className="mt-0.5 size-4 accent-primary"
                checked={paymentMethod === "COD"}
                onChange={() => setPaymentMethod("COD")}
              />
              <span>
                <span className="flex items-center gap-1.5 font-medium">
                  <Banknote className="size-4 text-primary" /> Cash on Delivery
                </span>
                <span className="block text-xs text-muted-foreground">
                  Pay in cash when your order arrives
                  {settings && codFee > 0 ? ` · +${formatPrice(codFee)} fee` : ""}.
                </span>
              </span>
            </label>
          )}
        </div>

        <Button
          size="lg"
          className="w-full"
          onClick={onPlaceOrder}
          disabled={placing || addresses.length === 0}
        >
          {placing ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Processing…
            </>
          ) : paymentMethod === "COD" ? (
            `Place order · ${formatPrice(total)}`
          ) : razorpayEnabled ? (
            `Pay ${formatPrice(total)}`
          ) : (
            `Place order · ${formatPrice(total)}`
          )}
        </Button>
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-primary" /> 100% secure payments
        </div>
        {!razorpayEnabled && paymentMethod === "RAZORPAY" && (
          <p className="text-center text-xs text-muted-foreground">
            Demo mode — no payment gateway configured. Orders are simulated.
          </p>
        )}
      </aside>
      </div>

      {/* Sticky mobile place-order bar (bottom nav hidden on /checkout). */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur md:hidden"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <Button
          size="lg"
          className="h-12 w-full gap-2 text-base"
          onClick={onPlaceOrder}
          disabled={placing || addresses.length === 0}
        >
          {placing && <Loader2 className="size-4 animate-spin" />}
          {placeLabel}
        </Button>
      </div>

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

/** Presentational checkout progress — Cart (done) → Checkout (active) → Confirmation. */
function CheckoutSteps() {
  const steps = [
    { label: "Cart", state: "done" as const },
    { label: "Checkout", state: "active" as const },
    { label: "Confirmation", state: "upcoming" as const },
  ];
  return (
    <ol className="flex items-center gap-2 sm:gap-3">
      {steps.map((s, i) => (
        <Fragment key={s.label}>
          <li className="flex items-center gap-2">
            <span
              className={cn(
                "grid size-7 place-items-center rounded-full border text-xs font-bold",
                s.state === "done" && "border-primary bg-primary text-primary-foreground",
                s.state === "active" && "border-primary bg-primary/10 text-primary",
                s.state === "upcoming" && "border-border text-muted-foreground",
              )}
            >
              {s.state === "done" ? <Check className="size-4" /> : i + 1}
            </span>
            <span
              className={cn(
                "text-sm font-medium",
                s.state === "upcoming" ? "text-muted-foreground" : "text-foreground",
                s.state === "upcoming" && "hidden sm:inline",
              )}
            >
              {s.label}
            </span>
          </li>
          {i < steps.length - 1 && (
            <span
              className={cn(
                "h-px flex-1",
                s.state === "done" ? "bg-primary/40" : "bg-border",
              )}
            />
          )}
        </Fragment>
      ))}
    </ol>
  );
}
