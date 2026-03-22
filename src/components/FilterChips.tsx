"use client";

import { useState } from "react";
import type { Restaurant } from "@/lib/types";

export interface Filters {
  cuisine: string | null;
  city: string | null;
  priceTag: string | null;
  vibe: string | null;
  dietary: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  partySize: number;
  availableOnly: boolean;
  sortBy: "match" | "rating" | "value" | "name";
}

export const DEFAULT_FILTERS: Filters = {
  cuisine: null,
  city: null,
  priceTag: null,
  vibe: null,
  dietary: null,
  dateFrom: null,
  dateTo: null,
  partySize: 2,
  availableOnly: false,
  sortBy: "match",
};

interface FilterChipsProps {
  restaurants: Restaurant[];
  filters: Filters;
  onChange: (filters: Filters) => void;
}

function ChipGroup({
  label,
  options,
  selected,
  onSelect,
}: {
  label: string;
  options: { value: string; count: number }[];
  selected: string | null;
  onSelect: (value: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? options : options.slice(0, 8);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-dim)] mr-1">
        {label}
      </span>
      {visible.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(selected === opt.value ? null : opt.value)}
          className={`
            text-xs px-2.5 py-1 rounded-full border transition-all duration-150
            ${
              selected === opt.value
                ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-light)] hover:text-[var(--color-text)]"
            }
          `}
        >
          {opt.value}
          <span className="ml-1 text-[10px] opacity-50">{opt.count}</span>
        </button>
      ))}
      {options.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-[var(--color-accent)] hover:underline"
        >
          {expanded ? "Less" : `+${options.length - 8} more`}
        </button>
      )}
    </div>
  );
}

function countValues(restaurants: Restaurant[], getter: (r: Restaurant) => string[]): { value: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const r of restaurants) {
    for (const v of getter(r)) {
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

export function FilterChips({ restaurants, filters, onChange }: FilterChipsProps) {
  const [showDietary, setShowDietary] = useState(false);

  const cuisines = countValues(restaurants, (r) => r.cuisines);
  const cities = countValues(restaurants, (r) => [r.city]);
  const vibes = countValues(restaurants, (r) => r.vibe_tags);
  const prices = countValues(restaurants, (r) => r.price_tag ? [r.price_tag] : []);
  const dietary = countValues(restaurants, (r) => r.tags.dietary);

  const set = (partial: Partial<Filters>) => onChange({ ...filters, ...partial });

  const hasActiveFilters =
    filters.cuisine || filters.city || filters.priceTag || filters.vibe ||
    filters.dietary || filters.dateFrom || filters.dateTo || filters.availableOnly;

  return (
    <div className="flex flex-col gap-3">
      {/* Controls row: sort, date range, party size, available toggle */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filters.sortBy}
          onChange={(e) => set({ sortBy: e.target.value as Filters["sortBy"] })}
          className="text-xs px-2.5 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-muted)] outline-none cursor-pointer"
        >
          <option value="match">Sort: Best match</option>
          <option value="rating">Sort: Highest rated</option>
          <option value="value">Sort: Best value</option>
          <option value="name">Sort: A-Z</option>
        </select>

        {/* Date range */}
        <div className="flex items-center gap-1">
          <input
            type="date"
            value={filters.dateFrom || ""}
            onChange={(e) => set({ dateFrom: e.target.value || null })}
            className="text-xs px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-muted)] outline-none cursor-pointer w-[120px]"
            placeholder="From"
          />
          <span className="text-[10px] text-[var(--color-text-dim)]">to</span>
          <input
            type="date"
            value={filters.dateTo || ""}
            onChange={(e) => set({ dateTo: e.target.value || null })}
            className="text-xs px-2 py-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] text-[var(--color-text-muted)] outline-none cursor-pointer w-[120px]"
            placeholder="To"
          />
          {(filters.dateFrom || filters.dateTo) && (
            <button
              onClick={() => set({ dateFrom: null, dateTo: null })}
              className="text-[10px] text-[var(--color-accent)] hover:underline"
            >
              Clear
            </button>
          )}
        </div>

        {/* Party size */}
        <div className="flex items-center gap-0.5 border border-[var(--color-border)] rounded-lg overflow-hidden">
          {[2, 3, 4].map((size) => (
            <button
              key={size}
              onClick={() => set({ partySize: size })}
              className={`text-xs px-2.5 py-1.5 transition-all ${
                filters.partySize === size
                  ? "bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                  : "text-[var(--color-text-dim)] hover:text-[var(--color-text)]"
              }`}
            >
              {size}p
            </button>
          ))}
        </div>

        {/* Available only toggle */}
        <button
          onClick={() => set({ availableOnly: !filters.availableOnly })}
          className={`text-xs px-2.5 py-1.5 rounded-full border transition-all ${
            filters.availableOnly
              ? "border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]"
              : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-[var(--color-border-light)]"
          }`}
        >
          Available only
        </button>

        {/* Dietary toggle */}
        <button
          onClick={() => setShowDietary(!showDietary)}
          className={`text-xs px-2.5 py-1.5 rounded-full border transition-all ${
            filters.dietary
              ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
              : showDietary
              ? "border-[var(--color-border-light)] text-[var(--color-text)]"
              : "border-[var(--color-border)] text-[var(--color-text-dim)] hover:border-[var(--color-border-light)]"
          }`}
        >
          Dietary{filters.dietary ? `: ${filters.dietary}` : ""}
          <span className="ml-1 text-[10px]">{showDietary ? "▲" : "▼"}</span>
        </button>

        {hasActiveFilters && (
          <button
            onClick={() => { onChange(DEFAULT_FILTERS); setShowDietary(false); }}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            Clear all
          </button>
        )}
      </div>

      {/* Dietary chips (expandable) */}
      {showDietary && (
        <ChipGroup label="Dietary" options={dietary} selected={filters.dietary} onSelect={(v) => set({ dietary: v })} />
      )}

      {/* Filter chips */}
      {cities.length > 1 && (
        <ChipGroup label="City" options={cities} selected={filters.city} onSelect={(v) => set({ city: v })} />
      )}
      <ChipGroup label="Cuisine" options={cuisines} selected={filters.cuisine} onSelect={(v) => set({ cuisine: v })} />
      <ChipGroup label="Price" options={prices} selected={filters.priceTag} onSelect={(v) => set({ priceTag: v })} />
      <ChipGroup label="Vibe" options={vibes} selected={filters.vibe} onSelect={(v) => set({ vibe: v })} />
    </div>
  );
}

export function applyFilters(restaurants: Restaurant[], filters: Filters): Restaurant[] {
  let result = restaurants;

  if (filters.availableOnly) {
    result = result.filter((r) => r.slots.length > 0);
  }
  if (filters.cuisine) {
    result = result.filter((r) => r.cuisines.some((c) => c === filters.cuisine));
  }
  if (filters.city) {
    result = result.filter((r) => r.city === filters.city);
  }
  if (filters.priceTag) {
    result = result.filter((r) => r.price_tag === filters.priceTag);
  }
  if (filters.vibe) {
    result = result.filter((r) => r.vibe_tags.includes(filters.vibe!));
  }
  if (filters.dietary) {
    result = result.filter((r) => r.tags.dietary.some((d) => d === filters.dietary));
  }
  // Date range filter
  if (filters.dateFrom || filters.dateTo) {
    result = result.filter((r) => {
      return r.slots.some((s) => {
        if (filters.dateFrom && s.date < filters.dateFrom) return false;
        if (filters.dateTo && s.date > filters.dateTo) return false;
        return true;
      });
    });
  }

  // Sort
  switch (filters.sortBy) {
    case "match":
      result = [...result].sort((a, b) => (b.match_score ?? 0) - (a.match_score ?? 0));
      break;
    case "rating":
      result = [...result].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case "value":
      result = [...result].sort((a, b) => (b.value_score ?? 0) - (a.value_score ?? 0));
      break;
    case "name":
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
      break;
  }

  return result;
}
