import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { withErrorHandling, Errors } from "@/lib/errors";
import { extractQuantity } from "@/lib/product-info";

/**
 * GET /api/products/<id>
 * Returns detailed info for a single product, including:
 * - Basic info (title, brand, price, regular_price, category)
 * - Store info (friendly name, brand)
 * - Fetch metadata (fetched_at)
 * - Computed fields (is_on_sale, discount_pct, savings_amount)
 * - Price history across all stores (if the same product title appears elsewhere)
 */
async function handler(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    throw Errors.config("Invalid product ID", { cause: "invalid-id" });
  }

  const db = getDb();

  // Get the main product
  const { data: product, error: err1 } = await db
    .from("discounts")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (err1) {
    throw Errors.storage(`getProduct failed: ${err1.message}`, {
      stage: "query", cause: err1.code,
    });
  }
  if (!product) {
    throw Errors.notFound(`Product with ID ${id} not found`);
  }

  // Get price history: same product_title across ALL stores
  // (limited to 50 most recent entries to keep response small)
  const { data: history, error: err2 } = await db
    .from("discounts")
    .select("id, store_id, price, regular_price, currency, fetched_at")
    .ilike("product_title", product.product_title || "")
    .order("fetched_at", { ascending: false })
    .limit(50);

  if (err2) {
    throw Errors.storage(`getProduct history failed: ${err2.message}`, {
      stage: "query", cause: err2.code,
    });
  }

  // Get similar products: same category, different title (limit 10)
  const { data: similar, error: err3 } = await db
    .from("discounts")
    .select("id, product_title, brand, price, regular_price, store_id, fetched_at")
    .ilike("category", product.category || "")
    .neq("id", id)
    .order("fetched_at", { ascending: false })
    .limit(10);

  if (err3) {
    throw Errors.storage(`getProduct similar failed: ${err3.message}`, {
      stage: "query", cause: err3.code,
    });
  }

  // Compute discount info
  const price = product.price !== null ? Number(product.price) : null;
  const regularPrice = product.regular_price !== null ? Number(product.regular_price) : null;
  const isOnSale = price !== null && regularPrice !== null && price < regularPrice;
  const discountPct = isOnSale ? Math.round((1 - price! / regularPrice!) * 100) : null;
  const savingsAmount = isOnSale ? regularPrice! - price! : null;

  // Build store info
  const storeId = product.store_id;
  const storeBrand = storeId === "aldi-sued-national" || storeId.startsWith("aldi")
    ? "aldi-sued"
    : storeId.startsWith("rewe") ? "rewe" : "other";
  const storeName = friendlyStoreName(storeId);

  // Fetch store address + opening hours from stores table
  let storeAddress: string | null = null;
  let storeOpeningHours: string | null = null;
  try {
    const { data: storeRow } = await db.from("stores").select("address, opening_hours").eq("id", storeId).maybeSingle();
    storeAddress = storeRow?.address || null;
    storeOpeningHours = storeRow?.opening_hours || null;
  } catch {}

  return NextResponse.json({
    id: product.id,
    productTitle: product.product_title,
    brand: product.brand,
    price,
    regularPrice,
    currency: product.currency || "EUR",
    category: product.category,
    validFrom: product.valid_from,
    validUntil: product.valid_until,
    fetchedAt: product.fetched_at,
    // Extracted quantity / weight / volume from the title
    quantity: extractQuantity(product.product_title),
    // Computed
    isOnSale,
    discountPct,
    savingsAmount,
    // Store info
    store: {
      id: storeId,
      name: storeName,
      brand: storeBrand,
      address: storeAddress,
      openingHours: storeOpeningHours,
    },
    // Price history (same product title across stores)
    priceHistory: (history || []).map((h: any) => ({
      id: h.id,
      storeId: h.store_id,
      storeName: friendlyStoreName(h.store_id),
      storeBrand: h.store_id.startsWith("aldi") ? "aldi-sued" : h.store_id.startsWith("rewe") ? "rewe" : "other",
      price: h.price !== null ? Number(h.price) : null,
      regularPrice: h.regular_price !== null ? Number(h.regular_price) : null,
      currency: h.currency || "EUR",
      fetchedAt: h.fetched_at,
    })),
    // Similar products (same category)
    similar: (similar || []).map((s: any) => ({
      id: s.id,
      productTitle: s.product_title,
      brand: s.brand,
      price: s.price !== null ? Number(s.price) : null,
      regularPrice: s.regular_price !== null ? Number(s.regular_price) : null,
      storeId: s.store_id,
      storeName: friendlyStoreName(s.store_id),
      fetchedAt: s.fetched_at,
    })),
  });
}

/** Map store_id to friendly display name (duplicated from aldi.ts for the API route). */
function friendlyStoreName(storeId: string): string {
  if (storeId === "aldi-sued-national") return "ALDI SÜD";
  const parts = storeId.split("-");
  if (parts[0] === "rewe") {
    const city = parts[1] ? capitalizeCity(parts[1]) : "";
    return `REWE ${city}`.trim();
  }
  if (parts[0] === "aldi") {
    const city = parts[1] ? capitalizeCity(parts[1]) : "";
    return `ALDI SÜD ${city}`.trim();
  }
  return storeId;
}

function capitalizeCity(s: string): string {
  const umlautMap: Record<string, string> = {
    "ae": "ä", "oe": "ö", "ue": "ü", "ss": "ß",
  };
  let result = s;
  for (const [from, to] of Object.entries(umlautMap)) {
    result = result.replace(new RegExp(from, "g"), to);
  }
  return result.charAt(0).toUpperCase() + result.slice(1);
}

export const GET = withErrorHandling(handler);
