"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  TrendingUp,
  Package,
  Newspaper,
  Tag,
  Search,
  Filter,
  ArrowRight,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  X,
  LineChart as LineChartIcon,
  GitCompare,
  LayoutDashboard,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// =========================================================================
// Types (mirror the API responses)
// =========================================================================
interface Stats {
  publications: number;
  products: number;
  offerings: number;
  categories: number;
  priceMin: number | null;
  priceMax: number | null;
  priceAvg: number | null;
  publicationList: Array<{
    id: number;
    slug: string;
    originalTitle: string | null;
    validDates: string | null;
    validDateStart: string | null;
    validDateEnd: string | null;
    fetchedAt: string;
    offeringCount: number;
  }>;
}

interface ProductListItem {
  id: number;
  productKey: string;
  productIdRemote: number;
  title: string | null;
  brand: string | null;
  price: string | null;
  priceNumeric: number | null;
  discountedPriceNumeric: number | null;
  currency: string;
  productType: string | null;
  description: string | null;
  pageRange: string | null;
  publicationId: number;
  publicationSlug: string;
  publicationOriginalTitle: string | null;
  webshopIdentifier: string | null;
}

interface ProductListResult {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
}

interface CategoryEntry {
  name: string;
  count: number;
}

interface BrandEntry {
  name: string;
  count: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
}

interface PriceHistoryEntry {
  publicationId: number;
  publicationSlug: string;
  publicationOriginalTitle: string | null;
  fetchedAt: string;
  validFor: string | null;
  titleThisWeek: string | null;
  priceMin: number | null;
  priceMax: number | null;
  priceAvg: number | null;
  currency: string;
  productType: string | null;
  pageRange: string | null;
  nOfferings: number;
}

interface PriceHistory {
  productKey: string;
  canonicalTitle: string | null;
  canonicalType: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  history: PriceHistoryEntry[];
}

interface ProductDetail {
  product: {
    id: number;
    productKey: string;
    canonicalTitle: string | null;
    canonicalType: string | null;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
  };
  offerings: Array<{
    id: number;
    publicationId: number;
    publicationSlug: string;
    publicationOriginalTitle: string | null;
    fetchedAt: string;
    title: string | null;
    description: string | null;
    brand: string | null;
    price: string | null;
    priceNumeric: number | null;
    discountedPrice: string | null;
    discountedPriceNumeric: number | null;
    currency: string;
    productType: string | null;
    pageRange: string | null;
    webshopIdentifier: string | null;
    photos: Array<{ url: string; kind: string | null }>;
    labels: Array<{ key: string; value: string | null }>;
  }>;
  titleHistory: Array<{
    title: string;
    firstSeenAt: string;
    lastSeenAt: string;
  }>;
  descriptionHistory: Array<{
    description: string;
    firstSeenAt: string;
    lastSeenAt: string;
  }>;
  brandHistory: Array<{
    brand: string;
    firstSeenAt: string;
    lastSeenAt: string;
  }>;
}

interface DiffResult {
  pubA: { id: number; slug: string; originalTitle: string | null };
  pubB: { id: number; slug: string; originalTitle: string | null };
  added: Array<{ productKey: string; canonicalTitle: string | null }>;
  removed: Array<{ productKey: string; canonicalTitle: string | null }>;
  priceChanges: Array<{
    productKey: string;
    canonicalTitle: string | null;
    oldPrice: number | null;
    newPrice: number | null;
    oldPubId: number;
    newPubId: number;
  }>;
}

// =========================================================================
// Helpers
// =========================================================================
const fmtPrice = (n: number | null, currency = "EUR") => {
  if (n === null || n === undefined) return "—";
  const sym = currency === "EUR" ? "€" : currency;
  return `${n.toFixed(2)} ${sym}`;
};

const fmtDate = (iso: string | null) => {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  } catch {
    return iso.slice(0, 10);
  }
};

const fmtNum = (n: number | null) => {
  if (n === null || n === undefined) return "—";
  return n.toLocaleString("de-DE");
};

// =========================================================================
// Main page
// =========================================================================
export default function Home() {
  const [tab, setTab] = useState<"dashboard" | "products" | "diff">("dashboard");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
              <span className="font-mono font-bold text-primary-foreground text-sm">A</span>
            </div>
            <div>
              <h1 className="text-base font-semibold leading-none">ALDI Prospekt Explorer</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Timeline analysis of weekly catalogues</p>
            </div>
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="ml-auto">
            <TabsList>
              <TabsTrigger value="dashboard" className="gap-1.5">
                <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="products" className="gap-1.5">
                <Package className="w-3.5 h-3.5" /> Products
              </TabsTrigger>
              <TabsTrigger value="diff" className="gap-1.5">
                <GitCompare className="w-3.5 h-3.5" /> Diff
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-4 py-6">
        {tab === "dashboard" && <Dashboard />}
        {tab === "products" && <ProductsView />}
        {tab === "diff" && <DiffView />}
      </main>

      <footer className="border-t border-border bg-card/30 mt-auto">
        <div className="container mx-auto px-4 py-3 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
          <span>Data fetched by <code className="font-mono">aldi-cli</code> · stored in SQLite</span>
          <span className="font-mono">SCD Type 2 timeline schema</span>
        </div>
      </footer>
    </div>
  );
}

// =========================================================================
// Dashboard tab
// =========================================================================
function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json() as Promise<Stats>),
  });

  if (isLoading || !stats) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={Newspaper}
          label="Publications"
          value={fmtNum(stats.publications)}
          sub="weeks tracked"
        />
        <StatCard
          icon={Package}
          label="Products"
          value={fmtNum(stats.products)}
          sub="unique over time"
        />
        <StatCard
          icon={Tag}
          label="Offerings"
          value={fmtNum(stats.offerings)}
          sub="total observations"
        />
        <StatCard
          icon={TrendingUp}
          label="Price range"
          value={fmtPrice(stats.priceMin) + " – " + fmtPrice(stats.priceMax)}
          sub={`avg ${fmtPrice(stats.priceAvg)}`}
        />
      </div>

      {/* Publications list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-primary" />
            Publications
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {stats.publicationList.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-6 py-3 hover:bg-accent/40 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-xs">
                    {p.originalTitle ?? p.slug}
                  </Badge>
                  <span className="text-sm font-medium">
                    {p.validDates || fmtDate(p.fetchedAt)}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">
                    {fmtNum(p.offeringCount)} offerings
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    #{p.id}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wide">{label}</span>
          <Icon className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-semibold font-mono">{value}</div>
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
          <Card key={i}>
            <CardContent className="pt-5">
              <Skeleton className="h-3 w-20 mb-3" />
              <Skeleton className="h-7 w-24" />
              <Skeleton className="h-3 w-16 mt-2" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// =========================================================================
// Products tab
// =========================================================================
type SortOption = "title-asc" | "title-desc" | "price-asc" | "price-desc" | "newest";

function ProductsView() {
  const { data: statsData } = useQuery({
    queryKey: ["stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json() as Promise<Stats>),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => fetch("/api/categories").then((r) => r.json() as Promise<CategoryEntry[]>),
  });
  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: () => fetch("/api/brands").then((r) => r.json() as Promise<BrandEntry[]>),
  });
  const publications = statsData?.publicationList ?? [];
  const categoryList = categories ?? [];
  const brandList = brands ?? [];

  const [publicationId, setPublicationId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [brand, setBrand] = useState<string>("all");
  const [onSaleOnly, setOnSaleOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [sort, setSort] = useState<SortOption>("title-asc");
  const [page, setPage] = useState(1);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const pageSize = 50;

  // Debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // Build query string
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    if (publicationId !== "all") p.set("publicationId", publicationId);
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
  }, [publicationId, debouncedSearch, category, brand, onSaleOnly, minPrice, maxPrice, sort, page]);

  const { data, isLoading } = useQuery({
    queryKey: ["products", qs],
    queryFn: () => fetch(`/api/products?${qs}`).then((r) => r.json() as Promise<ProductListResult>),
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 1;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="pt-5">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            <div className="md:col-span-4 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search products, brands..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="md:col-span-2">
              <Select value={publicationId} onValueChange={(v) => { setPublicationId(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Publication" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All pubs</SelectItem>
                  {publications.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.validDates || p.originalTitle || p.slug}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={category} onValueChange={(v) => { setCategory(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categoryList.slice(0, 50).map((c) => (
                    <SelectItem key={c.name} value={c.name}>
                      {c.name} ({c.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={brand} onValueChange={(v) => { setBrand(v); setPage(1); }}>
                <SelectTrigger><SelectValue placeholder="Brand" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All brands</SelectItem>
                  {brandList.slice(0, 60).map((b) => (
                    <SelectItem key={b.name} value={b.name}>
                      {b.name} ({b.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
                <SelectTrigger>
                  <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 inline" />
                  <SelectValue />
                </SelectTrigger>
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
              <input
                type="checkbox"
                checked={onSaleOnly}
                onChange={(e) => { setOnSaleOnly(e.target.checked); setPage(1); }}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-muted-foreground">On sale only</span>
            </label>
            <span className="text-muted-foreground">·</span>
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Price:</span>
            <Input
              type="number"
              step="0.01"
              placeholder="min"
              value={minPrice}
              onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
              className="w-24 h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">—</span>
            <Input
              type="number"
              step="0.01"
              placeholder="max"
              value={maxPrice}
              onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
              className="w-24 h-8 text-xs"
            />
            {(minPrice || maxPrice || search || publicationId !== "all" || category !== "all" || brand !== "all" || onSaleOnly) && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto text-xs h-8"
                onClick={() => {
                  setMinPrice(""); setMaxPrice(""); setSearch("");
                  setPublicationId("all"); setCategory("all");
                  setBrand("all"); setOnSaleOnly(false); setPage(1);
                }}
              >
                <X className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {isLoading ? "Loading..." : `${fmtNum(data?.total ?? 0)} products`}
        </span>
        {data && (
          <span className="text-muted-foreground text-xs font-mono">
            page {page} of {totalPages}
          </span>
        )}
      </div>

      {/* Product list */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : data && data.items.length > 0 ? (
            <div className="divide-y divide-border">
              {data.items.map((p) => {
                const onSale = p.discountedPriceNumeric !== null && p.discountedPriceNumeric !== undefined;
                return (
                <button
                  key={p.id}
                  onClick={() => setSelectedKey(p.productKey)}
                  className="w-full flex items-center gap-4 px-4 py-3 hover:bg-accent/40 transition-colors text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{p.title || "(no title)"}</span>
                      {p.brand && (
                        <Badge className="text-xs shrink-0 bg-primary/15 text-primary border-primary/30">
                          {p.brand}
                        </Badge>
                      )}
                      {p.productType && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          {p.productType.split(" - ")[0]}
                        </Badge>
                      )}
                      {onSale && (
                        <Badge variant="destructive" className="text-xs shrink-0">
                          SALE
                        </Badge>
                      )}
                    </div>
                    {p.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {p.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      {onSale ? (
                        <>
                          <div className="font-mono font-semibold text-sm text-primary">
                            {fmtPrice(p.discountedPriceNumeric, p.currency)}
                          </div>
                          <div className="text-xs text-muted-foreground line-through">
                            {fmtPrice(p.priceNumeric, p.currency)}
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="font-mono font-semibold text-sm">
                            {fmtPrice(p.priceNumeric, p.currency)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            p.{p.pageRange}
                          </div>
                        </>
                      )}
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                      {p.publicationOriginalTitle ?? p.publicationSlug}
                    </Badge>
                  </div>
                </button>
                );
              })}
            </div>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No products match your filters.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-mono px-2">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      {/* Detail drawer */}
      <ProductDetailSheet
        productKey={selectedKey}
        onClose={() => setSelectedKey(null)}
      />
    </div>
  );
}

// =========================================================================
// Product detail sheet (drawer)
// =========================================================================
function ProductDetailSheet({
  productKey,
  onClose,
}: {
  productKey: string | null;
  onClose: () => void;
}) {
  const { data: detail, isLoading: loadingDetail } = useQuery({
    queryKey: ["product", productKey],
    queryFn: () => fetch(`/api/products/${productKey}`).then((r) => r.json() as Promise<ProductDetail>),
    enabled: !!productKey,
  });
  const { data: history } = useQuery({
    queryKey: ["product-history", productKey],
    queryFn: () => fetch(`/api/products/${productKey}?view=history`).then((r) => r.json() as Promise<PriceHistory>),
    enabled: !!productKey,
  });
  const loading = loadingDetail;

  const chartData = useMemo(() => {
    if (!history) return [];
    return history.history.map((h) => ({
      label: h.publicationOriginalTitle ?? h.publicationSlug,
      date: fmtDate(h.fetchedAt),
      price: h.priceAvg,
      priceMin: h.priceMin,
      priceMax: h.priceMax,
      n: h.nOfferings,
    }));
  }, [history]);

  return (
    <Sheet open={!!productKey} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-mono text-base">
            {detail?.product.canonicalTitle ?? (loading ? "Loading…" : "Product")}
          </SheetTitle>
          <SheetDescription>
            key: {productKey}
            {detail?.product.canonicalType && (
              <> · {detail.product.canonicalType}</>
            )}
          </SheetDescription>
        </SheetHeader>

        {loading ? (
          <div className="space-y-3 mt-6">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : detail ? (
          <div className="space-y-6 mt-6">
            {/* Price history chart */}
            {chartData.length > 0 && (
              <div>
                <h3 className="text-sm font-medium flex items-center gap-1.5 mb-3">
                  <LineChartIcon className="w-4 h-4 text-primary" />
                  Price history
                </h3>
                <div className="h-48 -ml-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 0.1)" />
                      <XAxis
                        dataKey="label"
                        stroke="oklch(0.7 0 0)"
                        fontSize={11}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="oklch(0.7 0 0)"
                        fontSize={11}
                        tickLine={false}
                        tickFormatter={(v) => `${v}€`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "oklch(0.2 0 0)",
                          border: "1px solid oklch(1 0 0 / 0.1)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                        labelStyle={{ color: "oklch(0.7 0 0)" }}
                        formatter={(v: number) => [fmtPrice(v), "avg price"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="price"
                        stroke="oklch(0.84 0.18 95)"
                        strokeWidth={2}
                        dot={{ fill: "oklch(0.84 0.18 95)", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-card border border-border rounded-md p-3">
                <div className="text-xs text-muted-foreground">First seen</div>
                <div className="text-sm font-mono mt-1">{fmtDate(detail.product.firstSeenAt)}</div>
              </div>
              <div className="bg-card border border-border rounded-md p-3">
                <div className="text-xs text-muted-foreground">Last seen</div>
                <div className="text-sm font-mono mt-1">{fmtDate(detail.product.lastSeenAt)}</div>
              </div>
              <div className="bg-card border border-border rounded-md p-3">
                <div className="text-xs text-muted-foreground">Observations</div>
                <div className="text-sm font-mono mt-1">{detail.offerings.length}</div>
              </div>
            </div>

            {/* Offerings */}
            <div>
              <h3 className="text-sm font-medium mb-2">
                Offerings ({detail.offerings.length})
              </h3>
              <div className="space-y-2">
                {detail.offerings.map((o) => {
                  const onSale = o.discountedPriceNumeric !== null && o.discountedPriceNumeric !== undefined;
                  return (
                  <div key={o.id} className="bg-card border border-border rounded-md p-3 text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {o.publicationOriginalTitle ?? o.publicationSlug}
                        </Badge>
                        {o.brand && (
                          <Badge className="text-xs bg-primary/15 text-primary border-primary/30">
                            {o.brand}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        {onSale ? (
                          <div className="flex items-baseline gap-2 justify-end">
                            <span className="font-mono font-semibold text-primary">
                              {fmtPrice(o.discountedPriceNumeric, o.currency)}
                            </span>
                            <span className="font-mono text-xs text-muted-foreground line-through">
                              {fmtPrice(o.priceNumeric, o.currency)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono font-semibold">{fmtPrice(o.priceNumeric, o.currency)}</span>
                        )}
                      </div>
                    </div>
                    {o.description && (
                      <p className="text-xs text-muted-foreground mt-1">{o.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                      <span>{fmtDate(o.fetchedAt)}</span>
                      {o.pageRange && <span>p.{o.pageRange}</span>}
                      {o.productType && <span className="truncate">{o.productType}</span>}
                    </div>
                    {o.labels.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {o.labels.map((l) => (
                          <Badge key={l.key} variant="secondary" className="text-xs font-mono">
                            {l.key.replace("customLabel", "L")}={l.value}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>

            {/* SCD2 brand history */}
            {detail.brandHistory && detail.brandHistory.length > 1 && (
              <div>
                <h3 className="text-sm font-medium mb-2">
                  Brand history (SCD2)
                </h3>
                <div className="space-y-1">
                  {detail.brandHistory.map((b, i) => (
                    <div key={i} className="text-xs flex items-center gap-2 font-mono">
                      <span className="text-muted-foreground">
                        {fmtDate(b.firstSeenAt)} → {fmtDate(b.lastSeenAt)}
                      </span>
                      <Badge className="bg-primary/15 text-primary border-primary/30">{b.brand}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SCD2 title history */}
            {detail.titleHistory.length > 1 && (
              <div>
                <h3 className="text-sm font-medium mb-2">
                  Title history (SCD2)
                </h3>
                <div className="space-y-1">
                  {detail.titleHistory.map((t, i) => (
                    <div key={i} className="text-xs flex items-center gap-2 font-mono">
                      <span className="text-muted-foreground">
                        {fmtDate(t.firstSeenAt)} → {fmtDate(t.lastSeenAt)}
                      </span>
                      <span>{t.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SCD2 description history */}
            {detail.descriptionHistory.length > 1 && (
              <div>
                <h3 className="text-sm font-medium mb-2">
                  Description history (SCD2)
                </h3>
                <div className="space-y-2">
                  {detail.descriptionHistory.map((d, i) => (
                    <div key={i} className="text-xs bg-card border border-border rounded p-2">
                      <div className="text-muted-foreground font-mono mb-1">
                        {fmtDate(d.firstSeenAt)} → {fmtDate(d.lastSeenAt)}
                      </div>
                      <div>{d.description}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

// =========================================================================
// Diff tab
// =========================================================================
function DiffView() {
  const { data: statsData } = useQuery({
    queryKey: ["stats"],
    queryFn: () => fetch("/api/stats").then((r) => r.json() as Promise<Stats>),
  });
  const publications = statsData?.publicationList ?? [];

  // Derive default pubA/pubB from stats — prefer user override once set
  const defaultA = publications.length >= 2
    ? String(publications[publications.length - 1].id)
    : "";
  const defaultB = publications.length >= 2
    ? String(publications[0].id)
    : "";
  const [pubA, setPubA] = useState<string>("");
  const [pubB, setPubB] = useState<string>("");
  const [userPicked, setUserPicked] = useState(false);

  // If user hasn't picked yet, follow the defaults
  const effectiveA = userPicked ? pubA : defaultA;
  const effectiveB = userPicked ? pubB : defaultB;

  const enabled = !!effectiveA && !!effectiveB && effectiveA !== effectiveB;
  const { data: diff, isLoading: loading } = useQuery({
    queryKey: ["diff", effectiveA, effectiveB],
    queryFn: () => fetch(`/api/diff?a=${effectiveA}&b=${effectiveB}`).then((r) => r.json() as Promise<DiffResult>),
    enabled,
  });

  const pickA = (v: string) => { setUserPicked(true); setPubA(v); };
  const pickB = (v: string) => { setUserPicked(true); setPubB(v); };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium">Compare:</span>
            <Select value={effectiveA} onValueChange={pickA}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {publications.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.originalTitle ?? p.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <Select value={effectiveB} onValueChange={pickB}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {publications.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.originalTitle ?? p.slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {effectiveA && effectiveB && effectiveA !== effectiveB && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setPubA(effectiveB); setPubB(effectiveA); setUserPicked(true); }}
                className="ml-auto text-xs"
              >
                Swap
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : diff ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Added */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500" />
                  Added
                </span>
                <Badge variant="secondary">{diff.added.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto divide-y divide-border">
                {diff.added.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground text-center">None</div>
                ) : (
                  diff.added.map((p) => (
                    <div key={p.productKey} className="px-4 py-2 text-sm">
                      {p.canonicalTitle ?? "(no title)"}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Removed */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  Removed
                </span>
                <Badge variant="secondary">{diff.removed.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto divide-y divide-border">
                {diff.removed.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground text-center">None</div>
                ) : (
                  diff.removed.map((p) => (
                    <div key={p.productKey} className="px-4 py-2 text-sm">
                      {p.canonicalTitle ?? "(no title)"}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Price changes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-500" />
                  Price changes
                </span>
                <Badge variant="secondary">{diff.priceChanges.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-96 overflow-y-auto divide-y divide-border">
                {diff.priceChanges.length === 0 ? (
                  <div className="p-4 text-xs text-muted-foreground text-center">None</div>
                ) : (
                  diff.priceChanges.map((c) => {
                    const delta = (c.newPrice ?? 0) - (c.oldPrice ?? 0);
                    const pct = c.oldPrice ? (delta / c.oldPrice) * 100 : 0;
                    const isUp = delta > 0;
                    return (
                      <div key={c.productKey} className="px-4 py-2 text-sm">
                        <div className="truncate">{c.canonicalTitle ?? "(no title)"}</div>
                        <div className="flex items-center gap-2 mt-1 font-mono text-xs">
                          <span className="text-muted-foreground">{fmtPrice(c.oldPrice)}</span>
                          <ArrowRight className="w-3 h-3" />
                          <span className="font-semibold">{fmtPrice(c.newPrice)}</span>
                          <span className={cn(
                            "ml-auto",
                            isUp ? "text-red-400" : "text-green-400"
                          )}>
                            {isUp ? "+" : ""}{delta.toFixed(2)}€ ({pct > 0 ? "+" : ""}{pct.toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <GitCompare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Select two different publications to compare.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
