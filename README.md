# Discount Database

> **v2.2.0** — Browse all discount products across all supermarkets + comprehensive error handling.

[![Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black)](https://aldi-web-git-main-birdnest055s-projects.vercel.app)
[![Version](https://img.shields.io/badge/version-2.2.0-blue)](#)

**Live:** https://aldi-web-git-main-birdnest055s-projects.vercel.app

## What it does

Shows all discount products from all supermarkets (ALDI SÜD + REWE) stored in Supabase. Filter by store, brand, category, price range, and sale status.

## Features

- **Dashboard:** Stats across all stores (total discounts, unique products, price range)
- **Products browser:** Search, filter by store/brand/category/price/sale, sort, paginate
- **Store list:** See which stores have discounts and their price ranges
- **Brand badges:** Yellow badges for product brands, store brand colors (green=ALDI, red=REWE)
- **Sale indicators:** SALE badge with crossed-out original price + highlighted sale price
- **Error handling:** Typed API errors, retry buttons, error boundaries, health check

## Data source

All data comes from **Supabase** (PostgreSQL). The `discounts` table contains products fetched by:
- **ALDI SÜD:** Direct XHR API (via aldi-map app, instant)
- **REWE:** CloakBrowser + GitHub Actions (via aldi-map app, ~60-90s async)

## Tech stack

- Next.js 16 + TypeScript + Tailwind + shadcn/ui
- Supabase (PostgreSQL) via @supabase/supabase-js
- TanStack Query for server state (with retry: 1 cap to prevent loops)

## Error handling

### Standardized API error response

All API routes return errors in this shape (see `src/lib/errors.ts`):

```json
{
  "error": "listProducts: query failed: connection refused",
  "code": "STORAGE_ERROR",
  "stage": "query",
  "retryable": false,
  "timestamp": "2026-07-04T20:30:00.000Z",
  "cause": "ECONNREFUSED"
}
```

| Code | HTTP | Retryable | When |
|---|---|---|---|
| `STORAGE_ERROR` | 500 | No | Supabase query failed |
| `NOT_FOUND` | 404 | No | Resource not found |
| `CONFIG_ERROR` | 500 | No | Missing env var or bad config |
| `INTERNAL_ERROR` | 500 | No | Unexpected server error |

### Anti-loop guarantees

- **Server-side**: NO automatic retries. Single attempt per request.
- **Client-side**: TanStack Query `retry: 1` (max 1 retry, then show error UI).
- **Manual retry**: error UI has a "Retry" button — user-initiated, no auto-refetch.
- **No recursive triggers**: this is a read-only dashboard, no fetch triggers here.

### Error UI states

- **Dashboard**: red error card with code badge + Retry button
- **Products list**: inline error block with code badge + Retry button
- **Route-level boundary** (`src/app/error.tsx`): catches render errors with Try Again button
- **Global boundary** (`src/app/global-error.tsx`): last-resort for root layout errors

### Health check

`GET /api/health` — verifies Supabase is reachable. Returns:
```json
{
  "status": "healthy" | "degraded",
  "timestamp": "2026-07-04T...",
  "version": "2.2.0",
  "checks": {
    "supabase": { "ok": true, "latencyMs": 42 }
  }
}
```
Use this for uptime monitors (e.g. Vercel cron, BetterUptime, etc.).

## API endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/stats` | GET | Dashboard stats (totals, price range, store list) |
| `/api/products` | GET | Paginated products with filters (storeId, search, category, brand, onSale, minPrice, maxPrice, sort, page, pageSize) |
| `/api/brands` | GET | Brand list with counts + price stats |
| `/api/categories` | GET | Category list with counts |
| `/api/stores` | GET | Store list with discount counts |
| `/api/health` | GET | Health check (200=healthy, 503=degraded) |

## Environment variables

| Var | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Supabase service role key |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL (client-side) |

## Version history

| Version | Date | Changes |
|---|---|---|
| 2.2.0 | 2026-07-04 | Comprehensive error handling: typed ApiError, error UI states, retry buttons, error boundaries, health check, removed broken prebuild script + Prisma deps |
| 2.1.0 | 2026-07-04 | Default sort = price ascending (cheapest first) |
| 2.0.0 | 2026-07-04 | Renamed to Discount Database, switched from SQLite/Prisma to Supabase, shows all stores |
| 1.0.0 | 2026-07-03 | Initial: ALDI-only prospectus explorer with SQLite |

## License

MIT
