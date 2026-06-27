"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Loader2,
  Search,
  PackageCheck,
  Package,
  Truck,
  Home,
  CircleCheck,
  XCircle,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { trackOrder, type TrackedOrder } from "@/lib/actions/track";
import { trackOrderSchema, type TrackOrderInput } from "@/lib/validations/contact";

const STEPS = [
  { key: "PENDING", label: "Placed", icon: PackageCheck },
  { key: "PROCESSING", label: "Processing", icon: Package },
  { key: "SHIPPED", label: "Shipped", icon: Truck },
  { key: "DELIVERED", label: "Delivered", icon: Home },
] as const;

const STEP_INDEX: Record<TrackedOrder["status"], number> = {
  PENDING: 0,
  PAID: 1,
  PROCESSING: 1,
  SHIPPED: 2,
  DELIVERED: 3,
  CANCELLED: -1,
  REFUNDED: -1,
};

function Timeline({ order }: { order: TrackedOrder }) {
  const current = STEP_INDEX[order.status];

  if (current < 0) {
    const refunded = order.status === "REFUNDED";
    return (
      <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
        {refunded ? (
          <AlertCircle className="size-6 text-destructive" />
        ) : (
          <XCircle className="size-6 text-destructive" />
        )}
        <div>
          <p className="font-semibold">{refunded ? "Order refunded" : "Order cancelled"}</p>
          <p className="text-sm text-muted-foreground">
            {refunded
              ? "This order was refunded. Any payment has been returned to your original method."
              : "This order was cancelled. If this is unexpected, please contact support."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <ol className="flex items-center">
      {STEPS.map((step, i) => {
        const done = i <= current;
        const isCurrent = i === current;
        const Icon = isCurrent && order.status === "DELIVERED" ? CircleCheck : step.icon;
        return (
          <li key={step.key} className="flex flex-1 flex-col items-center text-center last:flex-none">
            <div className="flex w-full items-center">
              <span
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full border-2 transition-colors",
                  done
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted bg-background text-muted-foreground",
                )}
              >
                <Icon className="size-5" />
              </span>
              {i < STEPS.length - 1 && (
                <span className={cn("h-0.5 flex-1", i < current ? "bg-primary" : "bg-muted")} />
              )}
            </div>
            <span
              className={cn(
                "mt-2 text-xs font-medium",
                done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Result({ order }: { order: TrackedOrder }) {
  return (
    <div className="space-y-6 rounded-2xl border p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">#{order.orderNumber}</p>
          <p className="text-xs text-muted-foreground">
            Placed {formatDate(order.placedAt)}
            {order.recipient ? ` · ${order.recipient}` : ""}
          </p>
        </div>
        <Badge variant={STEP_INDEX[order.status] < 0 ? "destructive" : "default"}>
          {order.status}
        </Badge>
      </div>

      <Timeline order={order} />

      <ul className="divide-y border-t pt-2">
        {order.items.map((item) => (
          <li key={item.id} className="flex gap-3 py-3">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-accent/30">
              {item.image && (
                <Image
                  src={item.image}
                  alt={item.name}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              )}
            </div>
            <div className="flex flex-1 items-center justify-between">
              <div className="text-sm">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.variantLabel} · Qty {item.quantity}
                </p>
              </div>
              <span className="text-sm font-semibold">{formatPrice(item.price * item.quantity)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-1.5 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatPrice(order.subtotal)}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between text-primary">
            <span>Discount {order.couponCode ? `(${order.couponCode})` : ""}</span>
            <span>−{formatPrice(order.discount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Delivery</span>
          <span className={order.shipping === 0 ? "font-semibold text-primary" : ""}>
            {order.shipping === 0 ? "Free Delivery" : formatPrice(order.shipping)}
          </span>
        </div>
        {order.shipping === 0 && order.shippingSaved > 0 && (
          <p className="text-xs font-medium text-primary">
            You saved {formatPrice(order.shippingSaved)} on shipping
          </p>
        )}
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>
        {order.tax > 0 && (
          <p className="text-xs text-muted-foreground">
            Inclusive of GST {formatPrice(order.tax)}
          </p>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Want full order history?{" "}
        <Link href="/account/orders" className="font-medium text-primary hover:underline">
          Sign in to your account
        </Link>
        .
      </p>
    </div>
  );
}

export function TrackOrderForm() {
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<TrackOrderInput>({
    resolver: zodResolver(trackOrderSchema),
    defaultValues: { orderNumber: "", email: "" },
  });

  async function onSubmit(values: TrackOrderInput) {
    setLoading(true);
    setError(null);
    const res = await trackOrder(values);
    setLoading(false);
    if (res.ok) {
      setOrder(res.order);
    } else {
      setOrder(null);
      setError(res.error);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 rounded-2xl border p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="orderNumber">Order number</Label>
            <Input id="orderNumber" placeholder="NUT-260625-A1B2C3" {...register("orderNumber")} />
            {errors.orderNumber && (
              <p className="text-xs text-destructive">{errors.orderNumber.message}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email used at checkout</Label>
            <Input id="email" type="email" autoComplete="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
        </div>
        <Button type="submit" disabled={loading} className="gap-2">
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          Track order
        </Button>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="size-5 shrink-0" />
          {error}
        </div>
      )}

      {order && <Result order={order} />}
    </div>
  );
}
