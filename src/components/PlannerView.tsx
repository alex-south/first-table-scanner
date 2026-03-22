"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { Restaurant } from "@/lib/types";
import { getPlanner, savePlanner, getPreferences } from "@/lib/storage";

// --- Date helpers ---

function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isToday(date: Date): boolean {
  return formatDate(date) === formatDate(new Date());
}

function isPast(date: Date): boolean {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d < now;
}

function getMonthDays(year: number, month: number): Date[] {
  // Returns all day cells for a month grid (includes padding from prev/next month)
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Start from Monday before or on the 1st
  let startOffset = firstDay.getDay() - 1; // Mon=0
  if (startOffset < 0) startOffset = 6; // Sunday

  const days: Date[] = [];
  const start = new Date(year, month, 1 - startOffset);

  // Always show 6 weeks (42 cells) for consistent grid
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  return days;
}

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
    if (mid) total += (mid / 2) * partySize;
  }
  return Math.round(total);
}

// --- Component ---

interface PlannerViewProps {
  restaurants: Restaurant[];
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function PlannerView({ restaurants }: PlannerViewProps) {
  const [mounted, setMounted] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const [planner, setPlanner] = useState<Record<string, number[]>>({});
  const [addingDay, setAddingDay] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [partySize, setPartySize] = useState(2);

  useEffect(() => {
    setPlanner(getPlanner());
    setPartySize(getPreferences().partySize);
    setMounted(true);
  }, []);

  const updatePlanner = useCallback((newPlanner: Record<string, number[]>) => {
    setPlanner(newPlanner);
    savePlanner(newPlanner);
  }, []);

  // Month grid
  const monthDays = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);

  // Available counts for the month
  const availableByDay = useMemo(() => {
    const map: Record<string, number> = {};
    for (const day of monthDays) {
      const dateStr = formatDate(day);
      map[dateStr] = restaurants.filter((r) =>
        r.slots.some((s) => s.date === dateStr)
      ).length;
    }
    return map;
  }, [restaurants, monthDays]);

  // Month summary
  const monthPinnedIds = useMemo(() => {
    const ids: number[] = [];
    for (const day of monthDays) {
      if (day.getMonth() !== viewMonth) continue;
      const dateStr = formatDate(day);
      ids.push(...(planner[dateStr] || []));
    }
    return ids;
  }, [monthDays, viewMonth, planner]);

  const monthSavings = estimateSavings(restaurants, monthPinnedIds, partySize);

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

  const searchResults = useMemo(() => {
    if (!addingDay || !searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return restaurants
      .filter((r) => r.slots.some((s) => s.date === addingDay))
      .filter((r) =>
        r.name.toLowerCase().includes(q) ||
        r.cuisines.some((c) => c.toLowerCase().includes(q)) ||
        r.suburb.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [restaurants, addingDay, searchQuery]);

  // Navigation
  const prevMonth = () => {
    if (viewMonth === 0) { setViewYear(viewYear - 1); setViewMonth(11); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewYear(viewYear + 1); setViewMonth(0); }
    else setViewMonth(viewMonth + 1);
  };
  const goToday = () => {
    const now = new Date();
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  const monthLabel = new Date(viewYear, viewMonth).toLocaleDateString("en-NZ", {
    month: "long",
    year: "numeric",
  });

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-bold tracking-tight">Planner</h1>
        <p className="text-sm text-[var(--color-text-dim)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight">Planner</h1>
        <span className="text-xs text-[var(--color-text-dim)]">
          {monthPinnedIds.length} planned
          {monthSavings > 0 && ` · est. savings: $${monthSavings}`}
        </span>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-light)] transition-colors"
        >
          ←
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-[var(--color-text)]">{monthLabel}</span>
          <button
            onClick={goToday}
            className="text-[10px] text-[var(--color-accent)] hover:underline"
          >
            Today
          </button>
        </div>
        <button
          onClick={nextMonth}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-border-light)] transition-colors"
        >
          →
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden">
        {/* Weekday header */}
        <div className="grid grid-cols-7 border-b border-[var(--color-border)]">
          {WEEKDAYS.map((d) => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-dim)]">
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7">
          {monthDays.map((day, i) => {
            const dateStr = formatDate(day);
            const isCurrentMonth = day.getMonth() === viewMonth;
            const today = isToday(day);
            const past = isPast(day);
            const pinnedIds = planner[dateStr] || [];
            const pinnedRestaurants = pinnedIds
              .map((id) => restaurants.find((r) => r.id === id))
              .filter(Boolean) as Restaurant[];
            const availCount = availableByDay[dateStr] || 0;

            return (
              <div
                key={dateStr + i}
                className={`
                  relative min-h-[80px] sm:min-h-[100px] border-b border-r border-[var(--color-border)]/30 p-1.5 transition-colors
                  ${!isCurrentMonth ? "opacity-30" : ""}
                  ${past && isCurrentMonth ? "opacity-50" : ""}
                  ${today ? "bg-[var(--color-accent-muted)]" : ""}
                `}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium ${today ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"}`}>
                    {day.getDate()}
                  </span>
                  {availCount > 0 && isCurrentMonth && (
                    <span className="text-[8px] text-[var(--color-text-dim)]">{availCount}</span>
                  )}
                </div>

                {/* Pinned restaurants (compact) */}
                {pinnedRestaurants.slice(0, 2).map((r) => (
                  <div
                    key={r.id}
                    className="group flex items-center gap-1 px-1 py-0.5 mb-0.5 rounded bg-[var(--color-bg-hover)] cursor-default"
                  >
                    <span className="text-[9px] text-[var(--color-text)] truncate flex-1">{r.name}</span>
                    <button
                      onClick={() => unpinRestaurant(dateStr, r.id)}
                      className="shrink-0 text-[var(--color-text-dim)] opacity-0 group-hover:opacity-100 hover:text-[var(--color-danger)] transition-all"
                    >
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {pinnedRestaurants.length > 2 && (
                  <span className="text-[8px] text-[var(--color-text-dim)]">+{pinnedRestaurants.length - 2} more</span>
                )}

                {/* Add button */}
                {!past && isCurrentMonth && (
                  <button
                    onClick={() => { setAddingDay(dateStr); setSearchQuery(""); }}
                    className="absolute bottom-1 right-1 w-4 h-4 flex items-center justify-center rounded-full text-[var(--color-text-dim)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] transition-all text-[10px]"
                    title="Add restaurant"
                  >
                    +
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Add restaurant modal */}
      {addingDay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
              <h2 className="text-sm font-semibold">
                Add to {new Date(addingDay + "T00:00:00").toLocaleDateString("en-NZ", {
                  weekday: "long", day: "numeric", month: "long",
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
                  {searchResults.length > 0 ? searchResults.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => pinRestaurant(addingDay, r.id)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-[var(--color-bg-hover)] transition-colors"
                    >
                      {r.image && <img src={r.image} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[var(--color-text)] truncate">{r.name}</p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          {r.cuisines.join(", ")} · {r.suburb}{r.rating && ` · ${r.rating}★`}
                        </p>
                      </div>
                      <span className="text-xs text-[var(--color-accent)]">+ Pin</span>
                    </button>
                  )) : (
                    <p className="text-xs text-[var(--color-text-dim)] py-2 text-center">
                      No available restaurants match &quot;{searchQuery}&quot;
                    </p>
                  )}
                </div>
              )}
              {!searchQuery.trim() && (
                <p className="mt-3 text-xs text-[var(--color-text-dim)]">
                  {availableByDay[addingDay] || 0} restaurants available on this date. Type to search.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
