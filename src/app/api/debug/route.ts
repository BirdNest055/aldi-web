import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  const dbPath = path.join(process.cwd(), "db", "aldi.db");
  const exists = fs.existsSync(dbPath);
  const size = exists ? fs.statSync(dbPath).size : 0;

  let dbError: string | null = null;
  let dbOpened = false;
  let rowCount = 0;

  if (exists) {
    try {
      // Try to open with better-sqlite3
      const Database = require("better-sqlite3");
      const db = new Database(dbPath, { readonly: true });
      const row = db.prepare("SELECT COUNT(*) as n FROM publications").get();
      rowCount = row.n;
      dbOpened = true;
      db.close();
    } catch (e: any) {
      dbError = e.message + "\n" + (e.stack || "").split("\n").slice(0, 5).join("\n");
    }
  }

  return NextResponse.json({
    runtime: typeof (globalThis as any).Bun !== "undefined" ? "bun" : "node",
    dbPath,
    exists,
    size,
    dbOpened,
    rowCount,
    dbError,
  });
}
