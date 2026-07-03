import { NextRequest, NextResponse } from "next/server";
import { listProducts, type ListProductsParams } from "@/lib/aldi";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const params: ListProductsParams = {};

  if (sp.get("publicationId"))
    params.publicationId = Number(sp.get("publicationId"));
  if (sp.get("search")) params.search = sp.get("search")!;
  if (sp.get("category")) params.category = sp.get("category")!;
  if (sp.get("brand")) params.brand = sp.get("brand")!;
  if (sp.get("onSale") === "1" || sp.get("onSale") === "true")
    params.onSaleOnly = true;
  if (sp.get("minPrice") !== null)
    params.minPrice = Number(sp.get("minPrice"));
  if (sp.get("maxPrice") !== null)
    params.maxPrice = Number(sp.get("maxPrice"));
  if (sp.get("page")) params.page = Number(sp.get("page"));
  if (sp.get("pageSize")) params.pageSize = Number(sp.get("pageSize"));
  if (sp.get("sort"))
    params.sort = sp.get("sort") as ListProductsParams["sort"];

  const result = await listProducts(params);
  return NextResponse.json(result);
}
