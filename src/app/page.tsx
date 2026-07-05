"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, Package, Store as StoreIcon, Tag, Search, Filter, ArrowUpDown,
  ChevronLeft, ChevronRight, X, AlertCircle, RefreshCw, MapPin, Percent,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { ProductDetail } from "@/components/ProductDetail";

type SortOption = "title-asc" | "title-desc" | "price-asc" | "price-desc" | "discount-pct" | "newest";

interface Stats {
  totalDiscounts: number;
  uniqueProducts: number;
  uniqueBrands: number;
  uniqueCategories: number;
  storesWithDiscounts: number;
  priceMin: number | null;
  priceMax: number | null;
  priceAvg: number | null;
  storeList: Array<{ store_id: string; count: number; min_price: number | null; max_price: number | null; }>;
}

interface ProductListItem {
  id: number;
  store_id: string;
  product_title: string;
  brand: string | null;
  price: number | null;
  regular_price: number | null;
  currency: string;
  category: string | null;
  fetched_at: string;
}

interface ProductListResult {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface BrandEntry { name: string; count: number; avgPrice: number | null; }
interface CategoryEntry { name: string; count: number; }
interface StoreEntry { store_id: string; brand: string; name: string; address: string; discountCount: number; }

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const fmtPrice = (n: number | null, cur = "EUR") => {
  if (n === null) return "—";
  return `${n.toFixed(2)} ${cur === "EUR" ? "€" : cur}`;
};
const fmtNum = (n: number) => n.toLocaleString("de-DE");
const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const STORE_BRAND_COLORS: Record<string, string> = {
  "aldi-sued": "#1a7a3a",
  "rewe": "#e30613",
};

/** Compute discount % from price and regular_price. Returns null if no discount. */
function discountPct(price: number | null, regular: number | null): number | null {
  if (price === null || regular === null || regular <= 0 || price >= regular) return null;
  return Math.round((1 - price / regular) * 100);
}

/** Compute savings amount in euros. Returns null if no discount. */
function savingsEur(price: number | null, regular: number | null): number | null {
  if (price === null || regular === null || price >= regular) return null;
  return regular - price;
}

/** Map a store_id to friendly display name. */
function friendlyStoreName(storeId: string): string {
  if (storeId === "aldi-sued-national") return "ALDI SÜD";
  const parts = storeId.split("-");
  if (parts[0] === "rewe") {
    return `REWE ${capitalizeCity(parts[1] || "")}`.trim();
  }
  if (parts[0] === "aldi") {
    return `ALDI SÜD ${capitalizeCity(parts[1] || "")}`.trim();
  }
  return storeId;
}

/** Get brand key from store_id. */
function brandFromStoreId(storeId: string): string {
  if (storeId === "aldi-sued-national") return "aldi-sued";
  if (storeId.startsWith("aldi")) return "aldi-sued";
  if (storeId.startsWith("rewe")) return "rewe";
  return "other";
}

/** Capitalize + handle German umlaut replacements from slugification. */
function capitalizeCity(s: string): string {
  const umlautMap: Record<string, string> = {
    "ae": "ä", "oe": "ö", "ue": "ü", "ss": "ß",
  };
  let result = s;
  // Only replace if it looks like a slugified umlaut (between word boundaries)
  // Simple heuristic: "nuernberg" → "Nürnberg", "muenchen" → "München"
  for (const [from, to] of Object.entries(umlautMap)) {
    result = result.replace(new RegExp(from, "g"), to);
  }
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/** Sanitize error messages — never show DB internals to users. */
function sanitizeError(msg: string | undefined): string {
  if (!msg) return "Something went wrong. Please try again.";
  // Hide anything that looks like a SQL/Postgres error
  if (/invalid input syntax|relation|column|syntax error|numeric/i.test(msg)) {
    return "Database query failed. Please try again or adjust your filters.";
  }
  // Hide anything with file paths or stack traces
  if (msg.includes("at /") || msg.includes("node_modules")) {
    return "Server error. Please try again.";
  }
  return msg;
}

// ─────────────────────────────────────────────────────────────────────────────
// URL state sync (deep-linking)
// ─────────────────────────────────────────────────────────────────────────────

interface Filters {
  storeId: string;
  search: string;
  category: string;
  brand: string;
  onSaleOnly: boolean;
  minPrice: string;
  maxPrice: string;
  sort: SortOption;
  page: number;
}

const DEFAULT_FILTERS: Filters = {
  storeId: "all",
  search: "",
  category: "all",
  brand: "all",
  onSaleOnly: false,
  minPrice: "",
  maxPrice: "",
  sort: "price-asc",
  page: 1,
};

function filtersFromUrl(): Filters {
  if (typeof window === "undefined") return DEFAULT_FILTERS;
  const sp = new URLSearchParams(window.location.search);
  const f: Filters = { ...DEFAULT_FILTERS };
  if (sp.get("storeId")) f.storeId = sp.get("storeId")!;
  if (sp.get("search")) f.search = sp.get("search")!;
  if (sp.get("category")) f.category = sp.get("category")!;
  if (sp.get("brand")) f.brand = sp.get("brand")!;
  if (sp.get("onSale") === "1") f.onSaleOnly = true;
  if (sp.get("minPrice")) f.minPrice = sp.get("minPrice")!;
  if (sp.get("maxPrice")) f.maxPrice = sp.get("maxPrice")!;
  if (sp.get("sort")) f.sort = sp.get("sort") as SortOption;
  if (sp.get("page")) f.page = Math.max(1, Number(sp.get("page")) || 1);
  if (sp.get("tab")) {/* read but not stored in Filters */}
  return f;
}

function filtersToUrl(f: Filters, tab: string): string {
  const sp = new URLSearchParams();
  if (f.storeId !== "all") sp.set("storeId", f.storeId);
  if (f.search) sp.set("search", f.search);
  if (f.category !== "all") sp.set("category", f.category);
  if (f.brand !== "all") sp.set("brand", f.brand);
  if (f.onSaleOnly) sp.set("onSale", "1");
  if (f.minPrice) sp.set("minPrice", f.minPrice);
  if (f.maxPrice) sp.set("maxPrice", f.maxPrice);
  if (f.sort !== "price-asc") sp.set("sort", f.sort);
  if (f.page !== 1) sp.set("page", String(f.page));
  sp.set("tab", tab);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [tab, setTab] = useState<"dashboard" | "products">(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get("tab");
      if (t === "products" || t === "dashboard") return t;
    }
    return "dashboard";
  });

  // Sync tab to URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  }, [tab]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <span className="font-mono font-bold text-primary-foreground text-sm">D</span>
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">Discount Database <span className="text-xs text-muted-foreground font-normal">v2.4.0</span></h1>
              <p className="text-xs text-muted-foreground mt-0.5">All products across all stores</p>
            </div>
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="ml-auto">
            <TabsList>
              <TabsTrigger value="dashboard" className="gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Dashboard</TabsTrigger>
              <TabsTrigger value="products" className="gap-1.5"><Package className="w-3.5 h-3.5" /> Products</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        {tab === "dashboard" && <Dashboard />}
        {tab === "products" && <ProductsView />}
      </main>

      <footer className="border-t border-border bg-card/30 mt-auto">
        <div className="container mx-auto px-4 py-3 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
          <span>Data from <code className="font-mono">Supabase</code> · ALDI SÜD + REWE</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: STORE_BRAND_COLORS["aldi-sued"] }} />
              ALDI SÜD
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: STORE_BRAND_COLORS["rewe"] }} />
              REWE
            </span>
            <span className="font-mono">v2.4.0</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────

function Dashboard() {
  const { data: stats, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const r = await fetch("/api/stats");
      const data = await r.json();
      if (!r.ok) {
        const err = new Error("Failed to load dashboard") as Error & { code?: string };
        err.code = data.code;
        throw err;
      }
      return data as Stats;
    },
    retry: 1,
  });

  if (isLoading) return <DashboardSkeleton />;
  if (isError || !stats) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-destructive text-sm">
                Failed to load dashboard
                {(error as any)?.code && (
                  <span className="ml-2 font-mono text-xs px-1.5 py-0.5 rounded bg-destructive/10">
                    {(error as any).code}
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {sanitizeError((error as Error)?.message)}
              </p>
              <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => refetch()}>
                <RefreshCw className="w-3.5 h-3.5" /> Retry
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={StoreIcon} label="Stores" value={fmtNum(stats.storesWithDiscounts)} sub="with discounts" />
        <StatCard icon={Package} label="Products" value={fmtNum(stats.uniqueProducts)} sub="unique" />
        <StatCard icon={Tag} label="Discounts" value={fmtNum(stats.totalDiscounts)} sub="total entries" highlight />
        <StatCard icon={TrendingUp} label="Price range" value={`${fmtPrice(stats.priceMin)} – ${fmtPrice(stats.priceMax)}`} sub={`avg ${fmtPrice(stats.priceAvg)}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <StoreIcon className="w-4 h-4" /> Stores with Discounts
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {stats.storeList.map((s) => {
              const brand = brandFromStoreId(s.store_id);
              const color = STORE_BRAND_COLORS[brand] || "#888";
              return (
                <div key={s.store_id} className="flex items-center justify-between px-6 py-3 hover:bg-accent/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} title={brand} />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{friendlyStoreName(s.store_id)}</div>
                      <div className="text-xs text-muted-foreground font-mono truncate">{s.store_id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm shrink-0">
                    <span className="text-muted-foreground">{fmtNum(s.count)} <span className="hidden sm:inline">discounts</span></span>
                    <span className="font-mono text-xs text-muted-foreground">{fmtPrice(s.min_price)} – {fmtPrice(s.max_price)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, highlight }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string; value: string; sub: string; highlight?: boolean;
}) {
  return (
    <Card className={cn(highlight && "border-primary/50 bg-primary/5")}>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon className={cn("w-4 h-4 text-muted-foreground", highlight && "text-primary")} />
        </div>
        <div className={cn("text-2xl font-semibold font-mono", highlight && "text-primary")}>{value}</div>
        <div className="text-xs text-muted-foreground mt-1">{sub}</div>
      </CardContent>
    </Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}><CardContent className="pt-5">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-3 w-16 mt-2" />
          </CardContent></Card>
        ))}
      </div>
      <Card><CardContent className="pt-6">
        <Skeleton className="h-4 w-32 mb-4" />
        <div className="space-y-3">{[...Array(5)].map((_, i) => (<Skeleton key={i} className="h-10 w-full" />))}</div>
      </CardContent></Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Products view
// ─────────────────────────────────────────────────────────────────────────────

function ProductsView() {
  // Initialize from URL for deep-linking
  const [filters, setFilters] = useState<Filters>(() => filtersFromUrl());

  // Product detail sheet state
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Sync to URL whenever filters change
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = filtersToUrl(filters, "products");
    window.history.replaceState({}, "", `${window.location.pathname}${url}`);
  }, [filters]);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search);
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setFilters((f) => ({ ...f, page: 1 }));
    }, 300);
    return () => clearTimeout(t);
  }, [filters.search]);

  const updateFilter = useCallback(<K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((f) => ({ ...f, [key]: value, page: key === "page" ? (value as number) : 1 }));
  }, []);

  const clearAll = useCallback(() => setFilters(DEFAULT_FILTERS), []);
  const clearSearch = useCallback(() => setFilters((f) => ({ ...f, search: "", page: 1 })), []);

  const hasActiveFilters = useMemo(() => {
    return filters.storeId !== "all" ||
           filters.search !== "" ||
           filters.category !== "all" ||
           filters.brand !== "all" ||
           filters.onSaleOnly ||
           filters.minPrice !== "" ||
           filters.maxPrice !== "";
  }, [filters]);

  const { data: storesData } = useQuery({
    queryKey: ["stores-list"],
    queryFn: async () => {
      const r = await fetch("/api/stores");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      return d as StoreEntry[];
    },
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const r = await fetch("/api/categories");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      return d as CategoryEntry[];
    },
  });
  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const r = await fetch("/api/brands");
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      return d as BrandEntry[];
    },
  });

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.storeId !== "all") p.set("storeId", filters.storeId);
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (filters.category !== "all") p.set("category", filters.category);
    if (filters.brand !== "all") p.set("brand", filters.brand);
    if (filters.onSaleOnly) p.set("onSale", "1");
    if (filters.minPrice) p.set("minPrice", filters.minPrice);
    if (filters.maxPrice) p.set("maxPrice", filters.maxPrice);
    p.set("sort", filters.sort);
    p.set("page", String(filters.page));
    p.set("pageSize", "50");
    return p.toString();
  }, [filters, debouncedSearch]);

  const { data, isLoading, isError: isProductsError, error: productsError, refetch: refetchProducts } = useQuery({
    queryKey: ["products", qs],
    queryFn: async () => {
      const r = await fetch(`/api/products?${qs}`);
      const d = await r.json();
      if (!r.ok) {
        const err = new Error("Failed to load products") as Error & { code?: string };
        err.code = d.code;
        throw err;
      }
      return d as ProductListResult;
    },
    retry: 1,
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;
  const storesWithDiscounts = storesData?.filter((s) => s.discountCount > 0) ?? [];

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <Card><CardContent className="pt-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products, brands, categories…"
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
              className="pl-9 pr-8"
            />
            {filters.search && (
              <button
                onClick={clearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <div className="md:col-span-2">
            <Select value={filters.storeId} onValueChange={(v) => updateFilter("storeId", v)}>
              <SelectTrigger><SelectValue placeholder="Store" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {storesWithDiscounts.map((s) => (
                  <SelectItem key={s.store_id} value={s.store_id}>
                    <span className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: STORE_BRAND_COLORS[s.brand] || "#888" }} />
                      {s.name} ({s.discountCount})
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select value={filters.category} onValueChange={(v) => updateFilter("category", v)}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(categories ?? []).slice(0, 50).map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.name} ({c.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select value={filters.brand} onValueChange={(v) => updateFilter("brand", v)}>
              <SelectTrigger><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {(brands ?? []).slice(0, 60).map((b) => (
                  <SelectItem key={b.name} value={b.name}>{b.name} ({b.count})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select value={filters.sort} onValueChange={(v) => updateFilter("sort", v as SortOption)}>
              <SelectTrigger><ArrowUpDown className="w-3.5 h-3.5 mr-1.5 inline" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="price-asc">Price ↑</SelectItem>
                <SelectItem value="price-desc">Price ↓</SelectItem>
                <SelectItem value="discount-pct">Discount % ↓</SelectItem>
                <SelectItem value="title-asc">Name A-Z</SelectItem>
                <SelectItem value="title-desc">Name Z-A</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer text-xs select-none">
            <input
              type="checkbox"
              checked={filters.onSaleOnly}
              onChange={(e) => updateFilter("onSaleOnly", e.target.checked)}
              className="w-4 h-4 rounded accent-primary"
            />
            <span className="text-muted-foreground">On sale only</span>
          </label>
          <span className="text-muted-foreground hidden sm:inline">·</span>
          <Filter className="w-3.5 h-3.5 text-muted-foreground hidden sm:inline" />
          <span className="text-xs text-muted-foreground hidden sm:inline">Price:</span>
          <Input
            type="number"
            step="0.01"
            placeholder="min"
            value={filters.minPrice}
            onChange={(e) => updateFilter("minPrice", e.target.value)}
            className="w-24 h-8 text-xs"
          />
          <span className="text-xs text-muted-foreground">—</span>
          <Input
            type="number"
            step="0.01"
            placeholder="max"
            value={filters.maxPrice}
            onChange={(e) => updateFilter("maxPrice", e.target.value)}
            className="w-24 h-8 text-xs"
          />
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="ml-auto text-xs h-8" onClick={clearAll}>
              <X className="w-3 h-3 mr-1" /> Clear all
            </Button>
          )}
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {filters.search && (
              <FilterChip label={`Search: "${filters.search}"`} onRemove={clearSearch} />
            )}
            {filters.storeId !== "all" && (
              <FilterChip
                label={`Store: ${storesWithDiscounts.find((s) => s.store_id === filters.storeId)?.name ?? filters.storeId}`}
                onRemove={() => updateFilter("storeId", "all")}
              />
            )}
            {filters.category !== "all" && (
              <FilterChip label={`Category: ${filters.category}`} onRemove={() => updateFilter("category", "all")} />
            )}
            {filters.brand !== "all" && (
              <FilterChip label={`Brand: ${filters.brand}`} onRemove={() => updateFilter("brand", "all")} />
            )}
            {filters.onSaleOnly && (
              <FilterChip label="On sale only" onRemove={() => updateFilter("onSaleOnly", false)} />
            )}
            {(filters.minPrice || filters.maxPrice) && (
              <FilterChip
                label={`Price: ${filters.minPrice || "0"} – ${filters.maxPrice || "∞"} €`}
                onRemove={() => { updateFilter("minPrice", ""); updateFilter("maxPrice", ""); }}
              />
            )}
          </div>
        )}
      </CardContent></Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {isLoading ? "Loading…" : `${fmtNum(data?.total ?? 0)} products`}
        </span>
        {data && <span className="text-muted-foreground text-xs font-mono">page {filters.page} of {totalPages}</span>}
      </div>

      <Card><CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(8)].map((_, i) => (<Skeleton key={i} className="h-12 w-full" />))}</div>
        ) : isProductsError ? (
          <div className="p-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-destructive text-sm">
                Failed to load products
                {(productsError as any)?.code && (
                  <span className="ml-2 font-mono text-xs px-1.5 py-0.5 rounded bg-destructive/10">
                    {(productsError as any).code}
                  </span>
                )}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {sanitizeError((productsError as Error)?.message)}
              </p>
              <div className="flex gap-2 mt-3">
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => refetchProducts()}>
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </Button>
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" className="gap-1.5" onClick={clearAll}>
                    <X className="w-3.5 h-3.5" /> Clear filters
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : data && data.items.length > 0 ? (
          <div className="divide-y divide-border">
            {data.items.map((p) => {
              const onSale = p.regular_price !== null && p.price !== null && p.regular_price > p.price;
              const brand = brandFromStoreId(p.store_id);
              const brandColor = STORE_BRAND_COLORS[brand] || "#888";
              const dPct = discountPct(p.price, p.regular_price);
              const savings = savingsEur(p.price, p.regular_price);
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-4 px-4 py-3 hover:bg-accent/40 transition-colors cursor-pointer"
                  onClick={() => {
                    setSelectedProductId(p.id);
                    setDetailOpen(true);
                  }}
                >
                  {/* Brand color dot */}
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: brandColor }} title={brand} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{p.product_title}</span>
                      {p.brand && (
                        <Badge className="text-xs shrink-0 bg-primary/15 text-primary border-primary/30">{p.brand}</Badge>
                      )}
                      {p.category && (
                        <Badge variant="secondary" className="text-xs shrink-0 hidden sm:inline">{p.category.split(" - ")[0]}</Badge>
                      )}
                      {onSale && dPct !== null && (
                        <Badge variant="destructive" className="text-xs shrink-0 gap-0.5">
                          <Percent className="w-2.5 h-2.5" /> {dPct}%
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span style={{ color: brandColor }} className="font-medium">{friendlyStoreName(p.store_id)}</span>
                      <span className="hidden sm:inline">·</span>
                      <span className="hidden sm:inline">{fmtDate(p.fetched_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      {onSale ? (
                        <>
                          <div className="font-mono font-semibold text-sm text-primary">{fmtPrice(p.price, p.currency)}</div>
                          <div className="text-xs text-muted-foreground line-through">{fmtPrice(p.regular_price, p.currency)}</div>
                          {savings !== null && (
                            <div className="text-[10px] text-emerald-600 mt-0.5">save {fmtPrice(savings, p.currency)}</div>
                          )}
                        </>
                      ) : (
                        <div className="font-mono font-semibold text-sm">{fmtPrice(p.price, p.currency)}</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-12 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No products match your filters</p>
            <p className="text-xs text-muted-foreground mt-1">Try removing a filter or widening your price range.</p>
            {hasActiveFilters && (
              <Button variant="outline" size="sm" className="mt-4 gap-1.5" onClick={clearAll}>
                <X className="w-3.5 h-3.5" /> Clear all filters
              </Button>
            )}
          </div>
        )}
      </CardContent></Card>

      {/* Pagination — at bottom too */}
      {data && data.items.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground text-xs font-mono">page {filters.page} of {totalPages}</span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={filters.page <= 1}
              onClick={() => updateFilter("page", filters.page - 1)}
            >
              <ChevronLeft className="w-3.5 h-3.5" /> Prev
            </Button>
            {/* Jump to page (compact) */}
            <Input
              type="number"
              min={1}
              max={totalPages}
              value={filters.page}
              onChange={(e) => {
                const p = Number(e.target.value);
                if (p >= 1 && p <= totalPages) updateFilter("page", p);
              }}
              className="w-14 h-8 text-xs text-center"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={filters.page >= totalPages}
              onClick={() => updateFilter("page", filters.page + 1)}
            >
              Next <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Product detail sheet */}
      <ProductDetail
        productId={selectedProductId}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent text-xs text-foreground">
      {label}
      <button onClick={onRemove} className="ml-0.5 hover:text-destructive" title="Remove">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
