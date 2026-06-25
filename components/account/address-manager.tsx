"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, MapPin, Pencil, Trash2, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AddressForm, type AddressData } from "@/components/account/address-form";
import { deleteAddress, setDefaultAddress } from "@/lib/actions/account";

export function AddressManager({ addresses }: { addresses: AddressData[] }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AddressData | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function openAdd() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(a: AddressData) {
    setEditing(a);
    setOpen(true);
  }
  function onDelete(id: string) {
    startTransition(async () => {
      await deleteAddress(id);
      router.refresh();
      toast.success("Address removed");
    });
  }
  function onSetDefault(id: string) {
    startTransition(async () => {
      await setDefaultAddress(id);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Saved addresses</h2>
        <Button size="sm" className="gap-1.5" onClick={openAdd}>
          <Plus className="size-4" /> Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <MapPin className="mx-auto size-10 text-muted-foreground/40" />
          <p className="mt-3 text-sm text-muted-foreground">
            No addresses saved yet.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {addresses.map((a) => (
            <div key={a.id} className="rounded-xl border p-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase text-muted-foreground">
                  {a.type}
                </span>
                {a.isDefault && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary">
                    Default
                  </Badge>
                )}
              </div>
              <p className="mt-2 text-sm font-medium">{a.fullName}</p>
              <p className="text-sm text-muted-foreground">
                {a.line1}
                {a.line2 ? `, ${a.line2}` : ""}
                <br />
                {a.city}, {a.state} {a.pincode}
              </p>
              <p className="text-sm text-muted-foreground">{a.phone}</p>

              <div className="mt-3 flex flex-wrap gap-2">
                {!a.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1 px-2 text-xs"
                    onClick={() => onSetDefault(a.id)}
                  >
                    <Check className="size-3.5" /> Set default
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => openEdit(a)}
                >
                  <Pencil className="size-3.5" /> Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => onDelete(a.id)}
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit address" : "Add address"}</DialogTitle>
          </DialogHeader>
          <AddressForm
            key={editing?.id ?? "new"}
            address={editing}
            onSuccess={() => {
              setOpen(false);
              router.refresh();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
