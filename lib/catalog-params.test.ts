import { describe, it, expect } from "vitest";
import {
  activeFilters,
  catalogHref,
  clearFiltersHref,
  priceRangeLabel,
  resultRange,
  toCatalogQuery,
} from "@/lib/catalog-params";

const ALL = { category: true, price: true };

describe("catalogHref", () => {
  it("applies updates, drops empty values and always resets page", () => {
    expect(catalogHref("/products", { sort: "rating", page: "3" }, { onSale: "1" })).toBe("/products?sort=rating&onSale=1");
    expect(catalogHref("/products", { onSale: "1" }, { onSale: undefined })).toBe("/products");
  });
});

describe("clearFiltersHref", () => {
  it("removes every filter but keeps the search term and sort", () => {
    const query = { q: "makhana", sort: "price-low", onSale: "1", inStock: "1", minRating: "4", maxPrice: "200", page: "2" };
    expect(clearFiltersHref("/search", query)).toBe("/search?q=makhana&sort=price-low");
  });

  it("keeps a route-scoped category page on its own path", () => {
    expect(clearFiltersHref("/categories/makhana", { minPrice: "200", maxPrice: "500" })).toBe("/categories/makhana");
  });
});

describe("activeFilters", () => {
  it("labels each filter and removes only that one", () => {
    const query = { q: "nuts", category: "makhana", maxPrice: "200", inStock: "1", onSale: "1", minRating: "4" };
    const filters = activeFilters("/products", query, ALL, { makhana: "Makhana" });
    expect(filters.map((f) => f.label)).toEqual(["Makhana", "Under ₹200", "In stock", "On sale", "4★ & up"]);
    const price = filters.find((f) => f.key === "price")!;
    expect(price.removeHref).toBe("/products?q=nuts&category=makhana&inStock=1&onSale=1&minRating=4");
  });

  it("omits filters the route does not apply", () => {
    const query = { category: "makhana", minPrice: "200", inStock: "1" };
    expect(activeFilters("/search", query, { category: false, price: false }).map((f) => f.key)).toEqual(["inStock"]);
  });

  it("ignores junk values", () => {
    expect(activeFilters("/products", { minRating: "abc", maxPrice: "x", onSale: "yes" }, ALL)).toEqual([]);
  });
});

describe("priceRangeLabel", () => {
  it("names presets and custom ranges", () => {
    expect(priceRangeLabel("200", "500")).toBe("₹200 – ₹500");
    expect(priceRangeLabel("1000", undefined)).toBe("Over ₹1,000");
    expect(priceRangeLabel("150", "350")).toBe("₹150 – ₹350");
    expect(priceRangeLabel(undefined, undefined)).toBeNull();
  });
});

describe("resultRange", () => {
  it("returns the 1-based range on the page", () => {
    expect(resultRange(1, 12, 22)).toEqual({ from: 1, to: 12 });
    expect(resultRange(2, 12, 22)).toEqual({ from: 13, to: 22 });
    expect(resultRange(1, 12, 0)).toEqual({ from: 0, to: 0 });
  });
});

describe("toCatalogQuery", () => {
  it("keeps single string values only", () => {
    expect(toCatalogQuery({ q: "a", tag: ["x", "y"], none: undefined })).toEqual({ q: "a" });
  });
});
