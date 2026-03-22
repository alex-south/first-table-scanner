"use client";

import { useState, useEffect, useMemo } from "react";
import type { Restaurant, HistoryEntry } from "@/lib/types";
import { getHistory, saveHistory } from "@/lib/storage";

interface HistoryViewProps {
  restaurants: Restaurant[];
}

function StarInput({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className={`text-lg transition-colors ${
            value && star <= value ? "text-[var(--color-gold)]" : "text-[var(--color-text-dim)]"
          } hover:text-[var(--color-gold)]`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function HistoryView({ restaurants }: HistoryViewProps) {
  const [mounted, setMounted] = useState(false);
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form state
  const [formSearch, setFormSearch] = useState("");
  const [formRestaurantId, setFormRestaurantId] = useState<number | null>(null);
  const [formRestaurantName, setFormRestaurantName] = useState("");
  const [formDate, setFormDate] = useState(new Date().toISOString().split("T")[0]);
  const [formRating, setFormRating] = useState<number | null>(null);
  const [formNotes, setFormNotes] = useState("");
  const [formSpent, setFormSpent] = useState("");

  useEffect(() => {
    setEntries(getHistory());
    setMounted(true);
  }, []);

  const update = (newEntries: HistoryEntry[]) => {
    setEntries(newEntries);
    saveHistory(newEntries);
  };

  // Stats
  const stats = useMemo(() => {
    const totalSpent = entries.reduce((s, e) => s + (e.amountSpent || 0), 0);
    const totalSaved = entries.reduce((s, e) => {
      const r = restaurants.find((x) => x.id === e.restaurantId);
      if (!r?.mains_price_range) return s;
      const nums = r.mains_price_range.match(/\d+/g);
      if (!nums) return s;
      const mid = nums.reduce((a, b) => a + parseInt(b), 0) / nums.length;
      return s + mid; // saved the other half
    }, 0);
    return {
      totalSpent: Math.round(totalSpent),
      totalSaved: Math.round(totalSaved),
      visitCount: entries.length,
      avgRating: entries.filter((e) => e.rating).length > 0
        ? (entries.reduce((s, e) => s + (e.rating || 0), 0) / entries.filter((e) => e.rating).length).toFixed(1)
        : null,
    };
  }, [entries, restaurants]);

  // Monthly breakdown
  const monthlyData = useMemo(() => {
    if (entries.length === 0) return [];
    const months: Record<string, number> = {};
    for (const e of entries) {
      const month = e.date.substring(0, 7);
      months[month] = (months[month] || 0) + (e.amountSpent || 0);
    }
    // Fill gaps between min and max month
    const sorted = Object.keys(months).sort();
    const start = sorted[0];
    const end = sorted[sorted.length - 1];
    const filled: [string, number][] = [];
    let [y, m] = start.split("-").map(Number);
    const [ey, em] = end.split("-").map(Number);
    while (y < ey || (y === ey && m <= em)) {
      const key = `${y}-${String(m).padStart(2, "0")}`;
      filled.push([key, months[key] || 0]);
      m++;
      if (m > 12) { m = 1; y++; }
    }
    return filled.slice(-6);
  }, [entries]);

  const maxMonthly = Math.max(...monthlyData.map(([, v]) => v), 1);

  // Search results for form
  const searchResults = useMemo(() => {
    if (!formSearch.trim()) return [];
    const q = formSearch.toLowerCase();
    return restaurants
      .filter((r) => r.name.toLowerCase().includes(q) || r.cuisines.some((c) => c.toLowerCase().includes(q)))
      .slice(0, 6);
  }, [restaurants, formSearch]);

  const resetForm = () => {
    setFormSearch("");
    setFormRestaurantId(null);
    setFormRestaurantName("");
    setFormDate(new Date().toISOString().split("T")[0]);
    setFormRating(null);
    setFormNotes("");
    setFormSpent("");
    setEditingIndex(null);
    setShowForm(false);
  };

  const handleSubmit = () => {
    if (!formRestaurantId) return;
    const entry: HistoryEntry = {
      restaurantId: formRestaurantId,
      date: formDate,
      rating: formRating,
      notes: formNotes,
      amountSpent: formSpent ? parseFloat(formSpent) : null,
    };

    if (editingIndex !== null) {
      const updated = [...entries];
      updated[editingIndex] = entry;
      update(updated);
    } else {
      update([entry, ...entries]);
    }
    resetForm();
  };

  const startEdit = (index: number) => {
    const e = entries[index];
    const r = restaurants.find((x) => x.id === e.restaurantId);
    setFormRestaurantId(e.restaurantId);
    setFormRestaurantName(r?.name || `Restaurant #${e.restaurantId}`);
    setFormDate(e.date);
    setFormRating(e.rating);
    setFormNotes(e.notes);
    setFormSpent(e.amountSpent?.toString() || "");
    setEditingIndex(index);
    setShowForm(true);
  };

  const deleteEntry = (index: number) => {
    update(entries.filter((_, i) => i !== index));
  };

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-xl font-bold tracking-tight">Dining History</h1>
        <p className="text-sm text-[var(--color-text-dim)]">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight">Dining History</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="text-sm px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          + Add visit
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Visits", value: stats.visitCount.toString() },
          { label: "Total spent", value: `$${stats.totalSpent}` },
          { label: "Est. saved", value: `$${stats.totalSaved}` },
          { label: "Avg rating", value: stats.avgRating ? `${stats.avgRating}★` : "—" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4"
          >
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-1">
              {stat.label}
            </p>
            <p className="text-lg font-bold text-[var(--color-text)]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly bar chart */}
      {monthlyData.length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-3">Monthly spending</p>
          <div className="flex items-end gap-2 h-24">
            {monthlyData.map(([month, amount]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-[var(--color-accent)] transition-all"
                  style={{ height: `${(amount / maxMonthly) * 100}%`, minHeight: amount > 0 ? 4 : 0 }}
                />
                <span className="text-[9px] text-[var(--color-text-dim)]">
                  {new Date(month + "-01").toLocaleDateString("en-NZ", { month: "short" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-bg-card)] p-4">
          <h3 className="text-sm font-semibold mb-3">
            {editingIndex !== null ? "Edit visit" : "Add a visit"}
          </h3>
          <div className="flex flex-col gap-3">
            {/* Restaurant search */}
            {!formRestaurantId ? (
              <div>
                <input
                  type="text"
                  value={formSearch}
                  onChange={(e) => setFormSearch(e.target.value)}
                  placeholder="Search for restaurant..."
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] outline-none focus:border-[var(--color-accent)]/40"
                  autoFocus
                />
                {searchResults.length > 0 && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    {searchResults.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => {
                          setFormRestaurantId(r.id);
                          setFormRestaurantName(r.name);
                          setFormSearch("");
                        }}
                        className="text-left px-3 py-1.5 rounded-lg text-sm hover:bg-[var(--color-bg-hover)] transition-colors"
                      >
                        <span className="text-[var(--color-text)]">{r.name}</span>
                        <span className="text-[var(--color-text-dim)] ml-2 text-xs">{r.cuisines[0]} · {r.suburb}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--color-text)]">{formRestaurantName}</span>
                <button
                  onClick={() => { setFormRestaurantId(null); setFormRestaurantName(""); }}
                  className="text-xs text-[var(--color-accent)] hover:underline"
                >
                  Change
                </button>
              </div>
            )}

            {/* Date + Rating */}
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] block mb-1">Date</label>
                <input
                  type="date"
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] text-sm text-[var(--color-text)] outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] block mb-1">Rating</label>
                <StarInput value={formRating} onChange={setFormRating} />
              </div>
            </div>

            {/* Amount spent */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] block mb-1">Amount spent ($)</label>
              <input
                type="number"
                value={formSpent}
                onChange={(e) => setFormSpent(e.target.value)}
                placeholder="What you actually paid after discount"
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] outline-none"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] block mb-1">Notes</label>
              <textarea
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="How was it?"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-input)] text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-dim)] outline-none resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleSubmit}
                disabled={!formRestaurantId}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {editingIndex !== null ? "Save changes" : "Add visit"}
              </button>
              <button
                onClick={resetForm}
                className="px-4 py-2 rounded-lg text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry list */}
      {entries.length > 0 ? (
        <div className="flex flex-col gap-2">
          {entries.map((entry, i) => {
            const r = restaurants.find((x) => x.id === entry.restaurantId);
            return (
              <div
                key={`${entry.restaurantId}-${entry.date}-${i}`}
                className="group flex items-center gap-4 px-4 py-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] hover:border-[var(--color-border-light)] transition-colors"
              >
                {r?.image && (
                  <img src={r.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">
                      {r?.name || `Restaurant #${entry.restaurantId}`}
                    </p>
                    {entry.rating && (
                      <span className="text-xs text-[var(--color-gold)]">
                        {"★".repeat(entry.rating)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {new Date(entry.date + "T00:00:00").toLocaleDateString("en-NZ", {
                      weekday: "short", day: "numeric", month: "short", year: "numeric"
                    })}
                    {entry.amountSpent != null && ` · $${entry.amountSpent}`}
                  </p>
                  {entry.notes && (
                    <p className="text-xs text-[var(--color-text-dim)] mt-0.5 line-clamp-1">{entry.notes}</p>
                  )}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(i)}
                    className="p-1.5 rounded-md text-[var(--color-text-dim)] hover:text-[var(--color-accent)] hover:bg-[var(--color-bg-hover)]"
                    title="Edit"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => deleteEntry(i)}
                    className="p-1.5 rounded-md text-[var(--color-text-dim)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-hover)]"
                    title="Delete"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : !showForm ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <span className="text-4xl">📝</span>
          <p className="text-sm text-[var(--color-text-muted)]">No visits recorded yet</p>
          <button
            onClick={() => { resetForm(); setShowForm(true); }}
            className="text-xs text-[var(--color-accent)] hover:underline"
          >
            Add your first visit
          </button>
        </div>
      ) : null}
    </div>
  );
}
