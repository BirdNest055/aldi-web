import { describe, it, expect } from "vitest";
import {
  getStats,
  listPublications,
  listProducts,
  getProductDetail,
  getPriceHistory,
  getDiff,
  listCategories,
  listBrands,
} from "@/lib/aldi";

describe("getStats", () => {
  it("returns dashboard stats with correct counts", async () => {
    const stats = await getStats();
    expect(stats).toHaveProperty("publications");
    expect(stats).toHaveProperty("products");
    expect(stats).toHaveProperty("offerings");
    expect(stats).toHaveProperty("categories");
    expect(stats).toHaveProperty("priceMin");
    expect(stats).toHaveProperty("priceMax");
    expect(stats).toHaveProperty("priceAvg");
    expect(stats.publications).toBe(2);
    expect(stats.products).toBeGreaterThan(0);
    expect(stats.offerings).toBeGreaterThan(0);
  });

  it("includes publication list in stats", async () => {
    const stats = await getStats();
    expect(Array.isArray(stats.publicationList)).toBe(true);
    expect(stats.publicationList.length).toBe(2);
    expect(stats.publicationList[0]).toHaveProperty("id");
    expect(stats.publicationList[0]).toHaveProperty("slug");
    expect(stats.publicationList[0]).toHaveProperty("originalTitle");
    expect(stats.publicationList[0]).toHaveProperty("fetchedAt");
  });

  it("computes price stats only from numeric prices", async () => {
    const stats = await getStats();
    expect(stats.priceMin).toBeGreaterThan(0);
    expect(stats.priceMax).toBeGreaterThan(stats.priceMin);
    expect(stats.priceAvg).toBeGreaterThan(stats.priceMin);
    expect(stats.priceAvg).toBeLessThan(stats.priceMax);
  });
});

describe("listPublications", () => {
  it("returns all publications ordered by fetched_at DESC", async () => {
    const pubs = await listPublications();
    expect(pubs.length).toBe(2);
    // Most recent first
    expect(pubs[0].fetchedAt >= pubs[1].fetchedAt).toBe(true);
  });

  it("includes offering count per publication", async () => {
    const pubs = await listPublications();
    expect(pubs[0]).toHaveProperty("offeringCount");
    expect(pubs[0].offeringCount).toBeGreaterThan(0);
  });
});

describe("listProducts", () => {
  it("returns paginated products with default params", async () => {
    const result = await listProducts({});
    expect(result).toHaveProperty("items");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("page");
    expect(result).toHaveProperty("pageSize");
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(50);
  });

  it("filters by publication id", async () => {
    const result = await listProducts({ publicationId: 3167415 });
    expect(result.total).toBeGreaterThan(100); // KW27 has ~175 offerings
    const result2 = await listProducts({ publicationId: 3174533 });
    expect(result2.total).toBeLessThan(10); // KW28 has only 2
  });

  it("filters by search query (case-insensitive)", async () => {
    const result = await listProducts({ search: "avocado" });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items[0].title?.toLowerCase()).toContain("avocado");
  });

  it("filters by category substring", async () => {
    const result = await listProducts({ category: "Eis" });
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.some((p) => p.productType?.includes("Eis"))).toBe(true);
  });

  it("filters by price range", async () => {
    const result = await listProducts({ minPrice: 1, maxPrice: 2 });
    expect(result.items.length).toBeGreaterThan(0);
    for (const p of result.items) {
      expect(p.priceNumeric).toBeGreaterThanOrEqual(1);
      expect(p.priceNumeric).toBeLessThanOrEqual(2);
    }
  });

  it("paginates correctly", async () => {
    const page1 = await listProducts({ page: 1, pageSize: 10 });
    const page2 = await listProducts({ page: 2, pageSize: 10 });
    expect(page1.items.length).toBe(10);
    expect(page2.items.length).toBeGreaterThan(0);
    // Pages should not overlap
    const ids1 = new Set(page1.items.map((p) => p.id));
    const ids2 = new Set(page2.items.map((p) => p.id));
    for (const id of ids2) {
      expect(ids1.has(id)).toBe(false);
    }
  });

  it("sorts by price ascending", async () => {
    const result = await listProducts({ sort: "price-asc", pageSize: 20 });
    for (let i = 1; i < result.items.length; i++) {
      const prev = result.items[i - 1].priceNumeric ?? Infinity;
      const curr = result.items[i].priceNumeric ?? Infinity;
      expect(curr).toBeGreaterThanOrEqual(prev);
    }
  });

  it("includes product_key and canonical fields", async () => {
    const result = await listProducts({ pageSize: 1 });
    const item = result.items[0];
    expect(item).toHaveProperty("productKey");
    expect(item).toHaveProperty("title");
    expect(item.productKey).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe("getProductDetail", () => {
  it("returns full product detail by product_key", async () => {
    // First get a product key from the list
    const list = await listProducts({ pageSize: 1 });
    const key = list.items[0].productKey;
    const detail = await getProductDetail(key);
    expect(detail).toHaveProperty("product");
    expect(detail).toHaveProperty("offerings");
    expect(detail.product.productKey).toBe(key);
    expect(Array.isArray(detail.offerings)).toBe(true);
  });

  it("returns 404-like null for non-existent key", async () => {
    const detail = await getProductDetail("nonexistent0000");
    expect(detail).toBeNull();
  });

  it("includes SCD2 title and description history", async () => {
    const list = await listProducts({ pageSize: 1 });
    const key = list.items[0].productKey;
    const detail = await getProductDetail(key);
    expect(detail).toHaveProperty("titleHistory");
    expect(detail).toHaveProperty("descriptionHistory");
    expect(Array.isArray(detail.titleHistory)).toBe(true);
    expect(Array.isArray(detail.descriptionHistory)).toBe(true);
  });

  it("includes photos and labels for each offering", async () => {
    const list = await listProducts({ pageSize: 1 });
    const key = list.items[0].productKey;
    const detail = await getProductDetail(key);
    if (detail && detail.offerings.length > 0) {
      const o = detail.offerings[0];
      expect(o).toHaveProperty("photos");
      expect(o).toHaveProperty("labels");
      expect(Array.isArray(o.photos)).toBe(true);
      expect(Array.isArray(o.labels)).toBe(true);
    }
  });
});

describe("getPriceHistory", () => {
  it("returns price history for a product across all publications", async () => {
    const list = await listProducts({ pageSize: 1 });
    const key = list.items[0].productKey;
    const history = await getPriceHistory(key);
    expect(history).toHaveProperty("productKey");
    expect(history).toHaveProperty("canonicalTitle");
    expect(history).toHaveProperty("history");
    expect(Array.isArray(history.history)).toBe(true);
    if (history.history.length > 0) {
      const h = history.history[0];
      expect(h).toHaveProperty("publicationId");
      expect(h).toHaveProperty("publicationSlug");
      expect(h).toHaveProperty("fetchedAt");
      expect(h).toHaveProperty("priceMin");
      expect(h).toHaveProperty("priceMax");
      expect(h).toHaveProperty("priceAvg");
      expect(h).toHaveProperty("nOfferings");
    }
  });

  it("returns null for non-existent product", async () => {
    const history = await getPriceHistory("nonexistent0000");
    expect(history).toBeNull();
  });
});

describe("getDiff", () => {
  it("returns diff between two publications", async () => {
    const diff = await getDiff(3167415, 3174533);
    expect(diff).toHaveProperty("pubA");
    expect(diff).toHaveProperty("pubB");
    expect(diff).toHaveProperty("added");
    expect(diff).toHaveProperty("removed");
    expect(diff).toHaveProperty("priceChanges");
    expect(Array.isArray(diff.added)).toBe(true);
    expect(Array.isArray(diff.removed)).toBe(true);
    expect(Array.isArray(diff.priceChanges)).toBe(true);
  });

  it("diff is symmetric: removed from A->B equals added from B->A", async () => {
    const d1 = await getDiff(3167415, 3174533);
    const d2 = await getDiff(3174533, 3167415);
    expect(d1.added.length).toBe(d2.removed.length);
    expect(d1.removed.length).toBe(d2.added.length);
  });

  it("diff with self returns empty added/removed", async () => {
    const diff = await getDiff(3167415, 3167415);
    expect(diff.added.length).toBe(0);
    expect(diff.removed.length).toBe(0);
    expect(diff.priceChanges.length).toBe(0);
  });

  it("price changes include old and new price", async () => {
    // KW28 has very few offerings; let's just verify the structure
    const diff = await getDiff(3167415, 3174533);
    for (const change of diff.priceChanges) {
      expect(change).toHaveProperty("productKey");
      expect(change).toHaveProperty("title");
      expect(change).toHaveProperty("oldPrice");
      expect(change).toHaveProperty("newPrice");
    }
  });
});

describe("listCategories", () => {
  it("returns all categories with counts", async () => {
    const cats = await listCategories();
    expect(Array.isArray(cats)).toBe(true);
    expect(cats.length).toBeGreaterThan(0);
    expect(cats[0]).toHaveProperty("name");
    expect(cats[0]).toHaveProperty("count");
    // Sorted by count desc
    for (let i = 1; i < cats.length; i++) {
      expect(cats[i].count).toBeLessThanOrEqual(cats[i - 1].count);
    }
  });

  it("filters categories by publication", async () => {
    const cats = await listCategories(3167415);
    expect(cats.length).toBeGreaterThan(5);
    const total = cats.reduce((sum, c) => sum + c.count, 0);
    expect(total).toBeGreaterThan(100); // KW27 has ~175 offerings
  });
});

describe("listBrands", () => {
  it("returns all brands with counts and price stats", async () => {
    const brands = await listBrands();
    expect(Array.isArray(brands)).toBe(true);
    expect(brands.length).toBeGreaterThan(10); // KW27 has ~50 brands
    expect(brands[0]).toHaveProperty("name");
    expect(brands[0]).toHaveProperty("count");
    expect(brands[0]).toHaveProperty("avgPrice");
    expect(brands[0]).toHaveProperty("minPrice");
    expect(brands[0]).toHaveProperty("maxPrice");
    // Sorted by count desc
    for (let i = 1; i < brands.length; i++) {
      expect(brands[i].count).toBeLessThanOrEqual(brands[i - 1].count);
    }
  });

  it("includes RIO D'ORO as a top brand (ALDI beverage brand)", async () => {
    const brands = await listBrands();
    const rio = brands.find((b) => b.name === "RIO D'ORO");
    expect(rio).toBeDefined();
    expect(rio!.count).toBeGreaterThan(0);
  });
});

describe("listProducts with brand filter", () => {
  it("filters by brand", async () => {
    const result = await listProducts({ brand: "RIO D'ORO" });
    expect(result.items.length).toBeGreaterThan(0);
    for (const p of result.items) {
      expect(p.brand).toBe("RIO D'ORO");
    }
  });

  it("filters by onSaleOnly", async () => {
    const result = await listProducts({ onSaleOnly: true });
    expect(result.items.length).toBeGreaterThan(0);
    for (const p of result.items) {
      expect(p.discountedPriceNumeric).not.toBeNull();
    }
  });

  it("search matches brand field", async () => {
    const result = await listProducts({ search: "CROFTON" });
    expect(result.items.length).toBeGreaterThan(0);
    // At least one item should have brand CROFTON
    expect(result.items.some((p) => p.brand === "CROFTON")).toBe(true);
  });
});

