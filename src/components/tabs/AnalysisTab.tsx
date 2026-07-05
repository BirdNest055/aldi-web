"use client";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, PieChart as PieIcon, TrendingDown, Layers, DollarSign, Repeat, Boxes, Loader2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line, Area, AreaChart, CartesianGrid, Legend } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

const STORE_COLORS: Record<string, string> = { "aldi-sued": "#1a7a3a", "rewe": "#e30613" };
const fmt = (n: number | null | undefined) => n == null ? "—" : `${n.toFixed(2)} €`;
function brand(id: string) { return id.startsWith("aldi") ? "aldi-sued" : id.startsWith("rewe") ? "rewe" : "other"; }
function storeName(id: string) { if (id === "aldi-sued-national") return "ALDI SÜD"; const p = id.split("-"); return p[0] === "rewe" ? `REWE ${p.slice(2).join(" ")||p[1]||""}`.trim() : p[0] === "aldi" ? `ALDI` : id; }

export function AnalysisTab() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-5 h-5 text-indigo-400" />
        <h2 className="text-xl font-semibold">Cross-Data Analysis</h2>
        <span className="text-sm text-muted-foreground">— 20 analytics views across all dimensions</span>
      </div>

      {/* Row 1: Overview Stats */}
      <OverviewStats />

      {/* Row 2: Price Distribution + Discount Depth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PriceDistribution />
        <DiscountDepth />
      </div>

      {/* Row 3: Total Savings */}
      <SavingsAnalysis />

      {/* Row 4: Category Analysis */}
      <CategoryAnalysis />

      {/* Row 5: Brand Analysis */}
      <BrandAnalysis />

      {/* Row 6: Product Overlap */}
      <ProductOverlap />

      {/* Row 7: Store-Category Matrix */}
      <StoreCategoryMatrix />
    </div>
  );
}

// ─── 1. Overview Stats ─────────────────────────────────────────────────────
function OverviewStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["analysis-overview"],
    queryFn: () => fetch("/api/analysis?type=overview").then(r => r.json()),
  });
  if (isLoading) return <Skeleton className="h-24 w-full rounded-lg" />;
  if (!data) return null;
  const stats = [
    { label: "Total Discounts", value: data.total_discounts, color: "text-indigo-400", icon: Boxes },
    { label: "Stores", value: data.total_stores, color: "text-emerald-400", icon: Layers },
    { label: "Categories", value: data.total_categories, color: "text-amber-400", icon: BarChart3 },
    { label: "Brands", value: data.total_brands, color: "text-blue-400", icon: PieIcon },
    { label: "On Sale", value: `${data.on_sale_pct.toFixed(0)}%`, color: "text-red-400", icon: TrendingDown },
    { label: "Avg Price", value: fmt(data.price_avg), color: "text-purple-400", icon: DollarSign },
    { label: "Median Price", value: fmt(data.price_median), color: "text-cyan-400", icon: DollarSign },
    { label: "Price Range", value: `${fmt(data.price_min)}–${fmt(data.price_max)}`, color: "text-orange-400", icon: DollarSign },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map((s, i) => (
        <div key={i} className="bg-card border rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground uppercase">{s.label}</span>
            <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
          </div>
          <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── 2. Price Distribution ─────────────────────────────────────────────────
function PriceDistribution() {
  const { data, isLoading } = useQuery({
    queryKey: ["analysis-price-dist"],
    queryFn: () => fetch("/api/analysis?type=price-distribution").then(r => r.json()),
  });
  return (
    <div className="bg-card border rounded-lg p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Price Distribution (how many products in each price range)</h3>
      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="label" stroke="#71717a" fontSize={10} angle={-20} textAnchor="end" height={50} />
            <YAxis stroke="#71717a" fontSize={11} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#6366f1" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── 3. Discount Depth ─────────────────────────────────────────────────────
function DiscountDepth() {
  const { data, isLoading } = useQuery({
    queryKey: ["analysis-discount-depth"],
    queryFn: () => fetch("/api/analysis?type=discount-depth").then(r => r.json()),
  });
  return (
    <div className="bg-card border rounded-lg p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Discount Depth Distribution (how deep are the discounts?)</h3>
      {isLoading ? <Skeleton className="h-48 w-full" /> : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
            <XAxis dataKey="label" stroke="#71717a" fontSize={10} />
            <YAxis stroke="#71717a" fontSize={11} />
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} fill="#f59e0b" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

// ─── 4. Savings Analysis ──────────────────────────────────────────────────
function SavingsAnalysis() {
  const { data, isLoading } = useQuery({
    queryKey: ["analysis-savings"],
    queryFn: () => fetch("/api/analysis?type=savings-total").then(r => r.json()),
  });
  if (isLoading) return <Skeleton className="h-48 w-full rounded-lg" />;
  if (!data) return null;
  const chartData = (data.by_store || []).map((s: any) => ({
    name: storeName(s.store_id).substring(0, 15),
    savings: Number(s.savings.toFixed(2)),
    original: Number(s.original.toFixed(2)),
    current: Number(s.current.toFixed(2)),
    brand: brand(s.store_id),
  }));
  return (
    <div className="bg-card border rounded-lg p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-2">Total Savings Analysis — if you bought ALL on-sale products</h3>
      <div className="flex gap-4 mb-4 flex-wrap">
        <StatPill label="Total Savings" value={fmt(data.total_savings)} color="text-emerald-400" />
        <StatPill label="Original Total" value={fmt(data.total_original)} color="text-red-400" />
        <StatPill label="Current Total" value={fmt(data.total_current)} color="text-indigo-400" />
        <StatPill label="Avg Discount" value={`${data.avg_discount_pct.toFixed(1)}%`} color="text-amber-400" />
        <StatPill label="On-Sale Items" value={data.on_sale_count} color="text-purple-400" />
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 20, top: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis type="number" stroke="#71717a" fontSize={11} unit=" €" />
          <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={10} width={100} />
          <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }} formatter={(v:number) => `${v.toFixed(2)} €`} />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Bar dataKey="original" fill="#ef444480" name="Original Price" radius={[0, 4, 4, 0]} />
          <Bar dataKey="current" fill="#22c55e" name="Sale Price" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 5. Category Analysis ─────────────────────────────────────────────────
function CategoryAnalysis() {
  const { data, isLoading } = useQuery({
    queryKey: ["analysis-category-prices"],
    queryFn: () => fetch("/api/analysis?type=category-prices").then(r => r.json()),
  });
  if (isLoading) return <Skeleton className="h-96 w-full rounded-lg" />;
  if (!data) return null;
  // Get top 10 categories by product count
  const catMap = new Map<string, number>();
  data.forEach((d: any) => catMap.set(d.category, (catMap.get(d.category) || 0) + d.count));
  const topCats = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(e => e[0]);
  const chartData = topCats.map(cat => {
    const entries = data.filter((d: any) => d.category === cat);
    const avgPrices = entries.map((e: any) => ({ name: e.store_id, avg: e.avg_price }));
    return { category: cat.split(" - ")[0].substring(0, 20), avgPrice: entries.reduce((s:number,e:any)=>s+e.avg_price,0)/entries.length, count: entries.reduce((s:number,e:any)=>s+e.count,0) };
  });
  return (
    <div className="bg-card border rounded-lg p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Top Categories — Average Price & Product Count</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ left: 0, right: 20, top: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="category" stroke="#71717a" fontSize={9} angle={-30} textAnchor="end" height={60} />
          <YAxis yAxisId="left" stroke="#71717a" fontSize={11} unit=" €" />
          <YAxis yAxisId="right" orientation="right" stroke="#71717a" fontSize={11} />
          <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }} />
          <Legend wrapperStyle={{ fontSize: "11px" }} />
          <Bar yAxisId="left" dataKey="avgPrice" name="Avg Price" radius={[4, 4, 0, 0]} fill="#6366f1" />
          <Bar yAxisId="right" dataKey="count" name="Products" radius={[4, 4, 0, 0]} fill="#f59e0b" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 6. Brand Analysis ────────────────────────────────────────────────────
function BrandAnalysis() {
  const { data, isLoading } = useQuery({
    queryKey: ["analysis-brand-prices"],
    queryFn: () => fetch("/api/analysis?type=brand-prices").then(r => r.json()),
  });
  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (!data) return null;
  const top10 = data.slice(0, 10);
  const pieData = top10.map((b: any) => ({ name: b.brand, value: b.count, avg: b.avg_price }));
  const COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#ec4899", "#14b8a6", "#f97316", "#3b82f6"];
  return (
    <div className="bg-card border rounded-lg p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Brand Analysis — Product Share & Average Price (top 10 brands)</h3>
      <div className="flex flex-col lg:flex-row gap-4">
        <ResponsiveContainer width="100%" height={220} className="flex-1">
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={(e:any)=>e.name.substring(0,10)} fontSize={9}>
              {pieData.map((_:any, i:number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }} />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-1">
          {top10.map((b: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-sm py-1 border-b border-border last:border-0">
              <span className="w-3 h-3 rounded" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="font-medium flex-1 truncate">{b.brand}</span>
              <span className="text-muted-foreground text-xs">{b.count} items</span>
              <span className="font-mono text-xs">{fmt(b.avg_price)}</span>
              <span className="text-muted-foreground text-xs">{b.store_count} stores</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── 7. Product Overlap ───────────────────────────────────────────────────
function ProductOverlap() {
  const { data, isLoading } = useQuery({
    queryKey: ["analysis-overlap"],
    queryFn: () => fetch("/api/analysis?type=overlap").then(r => r.json()),
  });
  if (isLoading) return <Skeleton className="h-48 w-full rounded-lg" />;
  if (!data) return null;
  return (
    <div className="bg-card border rounded-lg p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2"><Repeat className="w-4 h-4" /> Product Overlap — products available at multiple stores</h3>
      <div className="flex gap-4 mb-4 flex-wrap">
        <StatPill label="Total Products" value={data.total_products} color="text-indigo-400" />
        <StatPill label="Multi-Store" value={data.multi_store_products} color="text-emerald-400" />
        <StatPill label="Single-Store" value={data.single_store_products} color="text-muted-foreground" />
      </div>
      {(data.top_overlaps || []).length > 0 && (
        <div className="space-y-1">
          <h4 className="text-xs text-muted-foreground uppercase mb-2">Top Products at Multiple Stores (by price gap)</h4>
          {data.top_overlaps.slice(0, 8).map((p: any, i: number) => (
            <div key={i} className="flex items-center gap-3 text-sm py-1.5 border-b border-border last:border-0">
              <span className="font-medium truncate flex-1">{p.product_title}</span>
              <span className="text-xs text-muted-foreground">{p.store_count} stores</span>
              <span className="text-xs text-emerald-400 font-mono">min {fmt(p.min_price)}</span>
              <span className="text-xs text-red-400 font-mono">max {fmt(p.max_price)}</span>
              <span className="text-xs text-amber-400 font-mono">gap {fmt(p.price_spread)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── 8. Store-Category Matrix ─────────────────────────────────────────────
function StoreCategoryMatrix() {
  const { data, isLoading } = useQuery({
    queryKey: ["analysis-store-cats"],
    queryFn: () => fetch("/api/analysis?type=store-categories").then(r => r.json()),
  });
  if (isLoading) return <Skeleton className="h-64 w-full rounded-lg" />;
  if (!data || data.length === 0) return null;
  // Build matrix: rows=stores, cols=top categories
  const allCats = new Map<string, number>();
  data.forEach((s: any) => s.categories.forEach((c: any) => allCats.set(c.category, (allCats.get(c.category) || 0) + c.count)));
  const topCats = Array.from(allCats.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(e => e[0]);
  function getColor(count: number, max: number) {
    if (max === 0 || count === 0) return "transparent";
    const pct = count / max;
    return `hsl(120, 50%, ${50 - pct * 25}%)`;
  }
  return (
    <div className="bg-card border rounded-lg p-5">
      <h3 className="text-sm font-medium text-muted-foreground mb-4">Store × Category Matrix — product count per store per category</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left text-xs text-muted-foreground">Store</th>
              {topCats.map(c => <th key={c} className="px-2 py-1 text-center text-xs text-muted-foreground truncate max-w-[80px]" title={c}>{c.split(" - ")[0].substring(0, 12)}</th>)}
              <th className="px-2 py-1 text-right text-xs text-muted-foreground">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s: any) => {
              const catCounts = new Map(s.categories.map((c: any) => [c.category, c.count]));
              const max = Math.max(...topCats.map(c => catCounts.get(c) || 0));
              return (
                <tr key={s.store_id} className="border-t border-border">
                  <td className="px-2 py-1.5 text-xs font-medium">{storeName(s.store_id).substring(0, 20)}</td>
                  {topCats.map(c => {
                    const count = catCounts.get(c) || 0;
                    return <td key={c} className="px-2 py-1.5 text-center"><span className="inline-block px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: getColor(count, max), color: count > 0 ? "#fff" : "#71717a" }}>{count > 0 ? count : "—"}</span></td>;
                  })}
                  <td className="px-2 py-1.5 text-right font-mono text-xs">{s.categories.reduce((a:number,c:any)=>a+c.count,0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatPill({ label, value, color }: { label: string; value: any; color: string }) {
  return (
    <div className="bg-muted/30 rounded px-3 py-1.5">
      <span className="text-xs text-muted-foreground">{label}: </span>
      <span className={`font-mono font-bold ${color}`}>{value}</span>
    </div>
  );
}
