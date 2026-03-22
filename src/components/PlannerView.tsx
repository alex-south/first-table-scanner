"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Restaurant } from "@/lib/types";
import { getPlanner, savePlanner, getPreferences } from "@/lib/storage";

// --- Date helpers ---

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-NZ", { weekday: "short", day: "numeric", month: "short" });
}

function isToday(date: Date): boolean {
  const now = new Date();
  return formatDate(date) === formatDate(now);
}

function isPast(date: Date): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return date < now;
}

// --- Savings estimate ---

function parseMidPrice(range: string | null): number | null {
  if (!range) return null;
  const nums = range.match(/\d+/g);
  if (!nums || nums.length === 0) return null;
  return nums.reduce((a, b) => a + parseInt(b), 0) / nums.length;
}

function estimateSavings(restaurants: Restaurant[], pinnedIds: number[], partySize: number): number {
  let total = 0;
  for (const id of pinnedIds) {
    const r = restaurants.find((x) => x.id === id);
    if (!r) continue;
    const mid = parseMidPrice(r.mains_price_range);
    if (mid) total += (mid / 2) * partySize; // 50% off per person
  }
  return Math.round(total);
}

// --- Components ---

interface PlannerViewProps {
  restaurants: Restaurant[];
}

export function PlannerView({ restaurants }: PlannerViewProps) {
  const [mounted, setMounted] = useState(false);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [planner, setPlanner] = useState<Record<string, number[]>>({});
  const [addingDay, setAddingDay] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [partySize, setPartySize] = useState(2);

  // Load planner from localStorage
  useEffect(() => {
    setPlanner(getPlanner());
    setPartySize(getPreferences().partySize);
    setMounted(true);
  }, []);

  // Save planner changes
  const updatePlanner = useCallback((newPlanner: Record<string, number[]>) => {
    setPlanner(newPlanner);
    savePlanner(newPlanner);
  }, []);

  // Week days
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [weekStart]);

  // Count available restaurants per day
  const availableByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const day of weekDays) {
      const dateStr = formatDate(day);
      map[dateStr] = restaurants.filter((r) =>
        r.slots.some((s) => s.date === dateStr)
      ).length;
    }
    return map;
  }, [restaurants, weekDays]);

  // Weekly summary
  const weekPinnedIds = useMemo(() => {
    const ids: number[] = [];
    for (const day of weekDays) {
      const dateStr = formatDate(day);
      ids.push(...(planner[dateStr] || []));
    }
    return ids;
  }, [weekDays, planner]);

  const weekSavings = estimateSavings(restaurants, weekPinnedIds, partySize);

  // Pin/unpin
  const pinRestaurant = (date: string, restaurantId: number) => {
    if (!restaurants.find((r) => r.id === restaurantId)) return;
    const current = planner[date] || [];
    if (current.includes(restaurantId)) return;
    updatePlanner({ ...planner, [date]: [...current, restaurantId] });
    setAddingDay(null);
    setSearchQuery("");
  };

  const unpinRestaurant = (date: string, restaurantId: number) => {
    const current = planner[date] || [];
    updatePlanner({
      ...planner,
      [date]: current.filter((id) => id !== restaurantId),
    });
  };

  // Search for add modal
  const searchResults = useMemo(() => {
    if (!addingDay || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    const dateStr = addingDay;
    return restaurants
      .filter((r) => r.slots.some((s) => s.date === dateStr))
      .filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.cuisines.some((c) => c.toLowerCase().includes(q)) ||
          r.suburb.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [restaurants, addingDay, searchQuery]);

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-bold tracking-tight">Weekly Planner</h1>
        <p className="text-sm text-[var(--color-text-dim)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight">Weekly Planner</h1>
        <span className="text-xs text-[var(--color-text-dim)]">
          {weekPinnedIds.length} planned
          {weekSavings > 0 && ` · est. savings: $${weekSavings}`}
        </span>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-light)] transition-colors"
        >
          ← Prev
        </button>
        <button
          onClick={() => setWeekStart(startOfWeek(new Date()))}
          className="text-xs text-[var(--color-accent)] hover:underline"
        >
          This week
        </button>
        <button
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-light)] transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Day columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
        {weekDays.map((day) => {
          const dateStr = formatDate(day);
          const pinnedIds = planner[dateStr] || [];
          const pinnedRestaurants = pinnedIds
            .map((id) => restaurants.find((r) => r.id === id))
            .filter(Boolean) as Restaurant[];
          const availCount = availableByDay[dateStr] || 0;
          const past = isPast(day);
          const today = isToday(day);

          return (
            <div
              key={dateStr}
              className={`
                flex flex-col rounded-xl border p-3 min-h-[140px] transition-colors
                ${today
                  ? "border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)]"
                  : past
                  ? "border-[var(--color-border)]/50 bg-[var(--color-bg)]/50 opacity-60"
                  : "border-[var(--color-border)] bg-[var(--color-bg-card)]"
                }
              `}
            >
              {/* Day header */}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-xs font-semibold ${today ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"}`}>
                  {formatShortDate(day)}
                </span>
                {availCount > 0 && (
                  <span className="text-[10px] text-[var(--color-text-dim)]">
                    {availCount} avail
                  </span>
                )}
              </div>

              {/* Pinned restaurants */}
              <div className="flex flex-col gap-1.5 flex-1">
                {pinnedRestaurants.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-[var(--color-bg-hover)] group"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-[var(--color-text)] truncate">
                        {r.name}
                      </p>
                      <p className="text-[10px] text-[var(--color-text-dim)] truncate">
                        {r.cuisines[0] || ""} · {r.suburb}
                      </p>
                    </div>
                    <button
                      onClick={() => unpinRestaurant(dateStr, r.id)}
                      className="shrink-0 p-0.5 rounded text-[var(--color-text-dim)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-danger)] transition-all"
                      title="Remove"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                {pinnedRestaurants.length === 0 && !past && (
                  <p className="text-[10px] text-[var(--color-text-dim)] italic">No plans yet</p>
                )}
              </div>

              {/* Add button */}
              {!past && (
                <button
                  onClick={() => { setAddingDay(dateStr); setSearchQuery(""); }}
                  className="mt-2 text-[10px] text-[var(--color-accent)] hover:underline self-start"
                >
                  + Add restaurant
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add restaurant modal */}
      {addingDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-semibold">
                Add to {new Date(addingDay + "T00:00:00").toLocaleDateString("en-NZ", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h2>
              <button
                onClick={() => setAddingDay(null)}
                className="p-1 rounded-md text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-hover)]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            <div className="p-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search restaurants available this day..."
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] outline-none focus:border-[var(--color-accent)]/40"
                autoFocus
              />

              {searchQuery.trim() && (
                <div className="mt-3 flex flex-col gap-1 max-h-60 overflow-y-auto">
                  {searchResults.length > 0 ? (
                    searchResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => pinRestaurant(addingDay, r.id)}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-[var(--color-bg-hover)] transition-colors"
                      >
                        {r.image && (
                          <img
                            src={r.image}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-[var(--color-text)] truncate">
                            {r.name}
                          </p>
                          <p className="text-xs text-[var(--color-text-muted)]">
                            {r.cuisines.join(", ")} · {r.suburb}
                            {r.rating && ` · ${r.rating}★`}
                          </p>
                        </div>
                        <span className="text-xs text-[var(--color-accent)]">+ Pin</span>
                      </button>
                    ))
                  ) : (
                    <p className="text-xs text-[var(--color-text-dim)] py-2 text-center">
                      No available restaurants match &quot;{searchQuery}&quot;
                    </p>
                  )}
                </div>
              )}

              {!searchQuery.trim() && (
                <p className="mt-3 text-xs text-[var(--color-text-dim)]">
                  {availableByDay[addingDay] || 0} restaurants available on this date.
                  Type to search.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
