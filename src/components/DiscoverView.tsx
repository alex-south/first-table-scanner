"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { Restaurant } from "@/lib/types";
import { FilterChips, applyFilters, DEFAULT_FILTERS, type Filters } from "./FilterChips";
import { RestaurantCard } from "./RestaurantCard";

const MapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <span className="text-sm text-[var(--color-text-dim)]">Loading map...</span>
    </div>
  ),
});

interface DiscoverViewProps {
  restaurants: Restaurant[];
  lastUpdated: string;
}

type ViewMode = "list" | "map" | "split";

const PAGE_SIZE = 24;

export function DiscoverView({ restaurants, lastUpdated }: DiscoverViewProps) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  const results = useMemo(() => {
    return applyFilters(restaurants, filters);
  }, [restaurants, filters]);

  const visible = results.slice(0, visibleCount);
  const hasMore = visibleCount < results.length;

  const availableCount = restaurants.filter((r) => r.slots.length > 0).length;
  const updatedDate = new Date(lastUpdated);
  const timeAgo = getTimeAgo(updatedDate);

  const showMap = viewMode === "map" || viewMode === "split";
  const showList = viewMode === "list" || viewMode === "split";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl font-bold tracking-tight">Discover</h1>
          <span className="text-[10px] text-[var(--color-text-dim)]">
            {results.length} of {restaurants.length} · updated {timeAgo}
          </span>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 border border-[var(--color-border)] rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 transition-all ${viewMode === "list" ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]" : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"}`}
            title="List view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={`hidden lg:block p-1.5 transition-all ${viewMode === "split" ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]" : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"}`}
            title="Split view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="10" height="18" /><rect x="15" y="3" width="6" height="18" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("map")}
            className={`p-1.5 transition-all ${viewMode === "map" ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]" : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"}`}
            title="Map view"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
          </button>
        </div>
      </div>

      {/* Filters */}
      <FilterChips
        restaurants={restaurants}
        filters={filters}
        onChange={(f) => { setFilters(f); setVisibleCount(PAGE_SIZE); }}
      />

      {/* Content area */}
      {viewMode === "split" ? (
        /* Split view: map left, list right */
        <div className="flex gap-4" style={{ height: "calc(100vh - 220px)" }}>
          <div className="w-3/5 shrink-0">
            <MapView restaurants={results} />
          </div>
          <div className="w-2/5 overflow-y-auto flex flex-col gap-3 pr-1">
            {results.length > 0 ? (
              results.slice(0, 50).map((r) => (
                <CompactCard key={r.id} restaurant={r} />
              ))
            ) : (
              <EmptyState onClear={() => setFilters(DEFAULT_FILTERS)} />
            )}
          </div>
        </div>
      ) : viewMode === "map" ? (
        /* Full map */
        <div style={{ height: "calc(100vh - 220px)" }} className="rounded-xl overflow-hidden">
          <MapView restaurants={results} />
        </div>
      ) : (
        /* List view (default) */
        <>
          {results.length > 0 ? (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visible.map((r) => (
                  <RestaurantCard key={r.id} restaurant={r} />
                ))}
              </div>
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
            <EmptyState onClear={() => setFilters(DEFAULT_FILTERS)} />
          )}
        </>
      )}
    </div>
  );
}

/* Compact card for split view sidebar */
function CompactCard({ restaurant: r }: { restaurant: Restaurant }) {
  return (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-3 p-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-light)] transition-colors"
    >
      {r.image && (
        <img src={r.image} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[var(--color-text)] truncate">{r.name}</p>
        <p className="text-[10px] text-[var(--color-text-muted)] truncate">
          {r.cuisines.join(", ")} · {r.suburb}
          {r.price_tag && ` · ${r.price_tag}`}
        </p>
        {r.rating && (
          <p className="text-[10px] text-[var(--color-text-dim)]">
            <span className="text-[var(--color-gold)]">★</span> {r.rating}
            <span className="ml-1">({r.review_count})</span>
          </p>
        )}
        {r.slots.length > 0 && (
          <p className="text-[9px] text-[var(--color-success)]">
            {r.slots.length} day{r.slots.length > 1 ? "s" : ""} · {r.booking_fee}
          </p>
        )}
      </div>
    </a>
  );
}

function EmptyState({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-2">
      <span className="text-4xl">🍽️</span>
      <p className="text-sm text-[var(--color-text-muted)]">No restaurants match your criteria</p>
      <button onClick={onClear} className="text-xs text-[var(--color-accent)] hover:underline">
        Clear all filters
      </button>
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
