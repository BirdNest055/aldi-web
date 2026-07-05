"use client";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianAxis } from "recharts";
import { Trophy, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STORE_COLORS: Record<string, string> = { "aldi-sued": "#1a7a3a", "rewe": "#e30613" };
function brand(id: string) { return id.startsWith("aldi") ? "aldi-sued" : id.startsWith("rewe") ? "rewe" : "other"; }
function storeName(id: string) {
  if (id === "aldi-sued-national") return "ALDI SÜD";
  const p = id.split("-"); return p[0] === "rewe" ? `REWE ${p.slice(2).join(" ")||p[1]||""}`.trim() : p[0] === "aldi" ? `ALDI` : id;
}

export function LeaderboardTab() {
  const { data: stores, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => fetch("/api/leaderboard").then(r => r.json()),
  });

  const chartData = (stores || []).slice(0, 15).map((s: any) => ({
    name: storeName(s.store_id).substring(0, 20),
    avgPrice: s.avg_price ? Number(s.avg_price.toFixed(2)) : 0,
    brand: brand(s.store_id),
    onSalePct: Number(s.on_sale_pct.toFixed(1)),
    avgDiscount: Number(s.avg_discount_pct.toFixed(1)),
    productCount: s.product_count,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Trophy className="w-5 h-5 text-amber-500" />
        <h2 className="text-xl font-semibold">Store Leaderboard</h2>
      </div>

      {/* Avg Price Chart */}
      <div className="bg-card border rounded-lg p-5">
        <h3 className="text-sm font-medium text-muted-foreground mb-4">Average Price per Product (lower = cheaper)</h3>
        {isLoading ? <Skeleton className="h-64 w-full" /> : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 20, top: 0, bottom: 0 }}>
              <CartesianAxis stroke="#27272a" />
              <XAxis type="number" stroke="#71717a" fontSize={11} unit=" €" />
              <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={10} width={100} />
              <Tooltip
                contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }}
                formatter={(v: any) => [`${v} €`, "Avg Price"]}
              />
              <Bar dataKey="avgPrice" radius={[0, 4, 4, 0]}>
                {chartData.map((entry: any, i: number) => (
                  <Cell key={i} fill={STORE_COLORS[entry.brand] || "#888"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Discount % Chart */}
        <div className="bg-card border rounded-lg p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">Average Discount % (higher = better deals)</h3>
          {isLoading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 10, top: 0, bottom: 0 }}>
                <XAxis type="number" stroke="#71717a" fontSize={11} unit="%" />
                <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={9} width={80} />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: any) => [`${v}%`, "Avg Discount"]}
                />
                <Bar dataKey="avgDiscount" radius={[0, 4, 4, 0]} fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* On Sale % Chart */}
        <div className="bg-card border rounded-lg p-5">
          <h3 className="text-sm font-medium text-muted-foreground mb-4">% of Products on Sale</h3>
          {isLoading ? <Skeleton className="h-48 w-full" /> : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 10, top: 0, bottom: 0 }}>
                <XAxis type="number" stroke="#71717a" fontSize={11} unit="%" />
                <YAxis type="category" dataKey="name" stroke="#71717a" fontSize={9} width={80} />
                <Tooltip
                  contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: any) => [`${v}%`, "On Sale"]}
                />
                <Bar dataKey="onSalePct" radius={[0, 4, 4, 0]} fill="#6366f1" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
            <tr>
              <th className="px-4 py-2 text-left">#</th>
              <th className="px-4 py-2 text-left">Store</th>
              <th className="px-4 py-2 text-right">Products</th>
              <th className="px-4 py-2 text-right">Avg Price</th>
              <th className="px-4 py-2 text-right">On Sale %</th>
              <th className="px-4 py-2 text-right">Avg Discount</th>
            </tr>
          </thead>
          <tbody>
            {(stores || []).slice(0, 20).map((s: any, i: number) => (
              <tr key={s.store_id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-2">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: STORE_COLORS[brand(s.store_id)] || "#888" }} />
                    {storeName(s.store_id)}
                  </span>
                </td>
                <td className="px-4 py-2 text-right font-mono">{s.product_count}</td>
                <td className="px-4 py-2 text-right font-mono">{s.avg_price ? `${s.avg_price.toFixed(2)} €` : "—"}</td>
                <td className="px-4 py-2 text-right font-mono">{s.on_sale_pct.toFixed(1)}%</td>
                <td className="px-4 py-2 text-right font-mono text-amber-500">{s.avg_discount_pct.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
