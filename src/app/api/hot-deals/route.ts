import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { withErrorHandling } from "@/lib/errors";

async function handler(req: NextRequest) {
  const limit = Number(req.nextUrl.searchParams.get("limit") || "20");
  const db = getDb();

  // Fetch on-sale products, compute discount %, sort by biggest discount
  const { data, error } = await db
    .from("discounts")
    .select("*")
    .eq("is_on_sale", true)
    .order("fetched_at", { ascending: false })
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const products = (data || []).map((d: any) => ({
    id: d.id,
    store_id: d.store_id,
    product_title: d.product_title,
    brand: d.brand,
    price: Number(d.price),
    regular_price: Number(d.regular_price),
    currency: d.currency || "EUR",
    category: d.category,
    fetched_at: d.fetched_at,
    discount_pct: d.regular_price > 0 ? Math.round((1 - d.price / d.regular_price) * 100) : 0,
    savings: d.regular_price - d.price,
  }));

  products.sort((a: any, b: any) => b.discount_pct - a.discount_pct);

  return NextResponse.json(products.slice(0, limit));
}
export const GET = withErrorHandling(handler);
