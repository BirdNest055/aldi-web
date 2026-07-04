import { NextResponse } from "next/server";
import { listBrands } from "@/lib/aldi";
import { withErrorHandling } from "@/lib/errors";

async function handler() {
  const brands = await listBrands();
  return NextResponse.json(brands);
}

export const GET = withErrorHandling(handler);
