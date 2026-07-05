import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { withErrorHandling } from "@/lib/errors";

async function handler(req: NextRequest) {
  const type = req.nextUrl.searchParams.get("type") || "overview";
  const db = getDb();

  if (type === "category-prices") {
    // Average price per category per store
    const { data, error } = await db.from("discounts").select("store_id, category, price, is_on_sale").not("price", "is", null).not("category", "is", null).limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const map = new Map<string, any>();
    for (const d of data || []) {
      const key = `${d.category}|||${d.store_id}`;
      if (!map.has(key)) map.set(key, { category: d.category, store_id: d.store_id, prices: [], count: 0, onSale: 0 });
      const e = map.get(key);
      e.prices.push(Number(d.price)); e.count++;
      if (d.is_on_sale) e.onSale++;
    }
    const result = Array.from(map.values()).map(e => ({
      category: e.category, store_id: e.store_id,
      avg_price: e.prices.reduce((a:number,b:number)=>a+b,0) / e.prices.length,
      min_price: Math.min(...e.prices), max_price: Math.max(...e.prices),
      count: e.count, on_sale_pct: (e.onSale / e.count) * 100,
    }));
    return NextResponse.json(result);
  }

  if (type === "brand-prices") {
    const { data, error } = await db.from("discounts").select("brand, price, store_id").not("brand", "is", null).not("price", "is", null).limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const map = new Map<string, any>();
    for (const d of data || []) {
      if (!map.has(d.brand)) map.set(d.brand, { brand: d.brand, prices: [], stores: new Set(), count: 0 });
      const e = map.get(d.brand);
      e.prices.push(Number(d.price)); e.stores.add(d.store_id); e.count++;
    }
    const result = Array.from(map.values()).map(e => ({
      brand: e.brand, avg_price: e.prices.reduce((a:number,b:number)=>a+b,0)/e.prices.length,
      min_price: Math.min(...e.prices), max_price: Math.max(...e.prices),
      count: e.count, store_count: e.stores.size,
    })).sort((a,b) => b.count - a.count);
    return NextResponse.json(result);
  }

  if (type === "price-distribution") {
    const { data, error } = await db.from("discounts").select("price, category").not("price", "is", null).limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    // Build price buckets: 0-0.5, 0.5-1, 1-2, 2-3, 3-5, 5-10, 10+
    const buckets = [
      { label: "0–0.50 €", min: 0, max: 0.5, count: 0 },
      { label: "0.50–1 €", min: 0.5, max: 1, count: 0 },
      { label: "1–2 €", min: 1, max: 2, count: 0 },
      { label: "2–3 €", min: 2, max: 3, count: 0 },
      { label: "3–5 €", min: 3, max: 5, count: 0 },
      { label: "5–10 €", min: 5, max: 10, count: 0 },
      { label: "10+ €", min: 10, max: Infinity, count: 0 },
    ];
    for (const d of data || []) {
      const p = Number(d.price);
      for (const b of buckets) { if (p >= b.min && p < b.max) { b.count++; break; } }
    }
    return NextResponse.json(buckets);
  }

  if (type === "store-categories") {
    // Which categories each store has products in
    const { data, error } = await db.from("discounts").select("store_id, category").not("category", "is", null).limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const map = new Map<string, Map<string, number>>();
    for (const d of data || []) {
      if (!map.has(d.store_id)) map.set(d.store_id, new Map());
      const cats = map.get(d.store_id);
      cats.set(d.category, (cats.get(d.category) || 0) + 1);
    }
    const result = Array.from(map.entries()).map(([storeId, cats]) => ({
      store_id: storeId,
      categories: Array.from(cats.entries()).sort((a,b) => b[1] - a[1]).map(([cat, count]) => ({ category: cat, count })),
      category_count: cats.size,
    }));
    return NextResponse.json(result);
  }

  if (type === "discount-depth") {
    // Distribution of discount percentages
    const { data, error } = await db.from("discounts").select("price, regular_price").eq("is_on_sale", true).limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const buckets = [
      { label: "1–10%", min: 1, max: 10, count: 0 },
      { label: "10–20%", min: 10, max: 20, count: 0 },
      { label: "20–30%", min: 20, max: 30, count: 0 },
      { label: "30–40%", min: 30, max: 40, count: 0 },
      { label: "40–50%", min: 40, max: 50, count: 0 },
      { label: "50%+", min: 50, max: Infinity, count: 0 },
    ];
    for (const d of data || []) {
      const pct = (1 - Number(d.price) / Number(d.regular_price)) * 100;
      for (const b of buckets) { if (pct >= b.min && pct < b.max) { b.count++; break; } }
    }
    return NextResponse.json(buckets);
  }

  if (type === "savings-total") {
    // Total savings if you bought all on-sale products
    const { data, error } = await db.from("discounts").select("price, regular_price, store_id").eq("is_on_sale", true).limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    let totalSavings = 0, totalOriginal = 0, totalCurrent = 0;
    const byStore = new Map<string, { savings: number; original: number; current: number; count: number }>();
    for (const d of data || []) {
      const p = Number(d.price), r = Number(d.regular_price);
      const sav = r - p;
      totalSavings += sav; totalOriginal += r; totalCurrent += p;
      if (!byStore.has(d.store_id)) byStore.set(d.store_id, { savings: 0, original: 0, current: 0, count: 0 });
      const e = byStore.get(d.store_id);
      e.savings += sav; e.original += r; e.current += p; e.count++;
    }
    return NextResponse.json({
      total_savings: totalSavings,
      total_original: totalOriginal,
      total_current: totalCurrent,
      avg_discount_pct: totalOriginal > 0 ? (1 - totalCurrent / totalOriginal) * 100 : 0,
      on_sale_count: data?.length || 0,
      by_store: Array.from(byStore.entries()).map(([storeId, e]) => ({
        store_id: storeId, savings: e.savings, original: e.original, current: e.current,
        avg_discount_pct: e.original > 0 ? (1 - e.current / e.original) * 100 : 0, count: e.count,
      })).sort((a,b) => b.savings - a.savings),
    });
  }

  if (type === "overlap") {
    // Products that appear at multiple stores
    const { data, error } = await db.from("discounts").select("product_title, store_id, price").not("product_title", "is", null).limit(5000);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const map = new Map<string, any[]>();
    for (const d of data || []) {
      const t = d.product_title.trim();
      if (!t) continue;
      if (!map.has(t)) map.set(t, []);
      map.get(t).push({ store_id: d.store_id, price: Number(d.price) });
    }
    const multi = Array.from(map.entries()).filter(([_, entries]) => entries.length > 1)
      .map(([title, entries]) => {
        const prices = entries.map(e => e.price);
        return {
          product_title: title,
          store_count: entries.length,
          min_price: Math.min(...prices), max_price: Math.max(...prices),
          price_spread: Math.max(...prices) - Math.min(...prices),
          stores: entries,
        };
      }).sort((a,b) => b.store_count - a.store_count || b.price_spread - a.price_spread);
    return NextResponse.json({
      total_products: map.size,
      multi_store_products: multi.length,
      single_store_products: map.size - multi.length,
      top_overlaps: multi.slice(0, 20),
    });
  }

  // Default: overview
  const { data: discounts } = await db.from("discounts").select("*").limit(5000);
  const all = discounts || [];
  const prices = all.map((d:any) => Number(d.price)).filter((p:number) => !isNaN(p));
  const onSale = all.filter((d:any) => d.is_on_sale);
  const categories = new Set(all.map((d:any) => d.category).filter(Boolean));
  const brands = new Set(all.map((d:any) => d.brand).filter(Boolean));
  const stores = new Set(all.map((d:any) => d.store_id));
  return NextResponse.json({
    total_discounts: all.length,
    total_stores: stores.size,
    total_categories: categories.size,
    total_brands: brands.size,
    on_sale_count: onSale.length,
    on_sale_pct: all.length > 0 ? (onSale.length / all.length) * 100 : 0,
    price_min: prices.length ? Math.min(...prices) : null,
    price_max: prices.length ? Math.max(...prices) : null,
    price_avg: prices.length ? prices.reduce((a:number,b:number)=>a+b,0)/prices.length : null,
    price_median: prices.length ? prices.sort((a:number,b:number)=>a-b)[Math.floor(prices.length/2)] : null,
  });
}

export const GET = withErrorHandling(handler);
