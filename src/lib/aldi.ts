import { getDb } from "@/lib/db-sqlite";

// ===========================================================================
// Types (returned to API / UI) — kept identical to the Prisma version
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

export interface BrandEntry {
  name: string;
  count: number;
  avgPrice: number | null;
  minPrice: number | null;
  maxPrice: number | null;
}

// ===========================================================================
// Query layer — uses better-sqlite3 (works on Vercel serverless)
// ===========================================================================

export async function getStats(): Promise<Stats> {
  const db = getDb();

  const publications = db.prepare("SELECT COUNT(*) as n FROM publications").get() as any;
  const products = db.prepare("SELECT COUNT(*) as n FROM products").get() as any;
  const offerings = db.prepare("SELECT COUNT(*) as n FROM product_offerings").get() as any;

  const categoryAgg = db.prepare(
    "SELECT COUNT(DISTINCT product_type) as n FROM product_offerings WHERE product_type IS NOT NULL AND product_type != ''"
  ).get() as any;

  const priceAgg = db.prepare(
    "SELECT MIN(price_numeric) as lo, MAX(price_numeric) as hi, AVG(price_numeric) as avg FROM product_offerings WHERE price_numeric IS NOT NULL"
  ).get() as any;

  const pubs = db.prepare(
    `SELECT id, slug, original_title, valid_dates, valid_date_start, valid_date_end, fetched_at,
            (SELECT COUNT(*) FROM product_offerings WHERE publication_id = p.id) as off_count
     FROM publications p
     ORDER BY valid_date_start DESC`
  ).all() as any[];

  return {
    publications: publications.n,
    products: products.n,
    offerings: offerings.n,
    categories: categoryAgg.n,
    priceMin: priceAgg.lo,
    priceMax: priceAgg.hi,
    priceAvg: priceAgg.avg,
    publicationList: pubs.map((p) => ({
      id: p.id,
      slug: p.slug,
      originalTitle: p.original_title,
      validDates: p.valid_dates,
      validDateStart: p.valid_date_start,
      validDateEnd: p.valid_date_end,
      fetchedAt: p.fetched_at,
      offeringCount: p.off_count,
    })),
  };
}

export async function listPublications() {
  const db = getDb();
  const pubs = db.prepare(
    `SELECT *, (SELECT COUNT(*) FROM product_offerings WHERE publication_id = p.id) as off_count
     FROM publications p
     ORDER BY fetched_at DESC`
  ).all() as any[];
  return pubs.map((p) => ({ ...p, offeringCount: p.off_count }));
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
  const db = getDb();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  const where: string[] = [];
  const vals: any[] = [];

  if (params.publicationId) {
    where.push("o.publication_id = ?");
    vals.push(params.publicationId);
  }
  if (params.search) {
    where.push("(LOWER(o.title) LIKE ? OR LOWER(o.description) LIKE ? OR LOWER(o.brand) LIKE ?)");
    const s = `%${params.search.toLowerCase()}%`;
    vals.push(s, s, s);
  }
  if (params.category) {
    where.push("o.product_type LIKE ?");
    vals.push(`%${params.category}%`);
  }
  if (params.brand) {
    where.push("o.brand LIKE ?");
    vals.push(`%${params.brand}%`);
  }
  if (params.onSaleOnly) {
    where.push("o.discounted_price_numeric IS NOT NULL");
  }
  if (params.minPrice !== undefined) {
    where.push("o.price_numeric >= ?");
    vals.push(params.minPrice);
  }
  if (params.maxPrice !== undefined) {
    where.push("o.price_numeric <= ?");
    vals.push(params.maxPrice);
  }

  let orderBy = "o.title ASC";
  switch (params.sort) {
    case "price-asc":
      where.push("o.price_numeric IS NOT NULL");
      orderBy = "o.price_numeric ASC";
      break;
    case "price-desc":
      where.push("o.price_numeric IS NOT NULL");
      orderBy = "o.price_numeric DESC";
      break;
    case "title-desc":
      orderBy = "o.title DESC";
      break;
    case "newest":
      orderBy = "o.id DESC";
      break;
  }

  const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

  const rows = db.prepare(
    `SELECT o.*, p.product_key, pub.slug as pub_slug, pub.original_title as pub_title
     FROM product_offerings o
     JOIN products p ON p.id = o.product_id
     JOIN publications pub ON pub.id = o.publication_id
     ${whereClause}
     ORDER BY ${orderBy}
     LIMIT ? OFFSET ?`
  ).all(...vals, pageSize, offset) as any[];

  const totalRow = db.prepare(
    `SELECT COUNT(*) as n FROM product_offerings o ${whereClause}`
  ).get(...vals) as any;

  return {
    items: rows.map((r) => ({
      id: r.id,
      productKey: r.product_key,
      productIdRemote: r.product_id_remote,
      title: r.title,
      brand: r.brand,
      price: r.price,
      priceNumeric: r.price_numeric,
      discountedPriceNumeric: r.discounted_price_numeric,
      currency: r.currency || "EUR",
      productType: r.product_type,
      description: r.description,
      pageRange: r.page_range,
      publicationId: r.publication_id,
      publicationSlug: r.pub_slug,
      publicationOriginalTitle: r.pub_title,
      webshopIdentifier: r.webshop_identifier,
    })),
    total: totalRow.n,
    page,
    pageSize,
  };
}

export async function getProductDetail(
  productKey: string
): Promise<ProductDetail | null> {
  const db = getDb();

  const product = db.prepare(
    "SELECT * FROM products WHERE product_key = ?"
  ).get(productKey) as any;
  if (!product) return null;

  const offerings = db.prepare(
    `SELECT o.*, pub.slug as pub_slug, pub.original_title as pub_title, pub.fetched_at as pub_fetched
     FROM product_offerings o
     JOIN publications pub ON pub.id = o.publication_id
     WHERE o.product_id = ?
     ORDER BY pub.fetched_at ASC`
  ).all(product.id) as any[];

  const titleHistory = db.prepare(
    "SELECT title, first_seen_at, last_seen_at FROM product_titles WHERE product_id = ? ORDER BY first_seen_at ASC"
  ).all(product.id) as any[];

  const descriptionHistory = db.prepare(
    "SELECT description, first_seen_at, last_seen_at FROM product_descriptions WHERE product_id = ? ORDER BY first_seen_at ASC"
  ).all(product.id) as any[];

  const brandHistory = db.prepare(
    "SELECT brand, first_seen_at, last_seen_at FROM product_brands WHERE product_id = ? ORDER BY first_seen_at ASC"
  ).all(product.id) as any[];

  // Get photos + labels for each offering
  const offeringDetails = offerings.map((o) => {
    const photos = db.prepare(
      "SELECT url, kind FROM product_photos WHERE offering_id = ?"
    ).all(o.id) as any[];
    const labels = db.prepare(
      "SELECT key, value FROM product_labels WHERE offering_id = ?"
    ).all(o.id) as any[];
    return {
      id: o.id,
      publicationId: o.publication_id,
      publicationSlug: o.pub_slug,
      publicationOriginalTitle: o.pub_title,
      fetchedAt: o.pub_fetched,
      title: o.title,
      description: o.description,
      brand: o.brand,
      price: o.price,
      priceNumeric: o.price_numeric,
      discountedPrice: o.discounted_price,
      discountedPriceNumeric: o.discounted_price_numeric,
      currency: o.currency || "EUR",
      productType: o.product_type,
      pageRange: o.page_range,
      webshopIdentifier: o.webshop_identifier,
      photos: photos.map((p) => ({ url: p.url, kind: p.kind })),
      labels: labels.map((l) => ({ key: l.key, value: l.value })),
    };
  });

  return {
    product: {
      id: product.id,
      productKey: product.product_key,
      canonicalTitle: product.canonical_title,
      canonicalType: product.canonical_type,
      firstSeenAt: product.first_seen_at,
      lastSeenAt: product.last_seen_at,
    },
    offerings: offeringDetails,
    titleHistory: titleHistory.map((t) => ({
      title: t.title,
      firstSeenAt: t.first_seen_at,
      lastSeenAt: t.last_seen_at,
    })),
    descriptionHistory: descriptionHistory.map((d) => ({
      description: d.description,
      firstSeenAt: d.first_seen_at,
      lastSeenAt: d.last_seen_at,
    })),
    brandHistory: brandHistory.map((b) => ({
      brand: b.brand,
      firstSeenAt: b.first_seen_at,
      lastSeenAt: b.last_seen_at,
    })),
  };
}

export async function getPriceHistory(
  productKey: string
): Promise<PriceHistory | null> {
  const db = getDb();

  const product = db.prepare(
    "SELECT * FROM products WHERE product_key = ?"
  ).get(productKey) as any;
  if (!product) return null;

  const offerings = db.prepare(
    `SELECT o.*, pub.id as pub_id, pub.slug as pub_slug, pub.original_title as pub_title,
            pub.fetched_at as pub_fetched, pub.valid_for as pub_valid
     FROM product_offerings o
     JOIN publications pub ON pub.id = o.publication_id
     WHERE o.product_id = ?
     ORDER BY pub.fetched_at ASC`
  ).all(product.id) as any[];

  // Group by publication
  const byPub = new Map<number, any[]>();
  for (const o of offerings) {
    if (!byPub.has(o.pub_id)) byPub.set(o.pub_id, []);
    byPub.get(o.pub_id)!.push(o);
  }

  const history: PriceHistoryEntry[] = [];
  for (const [pubId, offs] of byPub) {
    const prices = offs.map((o) => o.price_numeric).filter((p: any) => p !== null);
    const webshopIds = offs
      .map((o) => o.webshop_identifier)
      .filter((x: any) => x !== null && x !== "");

    history.push({
      publicationId: pubId,
      publicationSlug: offs[0].pub_slug,
      publicationOriginalTitle: offs[0].pub_title,
      fetchedAt: offs[0].pub_fetched,
      validFor: offs[0].pub_valid,
      titleThisWeek: offs[0].title,
      priceMin: prices.length ? Math.min(...prices) : null,
      priceMax: prices.length ? Math.max(...prices) : null,
      priceAvg: prices.length ? prices.reduce((a: number, b: number) => a + b, 0) / prices.length : null,
      currency: offs[0].currency || "EUR",
      productType: offs[0].product_type,
      pageRange: offs[0].page_range,
      nOfferings: offs.length,
      webshopIdentifiers: webshopIds.length ? Array.from(new Set(webshopIds)).join(",") : null,
    });
  }

  return {
    productKey: product.product_key,
    canonicalTitle: product.canonical_title,
    canonicalType: product.canonical_type,
    firstSeenAt: product.first_seen_at,
    lastSeenAt: product.last_seen_at,
    history,
  };
}

export async function getDiff(
  pubAId: number,
  pubBId: number
): Promise<DiffResult> {
  const db = getDb();

  const pubA = db.prepare(
    "SELECT id, slug, original_title FROM publications WHERE id = ?"
  ).get(pubAId) as any;
  const pubB = db.prepare(
    "SELECT id, slug, original_title FROM publications WHERE id = ?"
  ).get(pubBId) as any;

  if (!pubA || !pubB) {
    throw new Error("Publication not found");
  }

  const offA = db.prepare(
    `SELECT o.*, p.product_key, p.canonical_title
     FROM product_offerings o
     JOIN products p ON p.id = o.product_id
     WHERE o.publication_id = ?`
  ).all(pubAId) as any[];

  const offB = db.prepare(
    `SELECT o.*, p.product_key, p.canonical_title
     FROM product_offerings o
     JOIN products p ON p.id = o.product_id
     WHERE o.publication_id = ?`
  ).all(pubBId) as any[];

  // Build maps: product_key -> { canonical_title, min_price }
  function buildMap(offs: any[]) {
    const m = new Map<string, { canonicalTitle: string | null; minPrice: number | null }>();
    for (const o of offs) {
      const key = o.product_key;
      const price = o.price_numeric;
      if (!m.has(key)) {
        m.set(key, { canonicalTitle: o.canonical_title, minPrice: price });
      } else {
        const existing = m.get(key)!;
        if (price !== null && (existing.minPrice === null || price < existing.minPrice)) {
          existing.minPrice = price;
        }
      }
    }
    return m;
  }

  const mapA = buildMap(offA);
  const mapB = buildMap(offB);

  const added: DiffResult["added"] = [];
  const removed: DiffResult["removed"] = [];
  const priceChanges: DiffResult["priceChanges"] = [];

  for (const [key, val] of mapB) {
    if (!mapA.has(key)) {
      added.push({ productKey: key, canonicalTitle: val.canonicalTitle });
    } else {
      const a = mapA.get(key)!;
      if (a.minPrice !== null && val.minPrice !== null && a.minPrice !== val.minPrice) {
        priceChanges.push({
          productKey: key,
          canonicalTitle: val.canonicalTitle,
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
      removed.push({ productKey: key, canonicalTitle: val.canonicalTitle });
    }
  }

  return { pubA, pubB, added, removed, priceChanges };
}

export async function listCategories(
  publicationId?: number
): Promise<CategoryEntry[]> {
  const db = getDb();
  let sql = `SELECT product_type as name, COUNT(*) as count
             FROM product_offerings
             WHERE product_type IS NOT NULL AND product_type != ''`;
  const vals: any[] = [];
  if (publicationId) {
    sql += " AND publication_id = ?";
    vals.push(publicationId);
  }
  sql += " GROUP BY product_type ORDER BY count DESC";
  return db.prepare(sql).all(...vals) as CategoryEntry[];
}

export async function listBrands(
  publicationId?: number
): Promise<BrandEntry[]> {
  const db = getDb();
  let sql = `SELECT brand as name, COUNT(*) as count,
                    AVG(price_numeric) as avgPrice,
                    MIN(price_numeric) as minPrice,
                    MAX(price_numeric) as maxPrice
             FROM product_offerings
             WHERE brand IS NOT NULL AND brand != ''`;
  const vals: any[] = [];
  if (publicationId) {
    sql += " AND publication_id = ?";
    vals.push(publicationId);
  }
  sql += " GROUP BY brand ORDER BY count DESC";
  return db.prepare(sql).all(...vals) as BrandEntry[];
}
