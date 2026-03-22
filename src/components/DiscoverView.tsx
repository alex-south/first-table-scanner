"use client";

import { useState, useMemo, useEffect } from "react";
import type { Restaurant, UserPreferences } from "@/lib/types";
import { searchRestaurants } from "@/lib/search";
import { getPreferences } from "@/lib/storage";
import { SearchBar } from "./SearchBar";
import { FilterChips, applyFilters, DEFAULT_FILTERS, type Filters } from "./FilterChips";
import { RestaurantCard } from "./RestaurantCard";

interface DiscoverViewProps {
  restaurants: Restaurant[];
  lastUpdated: string;
}

const PAGE_SIZE = 24;

function recomputeMatchScore(r: Restaurant, prefs: UserPreferences): number {
  let score = 0;
  const cuisineLower = r.cuisines.map(c => c.toLowerCase());

  // Cuisine match (+30)
  if (prefs.selectedCuisines.length > 0) {
    if (prefs.selectedCuisines.some(pc => cuisineLower.some(c => c.toLowerCase().includes(pc.toLowerCase())))) {
      score += 30;
    }
  } else {
    score += 15; // no preference = partial credit
  }

  // Vibe match (+20)
  if (prefs.selectedVibes.length > 0) {
    const matched = prefs.selectedVibes.filter(v => r.vibe_tags.includes(v) || r.tags.good_for.some(g => g.toLowerCase().includes(v.toLowerCase())));
    score += Math.min(20, matched.length * 10);
  } else {
    score += 10;
  }

  // Budget match (+25)
  if (prefs.budgetRange) {
    const nums = r.mains_price_range?.match(/\d+/g);
    if (nums) {
      const mid = nums.reduce((a, b) => a + parseInt(b), 0) / nums.length;
      const effective = mid / 2;
      if (effective <= prefs.budgetRange[1]) score += 25;
      else if (effective <= prefs.budgetRange[1] * 1.3) score += 15;
    } else {
      score += 12;
    }
  } else {
    score += 12;
  }

  // Availability (+15)
  if (r.slots.length > 0) score += 15;

  // Dietary (+10)
  if (prefs.selectedDietary.length > 0) {
    if (prefs.selectedDietary.some(d => r.tags.dietary.some(dt => dt.toLowerCase().includes(d.toLowerCase())))) {
      score += 10;
    }
  } else {
    score += 10;
  }

  return Math.max(0, Math.min(100, score));
}

export function DiscoverView({ restaurants, lastUpdated }: DiscoverViewProps) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [userPrefs, setUserPrefs] = useState<UserPreferences | null>(null);

  useEffect(() => {
    const prefs = getPreferences();
    // Only use if user has actually set preferences
    if (prefs.selectedCuisines.length > 0 || prefs.selectedVibes.length > 0 || prefs.budgetRange || prefs.selectedDietary.length > 0) {
      setUserPrefs(prefs);
    }
  }, []);

  // Recompute match scores if user has preferences
  const scoredRestaurants = useMemo(() => {
    if (!userPrefs) return restaurants;
    return restaurants.map(r => ({
      ...r,
      match_score: recomputeMatchScore(r, userPrefs),
    }));
  }, [restaurants, userPrefs]);

  const results = useMemo(() => {
    // Apply filters first (including availableOnly) so search only sees relevant restaurants
    let result = applyFilters(scoredRestaurants, filters);

    // Then search within filtered set
    if (query.trim()) {
      result = searchRestaurants(query, result);
    }

    return result;
  }, [scoredRestaurants, query, filters]);

  const visible = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  // Stats
  const availableCount = scoredRestaurants.filter((r) => r.slots.length > 0).length;
  const updatedDate = new Date(lastUpdated);
  const timeAgo = getTimeAgo(updatedDate);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-tight">Discover</h1>
          <span className="text-[10px] text-[var(--color-text-dim)]">
            {scoredRestaurants.length} restaurants · {availableCount} available · updated {timeAgo}
          </span>
        </div>
      </div>

      {/* Search */}
      <SearchBar
        value={query}
        onChange={(v) => { setQuery(v); setVisibleCount(PAGE_SIZE); }}
        resultCount={results.length}
        totalCount={scoredRestaurants.length}
      />

      {/* Filters */}
      <FilterChips
        restaurants={scoredRestaurants}
        filters={filters}
        onChange={(f) => { setFilters(f); setVisibleCount(PAGE_SIZE); }}
      />

      {/* Results grid */}
      {results.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visible.map((r) => (
              <RestaurantCard key={r.id} restaurant={r} />
            ))}
          </div>

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="text-sm px-6 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-light)] transition-colors"
              >
                Show more ({results.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <span className="text-4xl">🍽️</span>
          <p className="text-sm text-[var(--color-text-muted)]">
            No restaurants match your criteria
          </p>
          <button
            onClick={() => { setQuery(""); setFilters(DEFAULT_FILTERS); }}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            Clear all filters
          </button>
        </div>
      )}
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
