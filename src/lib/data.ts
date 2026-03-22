import rawData from "../../public/data.json";
import type { Restaurant, RestaurantData } from "./types";

/**
 * Returns the full restaurant dataset.
 * For static export the JSON is bundled at build time via resolveJsonModule.
 */
export async function getRestaurantData(): Promise<RestaurantData> {
  return rawData as unknown as RestaurantData;
}

/**
 * Extracts sorted unique values for a given top-level string or string[]
 * field on Restaurant. Works for fields like "city", "suburb", "cuisines",
 * "vibe_tags", "session_types", etc.
 */
export function getUniqueValues(
  restaurants: Restaurant[],
  field: keyof Restaurant
): string[] {
  const set = new Set<string>();
  for (const r of restaurants) {
    const val = r[field];
    if (Array.isArray(val)) {
      for (const v of val) {
        if (typeof v === "string") set.add(v);
      }
    } else if (typeof val === "string") {
      set.add(val);
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

/**
 * Returns every date string that has at least one available slot,
 * sorted chronologically.
 */
export function getAvailableDates(restaurants: Restaurant[]): string[] {
  const set = new Set<string>();
  for (const r of restaurants) {
    for (const slot of r.slots) {
      set.add(slot.date);
    }
  }
  return Array.from(set).sort();
}

/**
 * Returns a list of cities with their restaurant counts,
 * sorted by count descending.
 */
export function getCityList(
  restaurants: Restaurant[]
): { city: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of restaurants) {
    counts.set(r.city, (counts.get(r.city) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([city, count]) => ({ city, count }))
    .sort((a, b) => b.count - a.count);
}
