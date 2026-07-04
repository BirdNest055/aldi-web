import { NextResponse } from "next/server";
import { getStats } from "@/lib/aldi";
import { withErrorHandling } from "@/lib/errors";

async function handler() {
  const stats = await getStats();
  return NextResponse.json(stats);
}

export const GET = withErrorHandling(handler);
