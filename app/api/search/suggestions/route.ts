import { NextResponse } from "next/server";
import { searchProducts, minVariantPrice } from "@/lib/queries/products";
import { formatPrice } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Lightweight product suggestions for the header search typeahead. */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ suggestions: [] });

  try {
    const products = await searchProducts(q, 6);
    const suggestions = products.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      category: p.category.name,
      image: p.images[0]?.url ?? null,
      price: formatPrice(minVariantPrice(p.variants) ?? 0),
    }));
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
