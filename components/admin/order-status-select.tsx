"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateOrderStatus } from "@/lib/actions/admin/orders";
import {
  ADMIN_STATUS_OPTIONS,
  ORDER_STATUS_LABEL,
  statusLabel,
} from "@/lib/order-status";

export function OrderStatusSelect({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onChange(next: string) {
    if (next === status) return;
    startTransition(async () => {
      const res = await updateOrderStatus({ orderId, status: next });
      if (res.ok) {
        toast.success(`Order marked ${statusLabel(next as never).toLowerCase()}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <Select value={status} onValueChange={onChange} disabled={pending}>
      <SelectTrigger className="w-48">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ADMIN_STATUS_OPTIONS.map((s) => (
          <SelectItem key={s} value={s}>
            {ORDER_STATUS_LABEL[s]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
