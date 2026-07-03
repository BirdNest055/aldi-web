import path from "path";
import fs from "fs";

// Detect runtime: Bun (local dev) vs Node.js (Vercel production)
const isBun = typeof (globalThis as any).Bun !== "undefined";

let _db: any = null;

function getDbPath(): string {
  const candidates = [
    path.join(process.cwd(), "db", "aldi.db"),
    path.join(process.cwd(), "db", "custom.db"), // sandbox fallback
    path.join(process.cwd(), "aldi.db"),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
export function getDb(): any {
  if (!_db) {
    const dbPath = getDbPath();
    if (!fs.existsSync(dbPath)) {
      throw new Error(
        `SQLite database not found at ${dbPath}. ` +
          `On Vercel, ensure the prebuild script runs (bash scripts/sync-db.sh).`
      );
    }

    if (isBun) {
      // Bun has built-in SQLite support
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Database } = require("bun:sqlite");
      _db = new Database(dbPath, { readonly: true });
    } else {
      // Node.js (Vercel production) — use better-sqlite3
      // On Vercel serverless, the filesystem is read-only. Open with the
      // immutable URI parameter so SQLite doesn't try to create -wal/-shm
      // files (which would fail on the read-only Vercel filesystem).
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require("better-sqlite3");
      const uri = `file:${dbPath}?immutable=1`;
      _db = new Database(uri, { readonly: true, fileMustExist: true });
    }
  }
  return _db;
}
