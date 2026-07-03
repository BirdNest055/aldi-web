import { NextRequest, NextResponse } from "next/server";
import { listBrands } from "@/lib/aldi";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pubId = sp.get("publicationId")
    ? Number(sp.get("publicationId"))
    : undefined;
  const brands = await listBrands(pubId);
  return NextResponse.json(brands);
}
