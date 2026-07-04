import { NextResponse } from "next/server";
import { listStores } from "@/lib/aldi";
export async function GET() {
  const stores = await listStores();
  return NextResponse.json(stores);
}
