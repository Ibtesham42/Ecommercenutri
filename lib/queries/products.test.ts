import { describe, it, expect, vi } from "vitest";

/**
 * Regression tests for the catalog filter fix in `getProducts`:
 *  1. price + onSale/inStock used to overwrite each other (last `variants` key won);
 *  2. the price filter compared MRP instead of the selling price.
 * Prisma is mocked: a tiny evaluator applies the generated `where` to fixtures,
 * so the tests check what a filter actually matches, not just its shape.
 */

const MRP_FIELD = { __fieldRef: "price" };

type Variant = { price: number; discountPrice: number | null; stock: number; isActive: boolean };
type Product = {
  id: string;
  isActive: boolean;
  isBestSeller: boolean;
  ratingAvg: number;
  ratingCount: number;
  createdAt: Date;
  category: { slug: string };
  variants: Variant[];
};

type Where = Record<string, unknown>;

function matchNumber(value: number | null, filter: unknown, row: Variant): boolean {
  if (filter === null) return value === null;
  if (typeof filter === "number") return value === filter;
  const f = filter as Record<string, unknown>;
  const resolve = (x: unknown) => (x === MRP_FIELD ? row.price : (x as number));
  if (value === null) return false;
  if ("gt" in f && !(value > resolve(f.gt))) return false;
  if ("gte" in f && !(value >= resolve(f.gte))) return false;
  if ("lt" in f && !(value < resolve(f.lt))) return false;
  if ("lte" in f && !(value <= resolve(f.lte))) return false;
  return true;
}

function matchVariant(v: Variant, where: Where): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "AND") return (cond as Where[]).every((w) => matchVariant(v, w));
    if (key === "OR") return (cond as Where[]).some((w) => matchVariant(v, w));
    if (key === "isActive") return v.isActive === cond;
    if (key === "price" || key === "discountPrice" || key === "stock") return matchNumber(v[key], cond, v);
    throw new Error(`evaluator: unsupported variant key ${key}`);
  });
}

function matchProduct(p: Product, where: Where): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const c = cond as Record<string, unknown>;
    if (key === "isActive") return p.isActive === cond;
    if (key === "category") return p.category.slug === (c.slug as string);
    if (key === "ratingAvg") return p.ratingAvg >= (c.gte as number);
    if (key === "variants") return p.variants.some((v) => matchVariant(v, c.some as Where));
    throw new Error(`evaluator: unsupported product key ${key}`);
  });
}

let catalog: Product[] = [];

function findMany({ where, orderBy, skip = 0, take }: { where: Where; orderBy?: Record<string, "asc" | "desc">[]; skip?: number; take?: number }) {
  const rows = catalog.filter((p) => matchProduct(p, where));
  if (orderBy) {
    rows.sort((a, b) => {
      for (const o of orderBy) {
        const [k, dir] = Object.entries(o)[0] as [keyof Product, "asc" | "desc"];
        const av = Number(a[k] as number | boolean | Date), bv = Number(b[k] as number | boolean | Date);
        if (av !== bv) return dir === "desc" ? bv - av : av - bv;
      }
      return 0;
    });
  }
  return Promise.resolve(rows.slice(skip, take === undefined ? undefined : skip + take));
}

const prismaMock = {
  productVariant: { fields: { price: MRP_FIELD } },
  product: {
    count: vi.fn(({ where }: { where: Where }) => Promise.resolve(catalog.filter((p) => matchProduct(p, where)).length)),
    findMany: vi.fn(findMany),
  },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { getProducts } = await import("@/lib/queries/products");

let seq = 0;
function product(id: string, variants: Partial<Variant>[], extra: Partial<Product> = {}): Product {
  seq += 1;
  return {
    id,
    isActive: true,
    isBestSeller: false,
    ratingAvg: 0,
    ratingCount: 0,
    createdAt: new Date(2026, 0, seq), // later fixtures are newer
    category: { slug: "makhana" },
    variants: variants.map((v) => ({ price: 0, discountPrice: null, stock: 10, isActive: true, ...v })),
    ...extra,
  };
}

// Paise. Modelled on real catalog shapes.
const FIXTURES = [
  // MRP ₹275, sells at ₹189 — "Under ₹200" must include it (MRP filtering hid it).
  product("regular", [{ price: 27500, discountPrice: 18900, stock: 2 }]),
  // MRP ₹1,600, sells at ₹899, sold out — "Over ₹1000" must NOT include it.
  product("mango", [{ price: 160000, discountPrice: 89900, stock: 0 }], { category: { slug: "mango" } }),
  // Not on sale, ₹150, in stock.
  product("flour", [{ price: 15000, discountPrice: null, stock: 8 }], { category: { slug: "flours" } }),
  // Not on sale, ₹150, sold out.
  product("chilli", [{ price: 15000, discountPrice: null, stock: 0 }], { category: { slug: "spices" } }),
  // Discount not below MRP: sells at MRP ₹350.
  product("odd-discount", [{ price: 35000, discountPrice: 35000, stock: 5 }]),
  // Two sizes: cheap size sold out, expensive size in stock and on sale (₹449 from ₹750).
  product("rasogulla", [
    { price: 22900, discountPrice: 12500, stock: 0 },
    { price: 75000, discountPrice: 44900, stock: 4 },
  ], { isBestSeller: true, ratingAvg: 5, ratingCount: 3 }),
  // Big pack, sells at ₹2,999 (MRP ₹3,500), in stock.
  product("bulk", [{ price: 350000, discountPrice: 299900, stock: 3 }], { isBestSeller: true, ratingAvg: 4, ratingCount: 1 }),
  // An inactive cheap variant must never match.
  product("inactive-variant", [
    { price: 9900, discountPrice: null, stock: 50, isActive: false },
    { price: 60000, discountPrice: null, stock: 50 },
  ]),
];

async function ids(params: Parameters<typeof getProducts>[0]) {
  catalog = FIXTURES;
  const r = await getProducts({ perPage: 50, ...params });
  return r.products.map((p) => p.id).sort();
}

describe("getProducts price filters use the SELLING price", () => {
  it("maxPrice alone", async () => {
    // regular (189), flour (150), chilli (150), rasogulla's ₹125 size
    expect(await ids({ maxPrice: 200 })).toEqual(["chilli", "flour", "rasogulla", "regular"]);
  });

  it("matches on selling price, not MRP, at both ends", async () => {
    expect(await ids({ maxPrice: 200 })).toContain("regular"); // MRP 275, sells 189
    expect(await ids({ minPrice: 1000 })).toEqual(["bulk"]); // mango's MRP is 1600 but it sells at 899
    expect(await ids({ minPrice: 500, maxPrice: 1000 })).toEqual(["inactive-variant", "mango"]);
  });

  it("treats a discount that isn't below MRP as no discount", async () => {
    expect(await ids({ minPrice: 300, maxPrice: 400 })).toEqual(["odd-discount"]);
    expect(await ids({ maxPrice: 300 })).not.toContain("odd-discount");
  });

  it("ignores inactive variants", async () => {
    expect(await ids({ maxPrice: 100 })).toEqual([]);
  });
});

describe("getProducts variant filters combine instead of overwriting", () => {
  it("maxPrice + onSale", async () => {
    expect(await ids({ maxPrice: 200, onSale: true })).toEqual(["rasogulla", "regular"]);
  });

  it("maxPrice + inStock (the same size must be in stock and in range)", async () => {
    // rasogulla's ₹125 size is sold out; its in-stock size is ₹449
    expect(await ids({ maxPrice: 200, inStock: true })).toEqual(["flour", "regular"]);
  });

  it("minPrice + onSale", async () => {
    expect(await ids({ minPrice: 500, onSale: true })).toEqual(["bulk", "mango"]);
  });

  it("minPrice + inStock", async () => {
    expect(await ids({ minPrice: 500, inStock: true })).toEqual(["bulk", "inactive-variant"]);
  });

  it("price range + onSale + inStock", async () => {
    // odd-discount counts as "on sale" (onSale's existing discountPrice > 0 rule is unchanged)
    expect(await ids({ minPrice: 100, maxPrice: 500, onSale: true, inStock: true })).toEqual([
      "odd-discount",
      "rasogulla",
      "regular",
    ]);
  });

  it("onSale / inStock alone are unchanged", async () => {
    expect(await ids({ onSale: true })).toEqual(["bulk", "mango", "odd-discount", "rasogulla", "regular"]);
    expect(await ids({ inStock: true })).toEqual(["bulk", "flour", "inactive-variant", "odd-discount", "rasogulla", "regular"]);
  });

  it("still composes with category and rating", async () => {
    expect(await ids({ category: "makhana", maxPrice: 200 })).toEqual(["rasogulla", "regular"]);
    expect(await ids({ minRating: 4, maxPrice: 500, inStock: true })).toEqual(["rasogulla"]);
  });
});

describe("getProducts sort and pagination are preserved", () => {
  it("price sorts order by lowest selling price across the filtered set", async () => {
    catalog = FIXTURES;
    const low = await getProducts({ sort: "price-low", maxPrice: 500, perPage: 50 });
    expect(low.products.map((p) => p.id)).toEqual(["rasogulla", "flour", "chilli", "regular", "odd-discount"]);
    const high = await getProducts({ sort: "price-high", maxPrice: 500, perPage: 50 });
    expect(high.products.map((p) => p.id)).toEqual(["odd-discount", "regular", "flour", "chilli", "rasogulla"]);
  });

  it("newest is the default order", async () => {
    catalog = FIXTURES;
    const r = await getProducts({ inStock: true, perPage: 50 });
    expect(r.products.map((p) => p.id)).toEqual(["inactive-variant", "bulk", "rasogulla", "odd-discount", "flour", "regular"]);
  });

  it("paginates with total/pageCount from the filtered count, clamping the page", async () => {
    catalog = FIXTURES;
    const p1 = await getProducts({ inStock: true, perPage: 4 });
    const p2 = await getProducts({ inStock: true, perPage: 4, page: 2 });
    expect(p1).toMatchObject({ total: 6, pageCount: 2, page: 1, perPage: 4 });
    expect(p1.products).toHaveLength(4);
    expect(p2.products.map((p) => p.id)).toEqual(["flour", "regular"]);
    expect((await getProducts({ inStock: true, perPage: 4, page: 9 })).page).toBe(2);
  });

  it("paginates price sorts after sorting the whole filtered set", async () => {
    catalog = FIXTURES;
    const p2 = await getProducts({ sort: "price-low", maxPrice: 500, perPage: 2, page: 2 });
    expect(p2.products.map((p) => p.id)).toEqual(["chilli", "regular"]);
    expect(p2).toMatchObject({ total: 5, pageCount: 3 });
  });
});
