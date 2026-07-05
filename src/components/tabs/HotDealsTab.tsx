"use client";
import { useQuery } from "@tanstack/react-query";
import { Flame, Loader2, TrendingDown, Percent } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STORE_COLORS: Record<string, string> = { "aldi-sued": "#1a7a3a", "rewe": "#e30613" };
const fmt = (n: number | null) => n === null ? "—" : `${n.toFixed(2)} €`;
function brand(id: string) { return id.startsWith("aldi") ? "aldi-sued" : id.startsWith("rewe") ? "rewe" : "other"; }
function storeName(id: string) {
  if (id === "aldi-sued-national") return "ALDI SÜD";
  const p = id.split("-"); return p[0] === "rewe" ? `REWE ${p.slice(2).join(" ")||p[1]||""}`.trim() : p[0] === "aldi" ? `ALDI ${p.slice(2).join(" ")}`.trim() : id;
}

export function HotDealsTab() {
  const { data: deals, isLoading } = useQuery({
    queryKey: ["hot-deals"],
    queryFn: () => fetch("/api/hot-deals?limit=24").then(r => r.json()),
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Flame className="w-5 h-5 text-orange-500" />
        <h2 className="text-xl font-semibold">Hot Deals</h2>
        <span className="text-sm text-muted-foreground">— biggest discounts right now</span>
      </div>
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-lg" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(deals || []).map((d: any) => {
            const c = STORE_COLORS[brand(d.store_id)] || "#888";
            return (
              <div key={d.id} className="bg-card border rounded-lg p-4 hover:border-primary/40 transition cursor-pointer">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{d.product_title}</div>
                    {d.brand && <div className="text-xs text-muted-foreground">{d.brand}</div>}
                  </div>
                  <div className="flex flex-col items-end shrink-0">
                    <span className="text-lg font-bold text-destructive font-mono flex items-center gap-0.5"><Percent className="w-3 h-3" />{d.discount_pct}%</span>
                    <span className="text-xs text-emerald-600 font-medium">save {fmt(d.savings)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: c }} />
                    <span className="text-xs font-medium" style={{ color: c }}>{storeName(d.store_id)}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono font-semibold text-sm">{fmt(d.price)}</span>
                    <span className="text-xs text-muted-foreground line-through ml-1">{fmt(d.regular_price)}</span>
                  </div>
                </div>
              </div>
            );
          })}
          {(!deals || deals.length === 0) && (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <TrendingDown className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No hot deals found. Fetch some discounts first!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
