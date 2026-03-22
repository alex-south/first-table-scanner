import type { PlannerData, HistoryEntry, UserPreferences } from "./types";

const KEYS = {
  planner: "ft-planner",
  history: "ft-history",
  preferences: "ft-preferences",
} as const;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readJSON<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

// --- Planner (date -> restaurant IDs) ---

export function getPlanner(): PlannerData {
  return readJSON<PlannerData>(KEYS.planner, {});
}

export function savePlanner(data: PlannerData): void {
  writeJSON(KEYS.planner, data);
}

// --- Visit history ---

export function getHistory(): HistoryEntry[] {
  return readJSON<HistoryEntry[]>(KEYS.history, []);
}

export function saveHistory(entries: HistoryEntry[]): void {
  writeJSON(KEYS.history, entries);
}

// --- User preferences (filters, party size, etc.) ---

const DEFAULT_PREFERENCES: UserPreferences = {
  selectedCuisines: [],
  budgetRange: null,
  selectedVibes: [],
  selectedDietary: [],
  partySize: 2,
};

export function getPreferences(): UserPreferences {
  return readJSON<UserPreferences>(KEYS.preferences, DEFAULT_PREFERENCES);
}

export function savePreferences(prefs: UserPreferences): void {
  writeJSON(KEYS.preferences, prefs);
}
