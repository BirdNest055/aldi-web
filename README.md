# aldi-web

> Browse ALDI SÜD prospectus data with filters, price history charts, and week-over-week diffs.

[![Vercel](https://img.shields.io/badge/deployed%20on-Vercel-black)](https://aldi-web-six.vercel.app)
[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**Live app:** https://aldi-web-six.vercel.app

## What it does

A web interface for the [aldi-cli](https://github.com/BirdNest055/aldi-cli) database. Browse products by brand, category, price range, or sale status. Click any product to see its price history chart and full offering details across weeks. Compare two publications side-by-side to see what's new, what's gone, and what changed price.

## Features

### Dashboard
- Stats cards: publications tracked, unique products, total offerings, price range
- Publication list with validity date ranges (e.g. "29.06. – 04.07.2026")

### Products browser
- **Search** by product name, description, or brand
- **Filter** by publication, category, brand, price range
- **Sort** by name, price, or newest
- **On-sale-only** checkbox to filter discounted items
- Brand badges (yellow) on every product
- SALE badges with crossed-out original price + highlighted sale price
- Paginated (50 per page)
- Click any product → detail drawer with:
  - Price history line chart (Recharts)
  - All offerings across weeks (with brand, price, sale price, photos, labels)
  - SCD2 title/description/brand history (shows when ALDI renamed or rebranded something)

### Week-over-week diff
- Pick two publications
- See three columns: Added (green), Removed (red), Price changes (yellow with % delta)

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Database | SQLite (via better-sqlite3 on Vercel, bun:sqlite locally) |
| Server state | TanStack Query |
| Charts | Recharts |
| Tests | Vitest (30 tests, TDD) |
| Deployment | Vercel (auto-deploy on push to main) |

## How it works

```
aldi-cli repo (daily fetch)
  └─ commits aldi.db to GitHub
      └─ Vercel deploy hook triggers
          └─ aldi-web rebuilds on Vercel
              └─ prebuild: downloads aldi.db from aldi-cli repo
              └─ next build: bundles DB into serverless functions
              └─ API routes query DB via better-sqlite3
                  └─ UI renders with live data
```

The web app reads from the same `aldi.db` that the CLI produces. No separate database — just a SQLite file downloaded at build time.

## Local development

```bash
git clone https://github.com/BirdNest055/aldi-web.git
cd aldi-web
bun install

# The dev server uses bun:sqlite (built into Bun) and reads db/aldi.db
# Make sure you have a DB file (fetch one from the aldi-cli repo or run the CLI)
mkdir -p db
curl -sL https://raw.githubusercontent.com/BirdNest055/aldi-cli/main/aldi.db -o db/aldi.db

bun run dev
# → http://localhost:3000
```

### Run tests

```bash
bun run test     # 30 vitest tests
bun run lint     # eslint
```

## Dev / Prod branches

| Branch | Purpose | Deploys to |
|---|---|---|
| `main` | Production | Vercel production (auto on push) |
| `dev` | Development | Vercel preview (auto on push) |

**Workflow:**
1. Make changes on `dev`
2. Push to `dev` → Vercel creates a preview deployment
3. Test the preview URL
4. Merge `dev` → `main` → Vercel deploys to production

## API endpoints

| Endpoint | Returns |
|---|---|
| `GET /api/stats` | Dashboard stats (counts, price range, publication list) |
| `GET /api/products` | Paginated products with filters (`?search=`, `?brand=`, `?category=`, `?minPrice=`, `?maxPrice=`, `?onSale=1`, `?sort=`, `?page=`, `?pageSize=`) |
| `GET /api/products/[key]` | Product detail (offerings, photos, labels, SCD2 history) |
| `GET /api/products/[key]?view=history` | Price history across all publications |
| `GET /api/brands` | All brands with count + avg/min/max price |
| `GET /api/categories` | All categories with count |
| `GET /api/diff?a=X&b=Y` | Week-over-week diff (added, removed, price changes) |
| `GET /api/publications` | All publications |

## Project structure

```
aldi-web/
├── src/
│   ├── app/
│   │   ├── page.tsx              ← main UI (Dashboard, Products, Diff tabs)
│   │   ├── layout.tsx            ← root layout (dark mode, QueryProvider)
│   │   ├── globals.css           ← ALDI yellow dark theme
│   │   └── api/
│   │       ├── stats/route.ts
│   │       ├── products/route.ts
│   │       ├── products/[key]/route.ts
│   │       ├── brands/route.ts
│   │       ├── categories/route.ts
│   │       ├── diff/route.ts
│   │       └── publications/route.ts
│   ├── lib/
│   │   ├── aldi.ts               ← query layer (8 exported functions, all tested)
│   │   ├── db-sqlite.ts          ← dual-runtime DB client (Bun + Node)
│   │   └── utils.ts              ← shadcn utils
│   └── components/
│       ├── query-provider.tsx    ← TanStack Query provider
│       └── ui/                   ← shadcn/ui components
├── scripts/
│   └── sync-db.sh                ← build-time DB download from aldi-cli repo
├── prisma/schema.prisma          ← schema reference (not used at runtime)
├── tests/aldi.test.ts            ← 30 TDD tests
├── vercel.json                   ← Vercel build config
├── next.config.ts                ← outputFileTracingIncludes for DB bundling
└── package.json
```

## Vercel configuration

| Setting | Value |
|---|---|
| Framework | Next.js |
| Build command | `bun run prebuild && next build` |
| Install command | `bun install` |
| Node version | 24.x |
| Region | iad1 (US East) |

### Environment variables

| Var | Value | Purpose |
|---|---|---|
| `DATABASE_URL` | `file:db/aldi.db` | SQLite path (relative to project root) |
| `GITHUB_TOKEN` | (GitHub PAT) | Downloads aldi.db from the aldi-cli repo at build time |

### Build-time DB sync

The `prebuild` script (`scripts/sync-db.sh`) downloads the latest `aldi.db` from the `BirdNest055/aldi-cli` repo before `next build` runs. This ensures the web app always has the latest data.

The DB file is bundled into the serverless function via `outputFileTracingIncludes` in `next.config.ts`. At runtime, it's copied to `/tmp` (writable on Vercel) and opened read-only with `better-sqlite3`.

## License

MIT — see [LICENSE](LICENSE).
