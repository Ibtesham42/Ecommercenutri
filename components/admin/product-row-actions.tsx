"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MoreHorizontal, Pencil, Trash2, Eye, EyeOff, Star, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  deleteProduct,
  duplicateProduct,
  toggleProductFlag,
} from "@/lib/actions/admin/products";

export function ProductRowActions({
  id,
  slug,
  isActive,
  isFeatured,
}: {
  id: string;
  slug: string;
  isActive: boolean;
  isFeatured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);

  function toggle(flag: "isActive" | "isFeatured", value: boolean, label: string) {
    startTransition(async () => {
      const res = await toggleProductFlag(id, flag, value);
      if (res.ok) {
        toast.success(label);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onDuplicate() {
    startTransition(async () => {
      const res = await duplicateProduct(id);
      if (res.ok) {
        toast.success("Duplicated as a draft — opening the copy");
        router.push(`/admin/products/${res.data!.id}`);
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function onDelete() {
    startTransition(async () => {
      const res = await deleteProduct(id);
      setConfirmOpen(false);
      if (res.ok) {
        toast.success("Product deleted");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Actions" disabled={pending}>
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href={`/admin/products/${id}`}>
              <Pencil className="size-4" /> Edit
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href={`/products/${slug}`} target="_blank">
              <Eye className="size-4" /> View
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDuplicate}>
            <Copy className="size-4" /> Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => toggle("isActive", !isActive, isActive ? "Unpublished" : "Published")}
          >
            {isActive ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            {isActive ? "Unpublish" : "Publish"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              toggle("isFeatured", !isFeatured, isFeatured ? "Unfeatured" : "Featured")
            }
          >
            <Star className={isFeatured ? "size-4 fill-primary text-primary" : "size-4"} />
            {isFeatured ? "Unfeature" : "Feature"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the product and its variants and images. Orders
              already placed keep their snapshots. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                onDelete();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
