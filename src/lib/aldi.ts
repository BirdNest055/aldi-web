import { getDb } from "@/lib/db";
import { Errors, ApiError } from "@/lib/errors";

export interface Stats {
  totalDiscounts: number;
  uniqueProducts: number;
  uniqueBrands: number;
  uniqueCategories: number;
  storesWithDiscounts: number;
  priceMin: number | null;
  priceMax: number | null;
  priceAvg: number | null;
  storeList: Array<{
    store_id: string;
    count: number;
    min_price: number | null;
    max_price: number | null;
  }>;
}

export interface ProductListItem {
  id: number;
  store_id: string;
  product_title: string;
  brand: string | null;
  price: number | null;
  regular_price: number | null;
  currency: string;
  category: string | null;
  fetched_at: string;
}

export interface ProductListResult {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BrandEntry {
  name: string;
  count: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
}

export interface CategoryEntry {
  name: string;
  count: number;
}

export interface StoreEntry {
  store_id: string;
  brand: string;
  name: string;
  address: string;
  discountCount: number;
}

function parsePrice(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return isNaN(n) ? null : n;
}

export async function getStats(): Promise<Stats> {
  const db = getDb();

  const { data: totalData, error: err1 } = await db
    .from("discounts")
    .select("product_title, brand, category, price")
    .limit(2000);

  if (err1) {
    throw Errors.storage(`getStats: discounts query failed: ${err1.message}`, {
      stage: "query", cause: err1.code,
    });
  }

  const all = totalData || [];
  const prices = all.map((d: any) => d.price).filter((p: any) => p !== null && p !== undefined);
  const uniqueProducts = new Set(all.map((d: any) => d.product_title)).size;
  const uniqueBrands = new Set(all.filter((d: any) => d.brand).map((d: any) => d.brand)).size;
  const uniqueCategories = new Set(all.filter((d: any) => d.category).map((d: any) => d.category)).size;

  // Get store list with counts
  const { data: storeData, error: err2 } = await db
    .from("discounts")
    .select("store_id, price")
    .limit(2000);

  if (err2) {
    throw Errors.storage(`getStats: store-data query failed: ${err2.message}`, {
      stage: "query", cause: err2.code,
    });
  }

  const storeMap = new Map<string, { count: number; min: number; max: number }>();
  for (const d of storeData || []) {
    const sid = d.store_id;
    if (!storeMap.has(sid)) {
      storeMap.set(sid, { count: 0, min: Infinity, max: -Infinity });
    }
    const s = storeMap.get(sid)!;
    s.count++;
    if (d.price !== null) {
      s.min = Math.min(s.min, d.price);
      s.max = Math.max(s.max, d.price);
    }
  }

  return {
    totalDiscounts: all.length,
    uniqueProducts,
    uniqueBrands,
    uniqueCategories,
    storesWithDiscounts: storeMap.size,
    priceMin: prices.length ? Math.min(...prices) : null,
    priceMax: prices.length ? Math.max(...prices) : null,
    priceAvg: prices.length ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : null,
    storeList: Array.from(storeMap.entries()).map(([store_id, v]) => ({
      store_id,
      count: v.count,
      min_price: v.min === Infinity ? null : v.min,
      max_price: v.max === -Infinity ? null : v.max,
    })),
  };
}

export interface ListProductsParams {
  storeId?: string;
  search?: string;
  category?: string;
  brand?: string;
  onSaleOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
  sort?: "price-asc" | "price-desc" | "title-asc" | "title-desc" | "newest";
}

export async function listProducts(
  params: ListProductsParams = {}
): Promise<ProductListResult> {
  const db = getDb();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  let query = db.from("discounts").select("*", { count: "exact" });

  if (params.storeId) {
    query = query.eq("store_id", params.storeId);
  }
  if (params.search) {
    query = query.or(`product_title.ilike.%${params.search}%,brand.ilike.%${params.search}%,category.ilike.%${params.search}%`);
  }
  if (params.category) {
    query = query.ilike("category", `%${params.category}%`);
  }
  if (params.brand) {
    query = query.ilike("brand", `%${params.brand}%`);
  }
  if (params.onSaleOnly) {
    query = query.not("regular_price", "is", null).lt("price", "regular_price");
  }
  if (params.minPrice !== undefined) {
    query = query.gte("price", params.minPrice);
  }
  if (params.maxPrice !== undefined) {
    query = query.lte("price", params.maxPrice);
  }

  switch (params.sort) {
    case "price-asc":
      query = query.order("price", { ascending: true });
      break;
    case "price-desc":
      query = query.order("price", { ascending: false });
      break;
    case "title-desc":
      query = query.order("product_title", { ascending: false });
      break;
    case "newest":
      query = query.order("fetched_at", { ascending: false });
      break;
    default:
      query = query.order("product_title", { ascending: true });
  }

  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw Errors.storage(`listProducts: query failed: ${error.message}`, {
      stage: "query", cause: error.code,
    });
  }

  return {
    items: (data || []).map((d: any) => ({
      id: d.id,
      store_id: d.store_id,
      product_title: d.product_title,
      brand: d.brand,
      price: parsePrice(d.price),
      regular_price: parsePrice(d.regular_price),
      currency: d.currency || "EUR",
      category: d.category,
      fetched_at: d.fetched_at,
    })),
    total: count || 0,
    page,
    pageSize,
  };
}

export async function listBrands(): Promise<BrandEntry[]> {
  const db = getDb();
  const { data, error } = await db
    .from("discounts")
    .select("brand, price")
    .not("brand", "is", null)
    .limit(2000);

  if (error) {
    throw Errors.storage(`listBrands: query failed: ${error.message}`, {
      stage: "query", cause: error.code,
    });
  }
  if (!data) return [];

  const brandMap = new Map<string, { count: number; prices: number[] }>();
  for (const d of data) {
    if (!d.brand) continue;
    if (!brandMap.has(d.brand)) {
      brandMap.set(d.brand, { count: 0, prices: [] });
    }
    const b = brandMap.get(d.brand)!;
    b.count++;
    if (d.price !== null) b.prices.push(d.price);
  }

  return Array.from(brandMap.entries())
    .map(([name, v]) => ({
      name,
      count: v.count,
      avgPrice: v.prices.length ? v.prices.reduce((a, b) => a + b, 0) / v.prices.length : null,
      minPrice: v.prices.length ? Math.min(...v.prices) : null,
      maxPrice: v.prices.length ? Math.max(...v.prices) : null,
    }))
    .sort((a, b) => b.count - a.count);
}

export async function listCategories(): Promise<CategoryEntry[]> {
  const db = getDb();
  const { data, error } = await db
    .from("discounts")
    .select("category")
    .not("category", "is", null)
    .limit(2000);

  if (error) {
    throw Errors.storage(`listCategories: query failed: ${error.message}`, {
      stage: "query", cause: error.code,
    });
  }
  if (!data) return [];

  const catMap = new Map<string, number>();
  for (const d of data) {
    if (!d.category) continue;
    catMap.set(d.category, (catMap.get(d.category) || 0) + 1);
  }

  return Array.from(catMap.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export async function listStores(): Promise<StoreEntry[]> {
  const db = getDb();

  // Get stores from stores table
  const { data: stores, error: errStores } = await db.from("stores").select("*").limit(100);
  if (errStores) {
    throw Errors.storage(`listStores: stores query failed: ${errStores.message}`, {
      stage: "query", cause: errStores.code,
    });
  }

  // Get discount counts per store
  const { data: discountCounts, error: errCounts } = await db
    .from("discounts")
    .select("store_id")
    .limit(2000);
  if (errCounts) {
    throw Errors.storage(`listStores: discount-counts query failed: ${errCounts.message}`, {
      stage: "query", cause: errCounts.code,
    });
  }

  const countMap = new Map<string, number>();
  for (const d of discountCounts || []) {
    countMap.set(d.store_id, (countMap.get(d.store_id) || 0) + 1);
  }

  return (stores || []).map((s: any) => ({
    store_id: s.id,
    brand: s.brand,
    name: s.name,
    address: s.address,
    discountCount: countMap.get(s.id) || 0,
  }));
}
