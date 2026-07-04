import { NextResponse } from "next/server";
import { listStores } from "@/lib/aldi";
import { withErrorHandling } from "@/lib/errors";

async function handler() {
  const stores = await listStores();
  return NextResponse.json(stores);
}

export const GET = withErrorHandling(handler);
