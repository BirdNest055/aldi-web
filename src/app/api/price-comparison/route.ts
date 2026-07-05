import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { withErrorHandling } from "@/lib/errors";

async function handler(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") || "30");
  const db = getDb();

  // Get all products with prices
  const { data, error } = await db
    .from("discounts")
    .select("id, store_id, product_title, price, regular_price, brand, category, fetched_at")
    .not("price", "is", null)
    .order("fetched_at", { ascending: false })
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Group by product_title, keep only products available at 2+ stores
  const productMap = new Map<string, any[]>();
  for (const d of data || []) {
    const title = d.product_title?.trim();
    if (!title) continue;
    if (!productMap.has(title)) productMap.set(title, []);
    productMap.get(title)!.push(d);
  }

  const result: any[] = [];
  for (const [title, entries] of productMap) {
    if (entries.length < 2) continue; // need 2+ stores for comparison
    const prices = entries.map((e: any) => ({ store_id: e.store_id, price: Number(e.price), brand: e.brand }));
    const minPrice = Math.min(...prices.map((p: any) => p.price));
    const maxPrice = Math.max(...prices.map((p: any) => p.price));
    result.push({
      product_title: title,
      category: entries[0].category,
      prices,
      min_price: minPrice,
      max_price: maxPrice,
      price_spread: maxPrice - minPrice,
      store_count: entries.length,
    });
  }

  result.sort((a, b) => b.price_spread - a.price_spread);
  return NextResponse.json(result.slice(0, limit));
}
export const GET = withErrorHandling(handler);
