#!/bin/bash
# Build-time DB sync: downloads the latest aldi.db from the aldi-cli GitHub repo.
# This runs before `next build` on Vercel so the serverless functions have the
# DB bundled at runtime.
#
# Requires GITHUB_TOKEN env var (for accessing the private aldi.db file —
# even though the repo is public, the raw content API sometimes needs auth).
#
# On Vercel: set GITHUB_TOKEN in Project Settings → Environment Variables.
# Locally: the db/aldi.db file is used directly (no download needed).

set -euo pipefail

DB_PATH="${1:-db/aldi.db}"
ALDI_CLI_REPO="BirdNest055/aldi-cli"
GITHUB_RAW_URL="https://raw.githubusercontent.com/${ALDI_CLI_REPO}/main/aldi.db"

# If the DB already exists locally (dev environment), skip download
if [ -f "$DB_PATH" ] && [ "${SKIP_DB_SYNC:-0}" = "1" ]; then
  echo "[sync-db] SKIP_DB_SYNC=1 — using existing $DB_PATH"
  exit 0
fi

# If running on Vercel (CI=true, VERCEL=1), always download
if [ "${VERCEL:-}" = "1" ] || [ "${CI:-}" = "true" ]; then
  echo "[sync-db] Running in CI/Vercel — downloading latest aldi.db from GitHub"
  mkdir -p "$(dirname "$DB_PATH")"

  # Try with auth first (works for both public and private repos)
  if [ -n "${GITHUB_TOKEN:-}" ]; then
    echo "[sync-db] Downloading with GitHub token..."
    curl -sL -H "Authorization: token ${GITHUB_TOKEN}" \
         -H "Accept: application/vnd.github.raw" \
         "https://api.github.com/repos/${ALDI_CLI_REPO}/contents/aldi.db" \
         -o "$DB_PATH"
  else
    echo "[sync-db] No GITHUB_TOKEN — downloading from public raw URL..."
    curl -sL "$GITHUB_RAW_URL" -o "$DB_PATH"
  fi

  # Verify it's a valid SQLite database (magic header: SQLite format 3)
  if head -c 16 "$DB_PATH" | grep -q "SQLite format 3"; then
    SIZE=$(wc -c < "$DB_PATH")
    echo "[sync-db] ✅ Downloaded aldi.db ($SIZE bytes) to $DB_PATH"

    # Remove -wal and -shm files if they were downloaded alongside
    # (these are write-ahead-log files that shouldn't be committed and
    # can cause "unable to open database file" errors on read-only filesystems)
    rm -f "${DB_PATH}-wal" "${DB_PATH}-shm" 2>/dev/null || true

    # Quick stats
    if command -v sqlite3 &>/dev/null; then
      PUBS=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM publications" 2>/dev/null || echo "?")
      OFFR=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM product_offerings" 2>/dev/null || echo "?")
      echo "[sync-db] Publications: $PUBS, Offerings: $OFFR"
    fi
  else
    echo "[sync-db] ❌ Downloaded file is not a valid SQLite database"
    head -c 200 "$DB_PATH"
    exit 1
  fi
else
  echo "[sync-db] Local environment — using existing $DB_PATH"
  if [ ! -f "$DB_PATH" ]; then
    echo "[sync-db] ❌ $DB_PATH not found. Run the aldi-cli fetcher first."
    exit 1
  fi
fi
