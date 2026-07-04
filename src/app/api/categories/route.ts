import { NextResponse } from "next/server";
import { listCategories } from "@/lib/aldi";
export async function GET() {
  const cats = await listCategories();
  return NextResponse.json(cats);
}
