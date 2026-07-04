"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp, Package, Store, Tag, Search, Filter, ArrowUpDown,
  ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SortOption = "title-asc" | "title-desc" | "price-asc" | "price-desc" | "newest";

interface Stats {
  totalDiscounts: number;
  uniqueProducts: number;
  uniqueBrands: number;
  uniqueCategories: number;
  storesWithDiscounts: number;
  priceMin: number | null;
  priceMax: number | null;
  priceAvg: number | null;
  storeList: Array<{ store_id: string; count: number; min_price: number; max_price: number; }>;
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

const fmtPrice = (n: number | null, cur = "EUR") => {
  if (n === null) return "—";
  return `${n.toFixed(2)} ${cur === "EUR" ? "€" : cur}`;
};
const fmtNum = (n: number) => n.toLocaleString("de-DE");
const fmtDate = (iso: string) => iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short" }) : "—";

const STORE_BRAND_COLORS: Record<string, string> = {
  "aldi-sued": "#1a7a3a",
  "rewe": "#e30613",
};

export default function Home() {
  const [tab, setTab] = useState<"dashboard" | "products">("dashboard");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <span className="font-mono font-bold text-primary-foreground text-sm">D</span>
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">Discount Database <span className="text-xs text-muted-foreground font-normal">v2.0.0</span></h1>
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
        <div className="container mx-auto px-4 py-3 text-xs text-muted-foreground flex items-center justify-between">
          <span>Data from <code className="font-mono">Supabase</code> · ALDI SÜD + REWE</span>
          <span className="font-mono">v2.0.0</span>
        </div>
      </footer>
    </div>
  );
}

function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json() as Promise<Stats>),
  });
  if (isLoading || !stats) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Store} label="Stores" value={fmtNum(stats.storesWithDiscounts)} sub="with discounts" />
        <StatCard icon={Package} label="Products" value={fmtNum(stats.uniqueProducts)} sub="unique" />
        <StatCard icon={Tag} label="Discounts" value={fmtNum(stats.totalDiscounts)} sub="total entries" />
        <StatCard icon={TrendingUp} label="Price range" value={fmtPrice(stats.priceMin) + " – " + fmtPrice(stats.priceMax)} sub={`avg ${fmtPrice(stats.priceAvg)}`} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Stores with Discounts</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {stats.storeList.map((s) => (
              <div key={s.store_id} className="flex items-center justify-between px-6 py-3 hover:bg-accent/40">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-xs" style={{ borderColor: STORE_BRAND_COLORS[s.store_id.split("-")[0]] || "#888", color: STORE_BRAND_COLORS[s.store_id.split("-")[0]] || "#888" }}>
                    {s.store_id.includes("aldi") ? "ALDI SÜD" : s.store_id.includes("rewe") ? "REWE" : s.store_id.split("-")[0]}
                  </Badge>
                  <span className="text-sm font-medium">{s.store_id}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">{fmtNum(s.count)} discounts</span>
                  <span className="font-mono text-xs text-muted-foreground">{fmtPrice(s.min_price)} – {fmtPrice(s.max_price)}</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; sub: string; }) {
  return (
    <Card><CardContent className="pt-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="text-2xl font-semibold font-mono">{value}</div>
      <div className="text-xs text-muted-foreground mt-1">{sub}</div>
    </CardContent></Card>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (<Card key={i}><CardContent className="pt-5"><Skeleton className="h-3 w-20 mb-3" /><Skeleton className="h-7 w-24" /><Skeleton className="h-3 w-16 mt-2" /></CardContent></Card>))}
      </div>
      <Card><CardContent className="pt-6"><Skeleton className="h-4 w-32 mb-4" /><div className="space-y-3">{[...Array(5)].map((_, i) => (<Skeleton key={i} className="h-10 w-full" />))}</div></CardContent></Card>
    </div>
  );
}

function ProductsView() {
  const [storeId, setStoreId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<SortOption>("title-asc");
  const [page, setPage] = useState(1);
  const pageSize = 50;

  const { data: storesData } = useQuery({ queryKey: ["stores-list"], queryFn: () => fetch("/api/stores").then((r) => r.json() as Promise<StoreEntry[]>) });
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => fetch("/api/categories").then((r) => r.json() as Promise<CategoryEntry[]>) });
  const { data: brands } = useQuery({ queryKey: ["brands"], queryFn: () => fetch("/api/brands").then((r) => r.json() as Promise<BrandEntry[]>) });

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useMemo(() => { const t = setTimeout(() => { setDebouncedSearch(search); setPage(1); }, 300); return () => clearTimeout(t); }, [search]);

  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (storeId !== "all") p.set("storeId", storeId);
    if (debouncedSearch) p.set("search", debouncedSearch);
    if (category !== "all") p.set("category", category);
    if (brand !== "all") p.set("brand", brand);
    if (onSaleOnly) p.set("onSale", "1");
    if (minPrice) p.set("minPrice", minPrice);
    if (maxPrice) p.set("maxPrice", maxPrice);
    p.set("sort", sort);
    p.set("page", String(page));
    p.set("pageSize", String(pageSize));
    return p.toString();
  }, [storeId, debouncedSearch, category, brand, onSaleOnly, minPrice, maxPrice, sort, page]);

  const { data, isLoading } = useQuery({ queryKey: ["products", qs], queryFn: () => fetch(`/api/products?${qs}`).then((r) => r.json() as Promise<ProductListResult>) });
  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;
  const storesWithDiscounts = storesData?.filter((s) => s.discountCount > 0) ?? [];

  return (
    <div className="space-y-4">
      <Card><CardContent className="pt-5">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-4 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search products, brands, categories..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="md:col-span-2">
            <Select value={storeId} onValueChange={(v) => { setStoreId(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Store" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All stores</SelectItem>
                {storesWithDiscounts.map((s) => (<SelectItem key={s.store_id} value={s.store_id}>{s.store_id} ({s.discountCount})</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {(categories ?? []).slice(0, 50).map((c) => (<SelectItem key={c.name} value={c.name}>{c.name} ({c.count})</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select value={brand} onValueChange={(v) => { setBrand(v); setPage(1); }}>
              <SelectTrigger><SelectValue placeholder="Brand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All brands</SelectItem>
                {(brands ?? []).slice(0, 60).map((b) => (<SelectItem key={b.name} value={b.name}>{b.name} ({b.count})</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger><ArrowUpDown className="w-3.5 h-3.5 mr-1.5 inline" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="title-asc">Name A-Z</SelectItem>
                <SelectItem value="title-desc">Name Z-A</SelectItem>
                <SelectItem value="price-asc">Price ↑</SelectItem>
                <SelectItem value="price-desc">Price ↓</SelectItem>
                <SelectItem value="newest">Newest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 flex-wrap">
          <label className="flex items-center gap-2 cursor-pointer text-xs">
            <input type="checkbox" checked={onSaleOnly} onChange={(e) => { setOnSaleOnly(e.target.checked); setPage(1); }} className="w-4 h-4 rounded accent-primary" />
            <span className="text-muted-foreground">On sale only</span>
          </label>
          <span className="text-muted-foreground">·</span>
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Price:</span>
          <Input type="number" step="0.01" placeholder="min" value={minPrice} onChange={(e) => { setMinPrice(e.target.value); setPage(1); }} className="w-24 h-8 text-xs" />
          <span className="text-xs text-muted-foreground">—</span>
          <Input type="number" step="0.01" placeholder="max" value={maxPrice} onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }} className="w-24 h-8 text-xs" />
          {(minPrice || maxPrice || search || storeId !== "all" || category !== "all" || brand !== "all" || onSaleOnly) && (
            <Button variant="ghost" size="sm" className="ml-auto text-xs h-8" onClick={() => { setMinPrice(""); setMaxPrice(""); setSearch(""); setStoreId("all"); setCategory("all"); setBrand("all"); setOnSaleOnly(false); setPage(1); }}>
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </div>
      </CardContent></Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{isLoading ? "Loading..." : `${fmtNum(data?.total ?? 0)} products`}</span>
        {data && <span className="text-muted-foreground text-xs font-mono">page {page} of {totalPages}</span>}
      </div>

      <Card><CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">{[...Array(8)].map((_, i) => (<Skeleton key={i} className="h-12 w-full" />))}</div>
        ) : data && data.items.length > 0 ? (
          <div className="divide-y divide-border">
            {data.items.map((p) => {
              const onSale = p.regular_price !== null && p.price !== null && p.regular_price > p.price;
              const storeBrand = p.store_id.includes("aldi") ? "aldi-sued" : p.store_id.includes("rewe") ? "rewe" : "other";
              const brandColor = STORE_BRAND_COLORS[storeBrand] || "#888";
              return (
                <div key={p.id} className="flex items-center gap-4 px-4 py-3 hover:bg-accent/40 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{p.product_title}</span>
                      {p.brand && (<Badge className="text-xs shrink-0 bg-primary/15 text-primary border-primary/30">{p.brand}</Badge>)}
                      {p.category && (<Badge variant="secondary" className="text-xs shrink-0">{p.category.split(" - ")[0]}</Badge>)}
                      {onSale && (<Badge variant="destructive" className="text-xs shrink-0">SALE</Badge>)}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span style={{ color: brandColor }} className="font-medium">{p.store_id}</span>
                      <span>{fmtDate(p.fetched_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      {onSale ? (
                        <>
                          <div className="font-mono font-semibold text-sm text-primary">{fmtPrice(p.price, p.currency)}</div>
                          <div className="text-xs text-muted-foreground line-through">{fmtPrice(p.regular_price, p.currency)}</div>
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
          <div className="p-12 text-center text-muted-foreground"><Package className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No products match your filters.</p></div>
        )}
      </CardContent></Card>

      {data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="w-4 h-4" /></Button>
          <span className="text-sm font-mono px-2">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}><ChevronRight className="w-4 h-4" /></Button>
        </div>
      )}
    </div>
  );
}
