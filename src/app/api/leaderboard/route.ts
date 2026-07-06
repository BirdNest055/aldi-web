import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { withErrorHandling } from "@/lib/errors";
import { storeDisplayName, storeBrand, fallbackAddress } from "@/lib/product-info";

async function handler() {
  const db = getDb();
  const { data, error } = await db
    .from("discounts")
    .select("store_id, price, regular_price, is_on_sale")
    .limit(5000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const storeMap = new Map<string, { count: number; totalPrice: number; priceCount: number; onSale: number; totalDiscount: number; discountCount: number }>();

  for (const d of data || []) {
    const sid = d.store_id;
    if (!storeMap.has(sid)) {
      storeMap.set(sid, { count: 0, totalPrice: 0, priceCount: 0, onSale: 0, totalDiscount: 0, discountCount: 0 });
    }
    const s = storeMap.get(sid)!;
    s.count++;
    if (d.price !== null) {
      s.totalPrice += Number(d.price);
      s.priceCount++;
    }
    if (d.is_on_sale) {
      s.onSale++;
      if (d.regular_price && d.price) {
        s.totalDiscount += (1 - Number(d.price) / Number(d.regular_price)) * 100;
        s.discountCount++;
      }
    }
  }

  // Fetch addresses + opening hours + names for all stores that have discounts
  const storeIds = Array.from(storeMap.keys());
  const dbInfoLookup = new Map<string, { name: string; address: string; opening_hours: string }>();
  if (storeIds.length > 0) {
    try {
      const { data: storeRows } = await db
        .from("stores")
        .select("id, name, address, opening_hours")
        .in("id", storeIds)
        .limit(5000);
      if (storeRows) {
        for (const s of storeRows) {
          dbInfoLookup.set(s.id, {
            name: s.name || "",
            address: s.address || "",
            opening_hours: s.opening_hours || "",
          });
        }
      }
    } catch {}
  }

  const result = Array.from(storeMap.entries()).map(([storeId, s]) => {
    const dbInfo = dbInfoLookup.get(storeId);
    const displayName = dbInfo?.name || storeDisplayName(storeId);
    const address = dbInfo?.address || fallbackAddress(storeId) || "";
    const openingHours = dbInfo?.opening_hours || "";
    return {
      store_id: storeId,
      brand: storeBrand(storeId),
      name: displayName,
      address,
      opening_hours: openingHours,
      product_count: s.count,
      avg_price: s.priceCount > 0 ? s.totalPrice / s.priceCount : null,
      on_sale_count: s.onSale,
      on_sale_pct: s.count > 0 ? (s.onSale / s.count) * 100 : 0,
      avg_discount_pct: s.discountCount > 0 ? s.totalDiscount / s.discountCount : 0,
    };
  }).sort((a, b) => (a.avg_price ?? 999) - (b.avg_price ?? 999));

  return NextResponse.json(result);
}
export const GET = withErrorHandling(handler);
