import { NextResponse } from "next/server";
import { getQuickViewProduct } from "@/lib/queries/products";

export const dynamic = "force-dynamic";

/** Trimmed product payload for the product-card Quick View modal (opened
 *  on demand, client-side — not part of any RSC render). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const product = await getQuickViewProduct(id);
    if (!product) return NextResponse.json({ product: null }, { status: 404 });
    return NextResponse.json({ product });
  } catch {
    return NextResponse.json({ product: null }, { status: 500 });
  }
}
