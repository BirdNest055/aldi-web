import { NextResponse } from "next/server";
import { getDb } from "@/lib/db-sqlite";

export async function GET() {
  try {
    const db = getDb();
    const pubs = db.prepare("SELECT COUNT(*) as n FROM publications").get();
    const offr = db.prepare("SELECT COUNT(*) as n FROM product_offerings").get();
    return NextResponse.json({
      ok: true,
      runtime: typeof (globalThis as any).Bun !== "undefined" ? "bun" : "node",
      publications: pubs.n,
      offerings: offr.n,
    });
  } catch (e: any) {
    return NextResponse.json({
      ok: false,
      error: e.message,
      stack: (e.stack || "").split("\n").slice(0, 5).join("\n"),
    }, { status: 500 });
  }
}
