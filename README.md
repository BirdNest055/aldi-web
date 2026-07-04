# Discount Database

> **v2.0.0** — Browse all discount products across all supermarkets.

[![Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black)](https://aldi-web-six.vercel.app)
[![Version](https://img.shields.io/badge/version-2.0.0-blue)](#)

**Live:** https://aldi-web-six.vercel.app

## What it does

Shows all discount products from all supermarkets (ALDI SÜD + REWE) stored in Supabase. Filter by store, brand, category, price range, and sale status.

## Features

- **Dashboard:** Stats across all stores (total discounts, unique products, price range)
- **Products browser:** Search, filter by store/brand/category/price/sale, sort, paginate
- **Store list:** See which stores have discounts and their price ranges
- **Brand badges:** Yellow badges for product brands, store brand colors (green=ALDI, red=REWE)
- **Sale indicators:** SALE badge with crossed-out original price + highlighted sale price

## Data source

All data comes from **Supabase** (PostgreSQL). The `discounts` table contains products fetched by:
- **ALDI SÜD:** Direct XHR API (via aldi-map app, instant)
- **REWE:** CloakBrowser + GitHub Actions (via aldi-map app, ~60-90s async)

## Tech stack

- Next.js 16 + TypeScript + Tailwind + shadcn/ui
- Supabase (PostgreSQL) via @supabase/supabase-js
- TanStack Query for server state

## Version history

| Version | Date | Changes |
|---|---|---|
| 2.0.0 | 2026-07-04 | Renamed to Discount Database, switched from SQLite/Prisma to Supabase, shows all stores |
| 1.0.0 | 2026-07-03 | Initial: ALDI-only prospectus explorer with SQLite |

## License

MIT
