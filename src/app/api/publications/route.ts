import { NextResponse } from "next/server";
import { listPublications } from "@/lib/aldi";

export async function GET() {
  const pubs = await listPublications();
  return NextResponse.json(pubs);
}
