import { NextRequest, NextResponse } from "next/server";
import { listProducts, type ListProductsParams } from "@/lib/aldi";
import { withErrorHandling, Errors } from "@/lib/errors";

async function handler(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const params: ListProductsParams = {};

  if (sp.get("storeId")) params.storeId = sp.get("storeId")!;
  if (sp.get("search")) params.search = sp.get("search")!;
  if (sp.get("category")) params.category = sp.get("category")!;
  if (sp.get("brand")) params.brand = sp.get("brand")!;
  if (sp.get("onSale") === "1" || sp.get("onSale") === "true") params.onSaleOnly = true;
  if (sp.get("minPrice") !== null) {
    const n = Number(sp.get("minPrice"));
    if (!isNaN(n)) params.minPrice = n;
  }
  if (sp.get("maxPrice") !== null) {
    const n = Number(sp.get("maxPrice"));
    if (!isNaN(n)) params.maxPrice = n;
  }
  if (sp.get("page")) {
    const n = Number(sp.get("page"));
    if (!isNaN(n) && n > 0) params.page = n;
  }
  if (sp.get("pageSize")) {
    const n = Number(sp.get("pageSize"));
    if (!isNaN(n) && n > 0 && n <= 200) params.pageSize = n;
  }
  if (sp.get("sort")) {
    const s = sp.get("sort") as ListProductsParams["sort"];
    const valid: ListProductsParams["sort"][] = [
      "price-asc", "price-desc", "title-asc", "title-desc", "discount-pct", "newest",
    ];
    if (valid.includes(s)) params.sort = s;
  }

  const result = await listProducts(params);
  return NextResponse.json(result);
}

export const GET = withErrorHandling(handler);
