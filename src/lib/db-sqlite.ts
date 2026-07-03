import path from "path";
import fs from "fs";
import os from "os";

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
    const srcPath = getDbPath();
    if (!fs.existsSync(srcPath)) {
      throw new Error(
        `SQLite database not found at ${srcPath}. ` +
          `On Vercel, ensure the prebuild script runs (bash scripts/sync-db.sh).`
      );
    }

    if (isBun) {
      // Bun has built-in SQLite support
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Database } = require("bun:sqlite");
      _db = new Database(srcPath, { readonly: true });
    } else {
      // Node.js (Vercel production) — use better-sqlite3
      // On Vercel serverless, the filesystem is read-only. better-sqlite3
      // needs to create -wal/-shm journal files even in readonly mode, which
      // fails. Workaround: copy the DB to /tmp (writable) and open from there.
      const tmpDir = os.tmpdir();
      const tmpDbPath = path.join(tmpDir, "aldi.db");
      if (!fs.existsSync(tmpDbPath)) {
        fs.copyFileSync(srcPath, tmpDbPath);
      }
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Database = require("better-sqlite3");
      _db = new Database(tmpDbPath, { readonly: true });
    }
  }
  return _db;
}
