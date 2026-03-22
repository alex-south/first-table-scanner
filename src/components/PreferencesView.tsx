"use client";

import { useState, useEffect, useMemo } from "react";
import type { Restaurant, UserPreferences } from "@/lib/types";
import { getPreferences, savePreferences } from "@/lib/storage";

interface PreferencesViewProps {
  restaurants: Restaurant[];
}

function ToggleChipGroup({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className={`
                text-xs px-3 py-1.5 rounded-full border transition-all
                ${isSelected
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-light)]"
                }
              `}
            >
              {opt}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function PreferencesView({ restaurants }: PreferencesViewProps) {
  const [prefs, setPrefs] = useState<UserPreferences>({
    selectedCuisines: [],
    budgetRange: null,
    selectedVibes: [],
    selectedDietary: [],
    partySize: 2,
  });
  const [mounted, setMounted] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPrefs(getPreferences());
    setMounted(true);
  }, []);

  // Extract unique options from data
  const cuisineOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of restaurants) for (const c of r.cuisines) set.add(c);
    return Array.from(set).sort();
  }, [restaurants]);

  const vibeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of restaurants) for (const v of r.vibe_tags) set.add(v);
    return Array.from(set).sort();
  }, [restaurants]);

  const dietaryOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of restaurants) for (const d of r.tags.dietary) set.add(d);
    return Array.from(set).sort();
  }, [restaurants]);

  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of restaurants) set.add(r.city);
    return Array.from(set).sort();
  }, [restaurants]);

  const toggle = (field: "selectedCuisines" | "selectedVibes" | "selectedDietary", value: string) => {
    const current = prefs[field];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setPrefs({ ...prefs, [field]: updated });
    setSaved(false);
  };

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6 max-w-2xl">
        <h1 className="text-xl font-bold tracking-tight">Preferences</h1>
        <p className="text-sm text-[var(--color-text-dim)]">Loading...</p>
      </div>
    );
  }

  const handleSave = () => {
    savePreferences(prefs);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold tracking-tight">Preferences</h1>
        <p className="text-[10px] text-[var(--color-text-dim)]">
          Affects filter defaults on the Discover page
        </p>
      </div>

      {/* Party size */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">Party size</p>
        <div className="flex gap-2">
          {[2, 3, 4].map((size) => (
            <button
              key={size}
              onClick={() => { setPrefs({ ...prefs, partySize: size }); setSaved(false); }}
              className={`
                px-4 py-2 rounded-lg border text-sm font-medium transition-all
                ${prefs.partySize === size
                  ? "border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]"
                  : "border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-[var(--color-border-light)]"
                }
              `}
            >
              {size} people
            </button>
          ))}
        </div>
      </div>

      {/* Budget */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">
          Budget per person (after discount)
        </p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={prefs.budgetRange?.[1] || 50}
            onChange={(e) => {
              setPrefs({ ...prefs, budgetRange: [0, parseInt(e.target.value)] });
              setSaved(false);
            }}
            className="flex-1 accent-[var(--color-accent)]"
          />
          <span className="text-sm font-medium text-[var(--color-text)] w-16 text-right">
            ${prefs.budgetRange?.[1] || 50}/pp
          </span>
        </div>
      </div>

      {/* Cities */}
      {cityOptions.length > 1 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
          <p className="text-[10px] uppercase tracking-wider text-[var(--color-text-dim)] mb-2">Cities</p>
          <div className="flex flex-wrap gap-1.5">
            {cityOptions.map((city) => (
              <span
                key={city}
                className="text-xs px-3 py-1.5 rounded-full border border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]"
              >
                {city}
              </span>
            ))}
          </div>
          <p className="text-[10px] text-[var(--color-text-dim)] mt-2">
            City selection is managed in preferences.json via the /first-table skill
          </p>
        </div>
      )}

      {/* Cuisines */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <ToggleChipGroup
          label="Favourite cuisines"
          options={cuisineOptions}
          selected={prefs.selectedCuisines}
          onToggle={(v) => toggle("selectedCuisines", v)}
        />
      </div>

      {/* Vibes */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <ToggleChipGroup
          label="Preferred vibes"
          options={vibeOptions}
          selected={prefs.selectedVibes}
          onToggle={(v) => toggle("selectedVibes", v)}
        />
      </div>

      {/* Dietary */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
        <ToggleChipGroup
          label="Dietary requirements"
          options={dietaryOptions}
          selected={prefs.selectedDietary}
          onToggle={(v) => toggle("selectedDietary", v)}
        />
      </div>

      {/* Save button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="px-6 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          Save preferences
        </button>
        {saved && (
          <span className="text-sm text-[var(--color-success)] animate-pulse">Saved</span>
        )}
      </div>
    </div>
  );
}
