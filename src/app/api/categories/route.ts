import { NextResponse } from "next/server";
import { listCategories } from "@/lib/aldi";
import { withErrorHandling } from "@/lib/errors";

async function handler() {
  const cats = await listCategories();
  return NextResponse.json(cats);
}

export const GET = withErrorHandling(handler);
