"use client";
import { useQuery } from "@tanstack/react-query";
import { Grid3x3, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const STORE_COLORS: Record<string, string> = { "aldi-sued": "#1a7a3a", "rewe": "#e30613" };
function brand(id: string) { return id.startsWith("aldi") ? "aldi-sued" : id.startsWith("rewe") ? "rewe" : "other"; }
function storeName(id: string) {
  if (id === "aldi-sued-national") return "ALDI SÜD";
  const p = id.split("-"); return p[0] === "rewe" ? `REWE ${p.slice(2).join(" ")||p[1]||""}`.trim() : p[0] === "aldi" ? `ALDI` : id;
}

export function PriceComparisonTab() {
  const { data: products, isLoading } = useQuery({
    queryKey: ["price-comparison"],
    queryFn: () => fetch("/api/price-comparison?limit=30").then(r => r.json()),
  });

  // Collect all unique store IDs from the comparison data
  const allStores = new Set<string>();
  (products || []).forEach((p: any) => p.prices.forEach((pr: any) => allStores.add(pr.store_id)));
  const stores = Array.from(allStores).slice(0, 8);

  function priceColor(price: number, min: number, max: number) {
    if (max === min) return "hsl(120, 60%, 25%)";
    const pct = (price - min) / (max - min);
    const hue = 120 - pct * 120; // 120=green, 0=red
    return `hsl(${hue}, 60%, 25%)`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Grid3x3 className="w-5 h-5 text-indigo-400" />
        <h2 className="text-xl font-semibold">Price Comparison</h2>
        <span className="text-sm text-muted-foreground">— same product across stores, sorted by price gap</span>
      </div>

      {isLoading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : products && products.length > 0 ? (
        <div className="bg-card border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-3 py-2 text-left sticky left-0 bg-muted/50 z-10">Product</th>
                {stores.map(sid => (
                  <th key={sid} className="px-3 py-2 text-center min-w-[80px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: STORE_COLORS[brand(sid)] || "#888" }} />
                      {storeName(sid).substring(0, 15)}
                    </div>
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Gap</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p: any, i: number) => (
                <tr key={i} className="border-t border-border hover:bg-muted/20">
                  <td className="px-3 py-2 truncate max-w-[150px] sticky left-0 bg-card z-10" title={p.product_title}>
                    {p.product_title}
                  </td>
                  {stores.map(sid => {
                    const priceEntry = p.prices.find((pr: any) => pr.store_id === sid);
                    if (!priceEntry) return <td key={sid} className="px-3 py-2 text-center text-muted-foreground/30">—</td>;
                    const color = priceColor(priceEntry.price, p.min_price, p.max_price);
                    const isMin = priceEntry.price === p.min_price;
                    return (
                      <td key={sid} className="px-3 py-2 text-center">
                        <span className="inline-block px-2 py-1 rounded text-xs font-mono font-medium" style={{ background: color, color: "#fff" }}>
                          {isMin && "★ "}{priceEntry.price.toFixed(2)}€
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-mono text-xs text-amber-500">{p.price_spread.toFixed(2)}€</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Grid3x3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No products found at multiple stores yet. Fetch more stores!</p>
        </div>
      )}

      <p className="text-xs text-muted-foreground">★ = cheapest store for this product. Green = cheapest, red = most expensive. Gap = price difference between cheapest and most expensive.</p>
    </div>
  );
}
