import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const candidates = [
    path.join(process.cwd(), "db", "aldi.db"),
    path.join(process.cwd(), "aldi.db"),
    path.join(process.cwd(), "db", "custom.db"),
  ];
  const results = candidates.map(p => ({
    path: p,
    exists: fs.existsSync(p),
    size: fs.existsSync(p) ? fs.statSync(p).size : 0,
  }));
  const isBun = typeof (globalThis as any).Bun !== "undefined";
  return NextResponse.json({
    runtime: isBun ? "bun" : "node",
    cwd: process.cwd(),
    dbCandidates: results,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || "(not set)",
      VERCEL: process.env.VERCEL || "(not set)",
    },
  });
}
