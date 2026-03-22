"use client";

import { useState } from "react";
import type { Restaurant } from "@/lib/types";

export interface Filters {
  cuisine: string | null;
  city: string | null;
  priceTag: string | null;
  vibe: string | null;
  availableOnly: boolean;
  sortBy: "match" | "rating" | "value" | "name";
}

export const DEFAULT_FILTERS: Filters = {
  cuisine: null,
  city: null,
  priceTag: null,
  vibe: null,
  availableOnly: true,
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
  const cuisines = countValues(restaurants, (r) => r.cuisines);
  const cities = countValues(restaurants, (r) => [r.city]);
  const vibes = countValues(restaurants, (r) => r.vibe_tags);
  const prices = countValues(restaurants, (r) => r.price_tag ? [r.price_tag] : []);

  const set = (partial: Partial<Filters>) => onChange({ ...filters, ...partial });

  const hasActiveFilters =
    filters.cuisine || filters.city || filters.priceTag || filters.vibe || !filters.availableOnly;

  return (
    <div className="flex flex-col gap-3">
      {/* Sort + toggles row */}
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

        <button
          onClick={() => set({ availableOnly: !filters.availableOnly })}
          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
            filters.availableOnly
              ? "border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]"
              : "border-[var(--color-border)] text-[var(--color-text-dim)]"
          }`}
        >
          {filters.availableOnly ? "Available only" : "Show all"}
        </button>

        {hasActiveFilters && (
          <button
            onClick={() => onChange(DEFAULT_FILTERS)}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

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
