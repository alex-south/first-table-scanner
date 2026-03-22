"use client";

import { useState, useMemo } from "react";
import type { Restaurant } from "@/lib/types";
import { FilterChips, applyFilters, DEFAULT_FILTERS, type Filters } from "./FilterChips";
import { RestaurantCard } from "./RestaurantCard";

interface DiscoverViewProps {
  restaurants: Restaurant[];
  lastUpdated: string;
}

const PAGE_SIZE = 24;

export function DiscoverView({ restaurants, lastUpdated }: DiscoverViewProps) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const results = useMemo(() => {
    return applyFilters(restaurants, filters);
  }, [restaurants, filters]);

  const visible = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  // Stats
  const availableCount = restaurants.filter((r) => r.slots.length > 0).length;
  const updatedDate = new Date(lastUpdated);
  const timeAgo = getTimeAgo(updatedDate);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <h1 className="text-xl font-bold tracking-tight">Discover</h1>
          <span className="text-[10px] text-[var(--color-text-dim)]">
            {restaurants.length} restaurants · {availableCount} available · updated {timeAgo}
          </span>
        </div>
      </div>

      {/* Filters */}
      <FilterChips
        restaurants={restaurants}
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
            onClick={() => setFilters(DEFAULT_FILTERS)}
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
