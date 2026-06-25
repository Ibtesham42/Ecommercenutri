"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, Controller } from "react-hook-form";
import { Plus, Pencil, Trash2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ImageUploadField } from "@/components/admin/image-upload-field";
import {
  ADMIN_PERMISSIONS,
  PERMISSION_LABELS,
  DEFAULT_SUB_ADMIN_PERMISSIONS,
  type Permission,
} from "@/lib/permissions";
import {
  createAdmin,
  updateAdmin,
  setAdminActive,
  deleteAdmin,
} from "@/lib/actions/admin/admins";

export type AdminRow = {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  contactEmail: string | null;
  address: string | null;
  image: string | null;
  role: "ADMIN" | "SUPER_ADMIN";
  permissions: string[];
  isActive: boolean;
};

type FormValues = {
  name: string;
  email: string;
  password: string;
  phone: string;
  contactEmail: string;
  address: string;
  image: string;
  permissions: Permission[];
};

export function AdminManager({
  admins,
  cloudinaryReady,
}: {
  admins: AdminRow[];
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [saving, setSaving] = useState(false);

  const { register, handleSubmit, control, reset, watch, setValue } =
    useForm<FormValues>({ defaultValues: { permissions: [] } });
  const selected = watch("permissions") ?? [];

  function openAdd() {
    setEditing(null);
    reset({
      name: "",
      email: "",
      password: "",
      phone: "",
      contactEmail: "",
      address: "",
      image: "",
      permissions: DEFAULT_SUB_ADMIN_PERMISSIONS,
    });
    setOpen(true);
  }
  function openEdit(a: AdminRow) {
    setEditing(a);
    reset({
      name: a.name ?? "",
      email: a.email,
      password: "",
      phone: a.phone ?? "",
      contactEmail: a.contactEmail ?? "",
      address: a.address ?? "",
      image: a.image ?? "",
      permissions: a.permissions.filter((p): p is Permission =>
        (ADMIN_PERMISSIONS as readonly string[]).includes(p),
      ),
    });
    setOpen(true);
  }

  function togglePerm(p: Permission, on: boolean) {
    const next = on ? [...selected, p] : selected.filter((x) => x !== p);
    setValue("permissions", [...new Set(next)]);
  }

  async function onSubmit(v: FormValues) {
    setSaving(true);
    const res = editing
      ? await updateAdmin({
          id: editing.id,
          name: v.name,
          password: v.password,
          phone: v.phone,
          contactEmail: v.contactEmail,
          address: v.address,
          image: v.image,
          permissions: v.permissions,
        })
      : await createAdmin({
          name: v.name,
          email: v.email,
          password: v.password,
          phone: v.phone,
          contactEmail: v.contactEmail,
          address: v.address,
          image: v.image,
          permissions: v.permissions,
        });
    setSaving(false);
    if (res.ok) {
      toast.success(editing ? "Sub-admin updated" : "Sub-admin created");
      setOpen(false);
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  function onToggleActive(a: AdminRow) {
    setAdminActive(a.id, !a.isActive).then((res) => {
      if (res.ok) {
        toast.success(a.isActive ? "Deactivated" : "Activated");
        router.refresh();
      } else toast.error(res.error);
    });
  }
  function onDelete(a: AdminRow) {
    if (!confirm(`Delete sub-admin "${a.name ?? a.email}"? This cannot be undone.`)) return;
    deleteAdmin(a.id).then((res) => {
      if (res.ok) {
        toast.success("Sub-admin removed");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button className="gap-1.5" onClick={openAdd}>
          <Plus className="size-4" /> Add sub-admin
        </Button>
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Access</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((a) => {
              const isSuper = a.role === "SUPER_ADMIN";
              return (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{a.email}</TableCell>
                  <TableCell>
                    {isSuper ? (
                      <Badge className="gap-1 bg-primary/10 text-primary hover:bg-primary/10">
                        <ShieldCheck className="size-3.5" /> Main admin
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Sub-admin</Badge>
                    )}
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    {isSuper ? (
                      <span className="text-sm text-muted-foreground">Full access</span>
                    ) : a.permissions.length ? (
                      <span className="text-xs text-muted-foreground">
                        {a.permissions
                          .map((p) => PERMISSION_LABELS[p as Permission] ?? p)
                          .join(", ")}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Dashboard only</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isSuper ? (
                      <Badge variant="secondary">Owner</Badge>
                    ) : (
                      <Switch checked={a.isActive} onCheckedChange={() => onToggleActive(a)} />
                    )}
                  </TableCell>
                  <TableCell>
                    {!isSuper && (
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(a)} aria-label="Edit">
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => onDelete(a)}
                          aria-label="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit sub-admin" : "Add sub-admin"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="aname">Name</Label>
                <Input id="aname" {...register("name", { required: true })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aphone">Phone</Label>
                <Input id="aphone" {...register("phone")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="aemail">Login email</Label>
                <Input
                  id="aemail"
                  type="email"
                  {...register("email", { required: !editing })}
                  disabled={!!editing}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="acontact">Contact email</Label>
                <Input id="acontact" type="email" {...register("contactEmail")} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="apassword">
                  Password {editing && <span className="text-muted-foreground">(leave blank to keep)</span>}
                </Label>
                <Input
                  id="apassword"
                  type="password"
                  autoComplete="new-password"
                  {...register("password", { required: !editing })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="aaddress">Address</Label>
                <Input id="aaddress" {...register("address")} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Photo (optional)</Label>
                <Controller
                  control={control}
                  name="image"
                  render={({ field }) => (
                    <ImageUploadField
                      value={field.value}
                      onChange={field.onChange}
                      cloudinaryReady={cloudinaryReady}
                      folder="admins"
                    />
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Permissions</Label>
              <p className="text-xs text-muted-foreground">
                Choose which admin sections this person can access. The dashboard is
                always visible.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {ADMIN_PERMISSIONS.map((p) => (
                  <label
                    key={p}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border p-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={selected.includes(p)}
                      onChange={(e) => togglePerm(p, e.target.checked)}
                    />
                    {PERMISSION_LABELS[p]}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                {saving && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save changes" : "Create sub-admin"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
