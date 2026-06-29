import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { Input } from "@/components/ui/input";
import { ReviewTable, type ReviewRow } from "@/components/admin/review-table";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Reviews", robots: { index: false } };

const FILTERS = [
  { label: "All", value: "" },
  { label: "Approved", value: "approved" },
  { label: "Hidden", value: "hidden" },
];

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await guardSection("products");
  const { status = "", q = "" } = await searchParams;

  const where: Prisma.ReviewWhereInput = {
    ...(status === "approved" ? { isApproved: true } : status === "hidden" ? { isApproved: false } : {}),
    ...(q
      ? {
          OR: [
            { comment: { contains: q, mode: "insensitive" } },
            { title: { contains: q, mode: "insensitive" } },
            { product: { name: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const reviews = await prisma.review.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      rating: true,
      title: true,
      comment: true,
      isApproved: true,
      createdAt: true,
      product: { select: { name: true, slug: true } },
      user: { select: { name: true, email: true } },
    },
  });

  const rows: ReviewRow[] = reviews.map((r) => ({
    id: r.id,
    productName: r.product.name,
    productSlug: r.product.slug,
    customer: r.user.name ?? r.user.email ?? "—",
    rating: r.rating,
    title: r.title,
    comment: r.comment,
    isApproved: r.isApproved,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader
        title="Reviews"
        description={`${reviews.length} review${reviews.length === 1 ? "" : "s"}`}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/reviews${f.value ? `?status=${f.value}` : ""}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition hover:bg-accent",
              status === f.value && "border-primary bg-primary/10 text-primary",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <form action="/admin/reviews" className="mb-4 max-w-sm">
        {status && <input type="hidden" name="status" value={status} />}
        <Input name="q" placeholder="Search product, customer or text…" defaultValue={q} />
      </form>

      <ReviewTable reviews={rows} />
    </div>
  );
}
