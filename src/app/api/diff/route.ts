import { NextRequest, NextResponse } from "next/server";
import { getDiff } from "@/lib/aldi";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const a = Number(sp.get("a"));
  const b = Number(sp.get("b"));
  if (!a || !b) {
    return NextResponse.json(
      { error: "Both 'a' and 'b' publication ids are required" },
      { status: 400 }
    );
  }
  try {
    const diff = await getDiff(a, b);
    return NextResponse.json(diff);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 404 }
    );
  }
}
