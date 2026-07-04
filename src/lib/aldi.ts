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
  sort?: "price-asc" | "price-desc" | "title-asc" | "title-desc" | "discount-pct" | "newest";
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
    // Use the generated column is_on_sale (added via migration)
    // PostgREST doesn't support column-to-column comparison, so we use a
    // GENERATED ALWAYS AS column that computes (price < regular_price) at write time.
    query = query.eq("is_on_sale", true);
  }
  if (params.minPrice !== undefined) {
    query = query.gte("price", params.minPrice);
  }
  if (params.maxPrice !== undefined) {
    query = query.lte("price", params.maxPrice);
  }

  switch (params.sort) {
    case "price-asc":
      query = query.order("price", { ascending: true, nullsFirst: false });
      break;
    case "price-desc":
      query = query.order("price", { ascending: false, nullsFirst: false });
      break;
    case "title-desc":
      query = query.order("product_title", { ascending: false });
      break;
    case "newest":
      query = query.order("fetched_at", { ascending: false });
      break;
    case "discount-pct":
      // Sort by discount percentage descending (biggest savings first)
      // Use the is_on_sale generated column to filter, then order by
      // (regular_price - price) DESC as a proxy for biggest savings
      query = query
        .eq("is_on_sale", true)
        .order("regular_price", { ascending: false, nullsFirst: false })
        .order("price", { ascending: true, nullsFirst: false });
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

  // Strategy: derive stores from the discounts table (store_ids that actually have data).
  // The stores table is not reliable — it may be out of sync with discounts.
  // We left-join with the stores table to get name/address if available,
  // and provide friendly names for known patterns (aldi-sued-national, rewe-*).

  // Get discount counts per store
  const { data: discountCounts, error: errCounts } = await db
    .from("discounts")
    .select("store_id")
    .limit(5000);
  if (errCounts) {
    throw Errors.storage(`listStores: discount-counts query failed: ${errCounts.message}`, {
      stage: "query", cause: errCounts.code,
    });
  }

  const countMap = new Map<string, number>();
  for (const d of discountCounts || []) {
    countMap.set(d.store_id, (countMap.get(d.store_id) || 0) + 1);
  }

  // Build store entries from discount store_ids (sorted by count desc)
  const entries: StoreEntry[] = Array.from(countMap.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([storeId, count]) => {
      const info = getStoreInfo(storeId);
      return {
        store_id: storeId,
        brand: info.brand,
        name: info.name,
        address: info.address,
        discountCount: count,
      };
    });

  return entries;
}

/**
 * Map a store_id to friendly display info.
 * Patterns:
 *   aldi-sued-national → ALDI SÜD (national prospectus)
 *   rewe-<city>-<n>    → REWE <City>
 *   aldi-<city>-<n>    → ALDI SÜD <City>
 */
function getStoreInfo(storeId: string): { brand: string; name: string; address: string } {
  if (storeId === "aldi-sued-national") {
    return {
      brand: "aldi-sued",
      name: "ALDI SÜD (national)",
      address: "Germany-wide — same prospectus everywhere",
    };
  }

  const parts = storeId.split("-");
  if (parts[0] === "rewe") {
    const city = parts[1] ? capitalize(parts[1]) : "";
    return {
      brand: "rewe",
      name: `REWE ${city}`.trim(),
      address: "",
    };
  }

  if (parts[0] === "aldi") {
    const city = parts[1] ? capitalize(parts[1]) : "";
    return {
      brand: "aldi-sued",
      name: `ALDI SÜD ${city}`.trim(),
      address: "",
    };
  }

  return {
    brand: "other",
    name: storeId,
    address: "",
  };
}

function capitalize(s: string): string {
  // Handle German umlaut replacements from slugification (nuernberg → Nürnberg)
  const umlautMap: Record<string, string> = {
    "ae": "ä", "oe": "ö", "ue": "ü",
    "Ae": "Ä", "Oe": "Ö", "Ue": "Ü",
    "ss": "ß",
  };
  // Replace common patterns
  let result = s;
  for (const [from, to] of Object.entries(umlautMap)) {
    result = result.replace(new RegExp(from, "g"), to);
  }
  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}
