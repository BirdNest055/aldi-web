import { db } from "@/lib/db";
import type {
  Publication,
  Product,
  ProductOffering,
} from "@prisma/client";

// ===========================================================================
// Types (returned to API / UI)
// ===========================================================================

export interface Stats {
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

export interface ProductListItem {
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

export interface ProductListResult {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface OfferingWithDetails {
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
}

export interface ProductDetail {
  product: {
    id: number;
    productKey: string;
    canonicalTitle: string | null;
    canonicalType: string | null;
    firstSeenAt: string | null;
    lastSeenAt: string | null;
  };
  offerings: OfferingWithDetails[];
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

export interface PriceHistoryEntry {
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
  webshopIdentifiers: string | null;
}

export interface PriceHistory {
  productKey: string;
  canonicalTitle: string | null;
  canonicalType: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  history: PriceHistoryEntry[];
}

export interface DiffResult {
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

export interface CategoryEntry {
  name: string;
  count: number;
}

// ===========================================================================
// Query layer
// ===========================================================================

export async function getStats(): Promise<Stats> {
  const [publications, products, offerings, categoryAgg, priceAgg] =
    await Promise.all([
      db.publication.count(),
      db.product.count(),
      db.productOffering.count(),
      db.productOffering.groupBy({
        by: ["productType"],
        where: { productType: { not: null, not: "" } },
        _count: { _all: true },
      }),
      db.productOffering.aggregate({
        _min: { priceNumeric: true },
        _max: { priceNumeric: true },
        _avg: { priceNumeric: true },
        where: { priceNumeric: { not: null } },
      }),
    ]);

  const publicationList = await db.publication.findMany({
    orderBy: { validDateStart: "desc" },
    select: {
      id: true,
      slug: true,
      originalTitle: true,
      validDates: true,
      validDateStart: true,
      validDateEnd: true,
      fetchedAt: true,
      _count: { select: { offerings: true } },
    },
  });

  return {
    publications,
    products,
    offerings,
    categories: categoryAgg.length,
    priceMin: priceAgg._min.priceNumeric,
    priceMax: priceAgg._max.priceNumeric,
    priceAvg: priceAgg._avg.priceNumeric,
    publicationList: publicationList.map((p) => ({
      id: p.id,
      slug: p.slug,
      originalTitle: p.originalTitle,
      validDates: p.validDates,
      validDateStart: p.validDateStart,
      validDateEnd: p.validDateEnd,
      fetchedAt: p.fetchedAt,
      offeringCount: p._count.offerings,
    })),
  };
}

export async function listPublications() {
  const pubs = await db.publication.findMany({
    orderBy: { fetchedAt: "desc" },
    include: { _count: { select: { offerings: true } } },
  });
  return pubs.map((p) => ({
    ...p,
    offeringCount: p._count.offerings,
  }));
}

export interface ListProductsParams {
  publicationId?: number;
  search?: string;
  category?: string;
  brand?: string;
  onSaleOnly?: boolean;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
  sort?: "price-asc" | "price-desc" | "title-asc" | "title-desc" | "newest";
}

export async function listProducts(
  params: ListProductsParams = {}
): Promise<ProductListResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  const skip = (page - 1) * pageSize;

  const where: Record<string, unknown> = {};
  if (params.publicationId) {
    where.publicationId = params.publicationId;
  }
  if (params.search) {
    const s = params.search.toLowerCase();
    where.OR = [
      { title: { contains: s } },
      { description: { contains: s } },
      { brand: { contains: s } },
    ];
  }
  if (params.category) {
    where.productType = { contains: params.category };
  }
  if (params.brand) {
    where.brand = { contains: params.brand };
  }
  if (params.onSaleOnly) {
    where.discountedPriceNumeric = { not: null };
  }
  if (params.minPrice !== undefined || params.maxPrice !== undefined) {
    where.priceNumeric = {};
    if (params.minPrice !== undefined) where.priceNumeric.gte = params.minPrice;
    if (params.maxPrice !== undefined) where.priceNumeric.lte = params.maxPrice;
  }

  // For price sorts, push NULL prices to the end using a computed sort.
  // SQLite doesn't support NULLS LAST directly, so we sort by
  // (priceNumeric IS NULL) first, then by priceNumeric.
  let orderBy: Record<string, string> | Array<Record<string, string>> = {
    title: "asc",
  };
  switch (params.sort) {
    case "price-asc":
      orderBy = [
        { priceNumeric: "asc" }, // NULLs sort first in SQLite; filter below
      ];
      break;
    case "price-desc":
      orderBy = [{ priceNumeric: "desc" }];
      break;
    case "title-desc":
      orderBy = { title: "desc" };
      break;
    case "newest":
      orderBy = { id: "desc" };
      break;
    default:
      orderBy = { title: "asc" };
  }

  // For price-asc, exclude NULL prices so they don't pollute the head.
  // (The UI can show a separate "no price" filter if needed.)
  const finalWhere = { ...where };
  if (params.sort === "price-asc" || params.sort === "price-desc") {
    finalWhere.priceNumeric = { ...(finalWhere.priceNumeric || {}), not: null };
  }

  const [rows, total] = await Promise.all([
    db.productOffering.findMany({
      where: finalWhere,
      orderBy,
      skip,
      take: pageSize,
      include: {
        product: { select: { productKey: true } },
        publication: {
          select: { slug: true, originalTitle: true },
        },
      },
    }),
    db.productOffering.count({ where: finalWhere }),
  ]);

  return {
    items: rows.map((r) => ({
      id: r.id,
      productKey: r.product.productKey,
      productIdRemote: r.productIdRemote,
      title: r.title,
      brand: r.brand,
      price: r.price,
      priceNumeric: r.priceNumeric,
      discountedPriceNumeric: r.discountedPriceNumeric,
      currency: r.currency,
      productType: r.productType,
      description: r.description,
      pageRange: r.pageRange,
      publicationId: r.publicationId,
      publicationSlug: r.publication.slug,
      publicationOriginalTitle: r.publication.originalTitle,
      webshopIdentifier: r.webshopIdentifier,
    })),
    total,
    page,
    pageSize,
  };
}

export async function getProductDetail(
  productKey: string
): Promise<ProductDetail | null> {
  const product = await db.product.findUnique({
    where: { productKey },
  });
  if (!product) return null;

  const [offerings, titleHistory, descriptionHistory, brandHistory] = await Promise.all([
    db.productOffering.findMany({
      where: { productId: product.id },
      include: {
        publication: {
          select: { slug: true, originalTitle: true, fetchedAt: true },
        },
        photos: { select: { url: true, kind: true } },
        labels: { select: { key: true, value: true } },
      },
      orderBy: { publication: { fetchedAt: "asc" } },
    }),
    db.productTitle.findMany({
      where: { productId: product.id },
      orderBy: { firstSeenAt: "asc" },
    }),
    db.productDescription.findMany({
      where: { productId: product.id },
      orderBy: { firstSeenAt: "asc" },
    }),
    db.productBrand.findMany({
      where: { productId: product.id },
      orderBy: { firstSeenAt: "asc" },
    }),
  ]);

  return {
    product: {
      id: product.id,
      productKey: product.productKey,
      canonicalTitle: product.canonicalTitle,
      canonicalType: product.canonicalType,
      firstSeenAt: product.firstSeenAt,
      lastSeenAt: product.lastSeenAt,
    },
    offerings: offerings.map((o) => ({
      id: o.id,
      publicationId: o.publicationId,
      publicationSlug: o.publication.slug,
      publicationOriginalTitle: o.publication.originalTitle,
      fetchedAt: o.publication.fetchedAt,
      title: o.title,
      description: o.description,
      brand: o.brand,
      price: o.price,
      priceNumeric: o.priceNumeric,
      discountedPrice: o.discountedPrice,
      discountedPriceNumeric: o.discountedPriceNumeric,
      currency: o.currency,
      productType: o.productType,
      pageRange: o.pageRange,
      webshopIdentifier: o.webshopIdentifier,
      photos: o.photos.map((p) => ({ url: p.url, kind: p.kind })),
      labels: o.labels.map((l) => ({ key: l.key, value: l.value })),
    })),
    titleHistory: titleHistory.map((t) => ({
      title: t.title,
      firstSeenAt: t.firstSeenAt,
      lastSeenAt: t.lastSeenAt,
    })),
    descriptionHistory: descriptionHistory.map((d) => ({
      description: d.description,
      firstSeenAt: d.firstSeenAt,
      lastSeenAt: d.lastSeenAt,
    })),
    brandHistory: brandHistory.map((b) => ({
      brand: b.brand,
      firstSeenAt: b.firstSeenAt,
      lastSeenAt: b.lastSeenAt,
    })),
  };
}

export async function getPriceHistory(
  productKey: string
): Promise<PriceHistory | null> {
  const product = await db.product.findUnique({
    where: { productKey },
  });
  if (!product) return null;

  const offerings = await db.productOffering.findMany({
    where: { productId: product.id },
    include: {
      publication: {
        select: {
          id: true,
          slug: true,
          originalTitle: true,
          fetchedAt: true,
          validFor: true,
        },
      },
    },
    orderBy: { publication: { fetchedAt: "asc" } },
  });

  // Group by publication (a product may have multiple offerings in one pub)
  const byPub = new Map<
    number,
    {
      pub: (typeof offerings)[number]["publication"];
      offerings: (typeof offerings)[number][];
    }
  >();
  for (const o of offerings) {
    if (!byPub.has(o.publicationId)) {
      byPub.set(o.publicationId, { pub: o.publication, offerings: [] });
    }
    byPub.get(o.publicationId)!.offerings.push(o);
  }

  const history: PriceHistoryEntry[] = [];
  for (const [, { pub, offerings: offs }] of byPub) {
    const prices = offs
      .map((o) => o.priceNumeric)
      .filter((p): p is number => p !== null);
    const webshopIds = offs
      .map((o) => o.webshopIdentifier)
      .filter((x): x is string => x !== null && x !== "");

    history.push({
      publicationId: pub.id,
      publicationSlug: pub.slug,
      publicationOriginalTitle: pub.originalTitle,
      fetchedAt: pub.fetchedAt,
      validFor: pub.validFor,
      titleThisWeek: offs[0]?.title ?? null,
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      priceAvg: prices.length
        ? prices.reduce((a, b) => a + b, 0) / prices.length
        : null,
      currency: offs[0]?.currency ?? "EUR",
      productType: offs[0]?.productType ?? null,
      pageRange: offs[0]?.pageRange ?? null,
      nOfferings: offs.length,
      webshopIdentifiers: webshopIds.length
        ? Array.from(new Set(webshopIds)).join(",")
        : null,
    });
  }

  return {
    productKey: product.productKey,
    canonicalTitle: product.canonicalTitle,
    canonicalType: product.canonicalType,
    firstSeenAt: product.firstSeenAt,
    lastSeenAt: product.lastSeenAt,
    history,
  };
}

export async function getDiff(
  pubAId: number,
  pubBId: number
): Promise<DiffResult> {
  const [pubA, pubB] = await Promise.all([
    db.publication.findUnique({
      where: { id: pubAId },
      select: { id: true, slug: true, originalTitle: true },
    }),
    db.publication.findUnique({
      where: { id: pubBId },
      select: { id: true, slug: true, originalTitle: true },
    }),
  ]);
  if (!pubA || !pubB) {
    throw new Error("Publication not found");
  }

  // Get all offerings in both pubs, joined with product
  const [offA, offB] = await Promise.all([
    db.productOffering.findMany({
      where: { publicationId: pubAId },
      include: { product: true },
    }),
    db.productOffering.findMany({
      where: { publicationId: pubBId },
      include: { product: true },
    }),
  ]);

  // Group by productKey -> { min price in A, min price in B }
  const mapA = new Map<string, { product: typeof offA[number]["product"]; minPrice: number | null }>();
  for (const o of offA) {
    const key = o.product.productKey;
    const price = o.priceNumeric;
    if (!mapA.has(key)) {
      mapA.set(key, { product: o.product, minPrice: price });
    } else {
      const existing = mapA.get(key)!;
      if (price !== null && (existing.minPrice === null || price < existing.minPrice)) {
        existing.minPrice = price;
      }
    }
  }
  const mapB = new Map<string, { product: typeof offB[number]["product"]; minPrice: number | null }>();
  for (const o of offB) {
    const key = o.product.productKey;
    const price = o.priceNumeric;
    if (!mapB.has(key)) {
      mapB.set(key, { product: o.product, minPrice: price });
    } else {
      const existing = mapB.get(key)!;
      if (price !== null && (existing.minPrice === null || price < existing.minPrice)) {
        existing.minPrice = price;
      }
    }
  }

  const added: DiffResult["added"] = [];
  const removed: DiffResult["removed"] = [];
  const priceChanges: DiffResult["priceChanges"] = [];

  for (const [key, val] of mapB) {
    if (!mapA.has(key)) {
      added.push({
        productKey: key,
        canonicalTitle: val.product.canonicalTitle,
      });
    } else {
      const a = mapA.get(key)!;
      if (
        a.minPrice !== null &&
        val.minPrice !== null &&
        a.minPrice !== val.minPrice
      ) {
        priceChanges.push({
          productKey: key,
          canonicalTitle: val.product.canonicalTitle,
          oldPrice: a.minPrice,
          newPrice: val.minPrice,
          oldPubId: pubAId,
          newPubId: pubBId,
        });
      }
    }
  }
  for (const [key, val] of mapA) {
    if (!mapB.has(key)) {
      removed.push({
        productKey: key,
        canonicalTitle: val.product.canonicalTitle,
      });
    }
  }

  return { pubA, pubB, added, removed, priceChanges };
}

export async function listCategories(
  publicationId?: number
): Promise<CategoryEntry[]> {
  const where: Record<string, unknown> = {
    productType: { not: null, not: "" },
  };
  if (publicationId) {
    where.publicationId = publicationId;
  }
  const result = await db.productOffering.groupBy({
    by: ["productType"],
    where,
    _count: { _all: true },
    orderBy: { _count: { productType: "desc" } },
  });
  return result.map((r) => ({
    name: r.productType ?? "",
    count: r._count._all,
  }));
}

export interface BrandEntry {
  name: string;
  count: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
}

export async function listBrands(
  publicationId?: number
): Promise<BrandEntry[]> {
  const where: Record<string, unknown> = {
    brand: { not: null, not: "" },
  };
  if (publicationId) {
    where.publicationId = publicationId;
  }
  const result = await db.productOffering.groupBy({
    by: ["brand"],
    where,
    _count: { _all: true },
    _avg: { priceNumeric: true },
    _min: { priceNumeric: true },
    _max: { priceNumeric: true },
    orderBy: { _count: { brand: "desc" } },
  });
  return result.map((r) => ({
    name: r.brand ?? "",
    count: r._count._all,
    avgPrice: r._avg.priceNumeric,
    minPrice: r._min.priceNumeric,
    maxPrice: r._max.priceNumeric,
  }));
}
