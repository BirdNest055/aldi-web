"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertCircle, Percent, TrendingUp, MapPin, Clock, Tag, Package, Scale, Clock3 } from "lucide-react";
import { fallbackAddress, type Quantity } from "@/lib/product-info";

interface ProductDetail {
  id: number;
  productTitle: string;
  brand: string | null;
  price: number | null;
  regularPrice: number | null;
  currency: string;
  category: string | null;
  validFrom: string | null;
  validUntil: string | null;
  fetchedAt: string;
  quantity: Quantity | null;
  isOnSale: boolean;
  discountPct: number | null;
  savingsAmount: number | null;
  store: {
    id: string;
    name: string;
    brand: string;
    address: string | null;
    openingHours: string | null;
  };
  priceHistory: Array<{
    id: number;
    storeId: string;
    storeName: string;
    storeBrand: string;
    price: number | null;
    regularPrice: number | null;
    currency: string;
    fetchedAt: string;
  }>;
  similar: Array<{
    id: number;
    productTitle: string;
    brand: string | null;
    price: number | null;
    regularPrice: number | null;
    storeId: string;
    storeName: string;
    fetchedAt: string;
  }>;
}

const STORE_BRAND_COLORS: Record<string, string> = {
  "aldi-sued": "#1a7a3a",
  "rewe": "#e30613",
};

const fmtPrice = (n: number | null, cur = "EUR") => {
  if (n === null) return "—";
  return `${n.toFixed(2)} ${cur === "EUR" ? "€" : cur}`;
};

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" }) : "—";

const fmtDateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

export function ProductDetail({
  productId,
  open,
  onOpenChange,
}: {
  productId: number | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: product, isLoading, isError, error } = useQuery({
    queryKey: ["product-detail", productId],
    queryFn: async () => {
      if (!productId) return null;
      const r = await fetch(`/api/products/${productId}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to load product");
      return d as ProductDetail;
    },
    enabled: !!productId && open,
    retry: 1,
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left">
            {isLoading ? <Skeleton className="h-6 w-3/4" /> : product?.productTitle || "Product details"}
          </SheetTitle>
          <SheetDescription className="text-left sr-only">
            Detailed information about this discount product
          </SheetDescription>
        </SheetHeader>

        {isLoading && <DetailSkeleton />}

        {isError && (
          <div className="mt-4 p-4 rounded-md bg-destructive/10 border border-destructive/30 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Failed to load product</p>
              <p className="text-xs text-muted-foreground mt-1">
                {(error as Error)?.message || "Unknown error"}
              </p>
            </div>
          </div>
        )}

        {product && !isLoading && !isError && (
          <div className="mt-4 space-y-6">
            {/* Price section */}
            <div className="p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-baseline justify-between">
                <div>
                  {product.isOnSale ? (
                    <>
                      <div className="text-3xl font-bold text-primary font-mono">
                        {fmtPrice(product.price, product.currency)}
                      </div>
                      <div className="text-sm text-muted-foreground line-through mt-1">
                        was {fmtPrice(product.regularPrice, product.currency)}
                      </div>
                    </>
                  ) : (
                    <div className="text-3xl font-bold font-mono">
                      {fmtPrice(product.price, product.currency)}
                    </div>
                  )}
                </div>
                {product.isOnSale && product.discountPct !== null && (
                  <div className="text-right">
                    <Badge variant="destructive" className="text-sm gap-0.5">
                      <Percent className="w-3 h-3" /> {product.discountPct}%
                    </Badge>
                    {product.savingsAmount !== null && (
                      <div className="text-xs text-emerald-600 mt-1">
                        save {fmtPrice(product.savingsAmount, product.currency)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Product info */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Product Info</h3>
              <InfoRow icon={Tag} label="Brand" value={product.brand || "—"} />
              <InfoRow icon={Package} label="Category" value={product.category || "—"} />
              <InfoRow
                icon={Scale}
                label="Size"
                value={product.quantity ? product.quantity.display : "—"}
              />
              {product.validFrom && (
                <InfoRow icon={Clock} label="Valid from" value={product.validFrom} />
              )}
              {product.validUntil && (
                <InfoRow icon={Clock} label="Valid until" value={product.validUntil} />
              )}
              <InfoRow icon={Clock} label="Fetched" value={fmtDateTime(product.fetchedAt)} />
            </div>

            {/* Store info — always shows address (with friendly fallback) + opening hours if available */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Store</h3>
              <div className="p-3 rounded-md bg-muted/50 border space-y-2">
                <div className="flex items-center gap-3">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ background: STORE_BRAND_COLORS[product.store.brand] || "#888" }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{product.store.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{product.store.id}</div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {product.store.brand === "aldi-sued" ? "ALDI SÜD" : product.store.brand.toUpperCase()}
                  </Badge>
                </div>
                {/* Address — always shown. Use DB value, fall back to friendly text for ALDI national. */}
                <div className="flex items-start gap-2 pl-6 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-foreground/80">
                    {product.store.address || fallbackAddress(product.store.id) || "Address not on file"}
                  </span>
                </div>
                {/* Opening hours — only if available */}
                {product.store.openingHours && (
                  <div className="flex items-start gap-2 pl-6 text-xs">
                    <Clock3 className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-foreground/80 font-mono">{product.store.openingHours}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Price history (same product across stores) */}
            {product.priceHistory.length > 1 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4" />
                  Price History ({product.priceHistory.length} entries)
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {product.priceHistory.map((h, i) => {
                    const isCurrent = h.id === product.id;
                    const hOnSale = h.price !== null && h.regularPrice !== null && h.price < h.regularPrice;
                    return (
                      <div
                        key={h.id}
                        className={`flex items-center gap-3 p-2 rounded-md text-sm ${
                          isCurrent ? "bg-primary/10 border border-primary/30" : "bg-muted/30"
                        }`}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: STORE_BRAND_COLORS[h.storeBrand] || "#888" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {h.storeName}
                            {isCurrent && <span className="text-primary ml-1">(this)</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">{fmtDate(h.fetchedAt)}</div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`font-mono text-sm ${hOnSale ? "text-primary font-semibold" : ""}`}>
                            {fmtPrice(h.price, h.currency)}
                          </div>
                          {hOnSale && (
                            <div className="text-xs text-muted-foreground line-through">
                              {fmtPrice(h.regularPrice, h.currency)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Similar products (same category) */}
            {product.similar.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Similar Products ({product.similar.length})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {product.similar.map((s) => {
                    const sOnSale = s.price !== null && s.regularPrice !== null && s.price < s.regularPrice;
                    const sBrand = s.storeId.startsWith("aldi") ? "aldi-sued" : s.storeId.startsWith("rewe") ? "rewe" : "other";
                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 p-2 rounded-md bg-muted/30 hover:bg-muted/50 transition cursor-pointer"
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: STORE_BRAND_COLORS[sBrand] || "#888" }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{s.productTitle}</div>
                          <div className="text-xs text-muted-foreground">
                            {s.storeName} · {fmtDate(s.fetchedAt)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className={`font-mono text-sm ${sOnSale ? "text-primary font-semibold" : ""}`}>
                            {fmtPrice(s.price)}
                          </div>
                          {sOnSale && (
                            <div className="text-xs text-muted-foreground line-through">
                              {fmtPrice(s.regularPrice)}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
      <span className="text-muted-foreground w-24 shrink-0">{label}</span>
      <span className="font-medium flex-1">{value}</span>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="mt-4 space-y-6">
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-3/4" />
      </div>
      <Skeleton className="h-16 w-full rounded-md" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full rounded-md" />
      </div>
    </div>
  );
}
