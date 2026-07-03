import { NextResponse } from "next/server";
import { getProductDetail, getPriceHistory } from "@/lib/aldi";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  const view = new URL(_req.url).searchParams.get("view") ?? "detail";

  if (view === "history") {
    const history = await getPriceHistory(key);
    if (!history) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(history);
  }

  const detail = await getProductDetail(key);
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
}
