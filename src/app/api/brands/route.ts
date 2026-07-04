import { NextResponse } from "next/server";
import { listBrands } from "@/lib/aldi";
export async function GET() {
  const brands = await listBrands();
  return NextResponse.json(brands);
}
