# CLAUDE.md — discount-database

## What this app does
Browse all discount products across all stores with filtering, sorting, charts,
and cross-data analysis. 6 tabs: Dashboard, Products, Hot Deals, Leaderboard,
Compare, Analysis.

## Key files
- `src/app/page.tsx` — main page with 6 tabs
- `src/lib/aldi.ts` — Supabase query layer (MUST paginate — 500 per page)
- `src/components/ProductDetail.tsx` — product detail side sheet
- `src/components/tabs/HotDealsTab.tsx` — top 24 biggest discounts
- `src/components/tabs/LeaderboardTab.tsx` — Recharts bar charts per store
- `src/components/tabs/PriceComparisonTab.tsx` — heatmap table
- `src/components/tabs/AnalysisTab.tsx` — 8 cross-data analysis views
- `src/app/api/analysis/route.ts` — 7 analysis types (overview, prices, brands, etc.)

## CRITICAL: Pagination
All functions in aldi.ts MUST paginate (Supabase caps at 1000 rows).
Use `.range(offset, offset + 499)` with `.order("id")` for deterministic sorting.

## Current version: 2.9.0
## Tech: Next.js 16, Tailwind v4, Supabase, Recharts, TanStack Query
## Live URL: https://aldi-web-git-main-birdnest055s-projects.vercel.app
