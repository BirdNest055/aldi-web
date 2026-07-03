import { NextRequest, NextResponse } from "next/server";
import { listCategories } from "@/lib/aldi";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const pubId = sp.get("publicationId")
    ? Number(sp.get("publicationId"))
    : undefined;
  const cats = await listCategories(pubId);
  return NextResponse.json(cats);
}
