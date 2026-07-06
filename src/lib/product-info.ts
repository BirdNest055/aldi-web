/**
 * Shared product & store display utilities for the Discount Database app.
 *
 * Centralizes:
 *   - Quantity / weight / volume extraction from product titles
 *     (e.g. "Butter 250g" → { value: 250, unit: "g", display: "250 g" })
 *   - Friendly store name resolution (replaces buggy inline versions in tabs)
 *   - Brand resolution from store_id
 *
 * Used by API routes and React components alike to keep naming consistent
 * across the Dashboard, Products list, Hot Deals, Leaderboard, Compare and
 * Product Detail sheet.
 */

export interface Quantity {
  /** Numeric value, e.g. 250 for "250g", 1 for "1L", 0.5 for "0.5L" */
  value: number;
  /** Canonical unit, e.g. "g", "kg", "ml", "l", "stk", "pack" */
  unit: string;
  /** Display string, e.g. "250 g", "1 L", "0.5 L", "2 Stk" */
  display: string;
  /** Raw matched text from the title, e.g. "250g", "1L", "0,5 l" */
  raw: string;
}

/** Brand keys used throughout the UI. */
export type StoreBrand = "aldi-sued" | "rewe" | "other";

/**
 * Extract a quantity (weight / volume / count) from a product title.
 *
 * Supports common German supermarket patterns:
 *   - "Butter 250g"           → 250 g
 *   - "Milch 1L"              → 1 L
 *   - "Joghurt 0,5 l"         → 0.5 L
 *   - "Mehl 1 kg"             → 1 kg
 *   - "Saft 1,5 Liter"        → 1.5 L
 *   - "Eier 10er Pack"        → 10 Stk
 *   - "Brötchen 6 Stück"      → 6 Stk
 *   - "Wasser 6 x 1,5 l"      → 9 L (sum of multipack)
 *
 * Returns null if no quantity is found.
 */
export function extractQuantity(title: string | null | undefined): Quantity | null {
  if (!title) return null;
  const t = title.trim();

  // ── Multipack: "6 x 1,5 l", "4x200g", "2 x 0,5 l" ────────────────────────
  const multiRe = /(\d+)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(l|liter|ml|g|kg|gramm)\b/i;
  const multiMatch = t.match(multiRe);
  if (multiMatch) {
    const count = parseInt(multiMatch[1], 10);
    const each = parseFloat(multiMatch[2].replace(",", "."));
    const rawUnit = multiMatch[3].toLowerCase();
    const unit = normalizeUnit(rawUnit);
    const total = each * count;
    // For multipacks, show "6 × 1.5 L" rather than the summed value
    return {
      value: total,
      unit,
      display: `${count} × ${formatValue(each)} ${formatUnit(unit)}`,
      raw: multiMatch[0],
    };
  }

  // ── Single quantity with explicit unit ───────────────────────────────────
  // Matches: "250g", "250 g", "1L", "1 L", "0,5 l", "1.5 l", "1,5 Liter",
  //          "500 ml", "1 kg", "1000 gramm"
  const singleRe = /(\d+(?:[.,]\d+)?)\s*(l|liter|liter|ml|g|kg|gramm|stk|stück|stueck|st)\b/i;
  const singleMatch = t.match(singleRe);
  if (singleMatch) {
    const value = parseFloat(singleMatch[1].replace(",", "."));
    const rawUnit = singleMatch[2].toLowerCase();
    const unit = normalizeUnit(rawUnit);
    return {
      value,
      unit,
      display: `${formatValue(value)} ${formatUnit(unit)}`,
      raw: singleMatch[0],
    };
  }

  // ── Counted packs: "10er Pack", "6er Packung", "8 Pack" ──────────────────
  const packRe = /(\d+)er\s*(packung|pack|pck|tablette|tabletten|kapseln|beutel|tüten|rolls?|rolle)\b/i;
  const packMatch = t.match(packRe);
  if (packMatch) {
    const value = parseInt(packMatch[1], 10);
    return {
      value,
      unit: "stk",
      display: `${value} Stk`,
      raw: packMatch[0],
    };
  }

  // ── Plain count: "6 Stück", "10 Stk", "8 Stück" ──────────────────────────
  const countRe = /(\d+)\s*(stk|stück|stueck|st)\b/i;
  const countMatch = t.match(countRe);
  if (countMatch) {
    const value = parseInt(countMatch[1], 10);
    return {
      value,
      unit: "stk",
      display: `${value} Stk`,
      raw: countMatch[0],
    };
  }

  return null;
}

/** Normalize unit strings to canonical form. */
function normalizeUnit(raw: string): string {
  const u = raw.toLowerCase();
  if (u === "l" || u === "liter") return "l";
  if (u === "ml") return "ml";
  if (u === "g" || u === "gramm") return "g";
  if (u === "kg") return "kg";
  if (u === "stk" || u === "stück" || u === "stueck" || u === "st") return "stk";
  return u;
}

/** Format a numeric value for display (strip trailing zeros, comma decimal). */
function formatValue(v: number): string {
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(2).replace(/0+$/, "").replace(/\.$/, "").replace(".", ",");
}

/** Format unit for display (capitalize L, keep others lowercase). */
function formatUnit(u: string): string {
  if (u === "l") return "L";
  if (u === "ml") return "ml";
  if (u === "g") return "g";
  if (u === "kg") return "kg";
  if (u === "stk") return "Stk";
  return u;
}

/**
 * Resolve brand key from a store_id.
 *
 *   "aldi-sued-national" → "aldi-sued"
 *   "aldi-erlangen-1"    → "aldi-sued"
 *   "rewe-erlangen-1"    → "rewe"
 */
export function storeBrand(storeId: string): StoreBrand {
  if (storeId === "aldi-sued-national") return "aldi-sued";
  if (storeId.startsWith("aldi")) return "aldi-sued";
  if (storeId.startsWith("rewe")) return "rewe";
  return "other";
}

/**
 * Convert a slugified city segment to its proper German form.
 *   "nuernberg" → "Nürnberg"
 *   "muenchen"  → "München"
 *   "koeln"     → "Köln"
 *   "erlangen"  → "Erlangen"
 */
function deSlugifyCity(s: string): string {
  const umlautMap: Array<[string, string]> = [
    ["ae", "ä"], ["oe", "ö"], ["ue", "ü"], ["ss", "ß"],
    ["Ae", "Ä"], ["Oe", "Ö"], ["Ue", "Ü"],
  ];
  let result = s;
  for (const [from, to] of umlautMap) {
    result = result.replace(new RegExp(from, "g"), to);
  }
  return result.charAt(0).toUpperCase() + result.slice(1);
}

/**
 * Map a store_id to a friendly display name.
 *
 *   "aldi-sued-national" → "ALDI SÜD"
 *   "rewe-erlangen-1"    → "REWE Erlangen"
 *   "rewe-muenchen-3"    → "REWE München"
 *   "aldi-augsburg-2"    → "ALDI SÜD Augsburg"
 *   "rewe-bayern-12345"  → "REWE Bayern"  (discovery-style IDs)
 *
 * Replaces the buggy inline versions that previously returned "REWE 1"
 * for `rewe-erlangen-1` because they used `p.slice(2).join(" ")`.
 */
export function storeDisplayName(storeId: string): string {
  if (storeId === "aldi-sued-national") return "ALDI SÜD";

  const parts = storeId.split("-");
  if (parts[0] === "rewe") {
    const city = parts[1] ? deSlugifyCity(parts[1]) : "";
    return `REWE ${city}`.trim();
  }
  if (parts[0] === "aldi") {
    const city = parts[1] ? deSlugifyCity(parts[1]) : "";
    return `ALDI SÜD ${city}`.trim();
  }
  return storeId;
}

/**
 * Provide a friendly fallback address for stores without one in the DB.
 *   "aldi-sued-national" → "Germany-wide — same prospectus everywhere"
 *   others               → ""
 */
export function fallbackAddress(storeId: string): string {
  if (storeId === "aldi-sued-national") {
    return "Germany-wide — same prospectus everywhere";
  }
  return "";
}

/**
 * Format an ISO date for German display: "06.07.2026" or "06.07.2026, 14:30".
 */
export function fmtDeDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
  });
}

export function fmtDeDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
