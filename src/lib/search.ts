import type { Restaurant } from "./types";

/** Day-of-week names used to match natural language day references to slot dates. */
const DAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/**
 * Tokenizes a free-text query into lowercase trimmed tokens.
 */
function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/\s+/)
    .map((t) => t.replace(/[^a-z0-9-]/g, ""))
    .filter(Boolean);
}

/**
 * Returns the day-of-week index (0=Sun..6=Sat) if the token is a day name
 * or common abbreviation, otherwise null.
 */
function parseDayToken(token: string): number | null {
  const idx = DAY_NAMES.findIndex(
    (d) => d === token || d.startsWith(token) // "fri" matches "friday"
  );
  return idx >= 0 ? idx : null;
}

/**
 * Checks whether a restaurant has any slot on the given day-of-week (0-6).
 */
function hasSlotOnDay(restaurant: Restaurant, dayIndex: number): boolean {
  return restaurant.slots.some((s) => {
    const [y, m, d] = s.date.split("-").map(Number);
    return new Date(y, m - 1, d).getDay() === dayIndex;
  });
}

/**
 * Scores how well a single non-day token matches a restaurant.
 * Returns a number >= 0. Higher = stronger match.
 */
function scoreToken(token: string, r: Restaurant): number {
  let score = 0;

  // Name (strongest signal)
  if (r.name.toLowerCase().includes(token)) score += 4;

  // Cuisines
  if (r.cuisines.some((c) => c.toLowerCase().includes(token))) score += 3;

  // Vibe tags
  if (r.vibe_tags.some((v) => v.toLowerCase().includes(token))) score += 3;

  // Suburb
  if (r.suburb.toLowerCase().includes(token)) score += 2;

  // City
  if (r.city.toLowerCase().includes(token)) score += 2;

  // Pitch
  if (r.pitch?.toLowerCase().includes(token)) score += 1;

  // Tags — good_for, venue_type, dietary
  if (r.tags.good_for.some((g) => g.toLowerCase().includes(token))) score += 2;
  if (r.tags.venue_type.some((v) => v.toLowerCase().includes(token)))
    score += 2;
  if (r.tags.dietary.some((d) => d.toLowerCase().includes(token))) score += 2;

  // Session types ("lunch", "dinner")
  if (r.session_types.some((s) => s.toLowerCase() === token)) score += 1;

  return score;
}

/**
 * Client-side search engine.
 *
 * Tokenizes the query and scores each restaurant by how many tokens match
 * and how strongly. Day-of-week tokens ("friday", "sat") act as hard
 * filters — a restaurant must have a slot on that day to be included.
 *
 * Final score is weighted by the restaurant's match_score when available.
 */
export function searchRestaurants(
  query: string,
  restaurants: Restaurant[]
): Restaurant[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return restaurants;

  // Separate day tokens from content tokens
  const dayIndices: number[] = [];
  const contentTokens: string[] = [];

  for (const t of tokens) {
    const day = parseDayToken(t);
    if (day !== null) {
      dayIndices.push(day);
    } else {
      contentTokens.push(t);
    }
  }

  const scored: { restaurant: Restaurant; score: number }[] = [];

  for (const r of restaurants) {
    // Hard-filter: must have a slot on every requested day
    if (dayIndices.length > 0) {
      const matchesAllDays = dayIndices.every((d) => hasSlotOnDay(r, d));
      if (!matchesAllDays) continue;
    }

    // Phrase match bonus: check if full query (minus day tokens) appears as substring
    const phrase = contentTokens.join(" ");
    let phraseBonus = 0;
    if (phrase.length > 0) {
      const searchFields = [
        r.name, r.suburb, r.pitch || "",
        ...r.cuisines, ...r.vibe_tags,
        ...r.tags.good_for, ...r.tags.venue_type,
      ].map(s => s.toLowerCase());
      if (searchFields.some(f => f.includes(phrase))) {
        phraseBonus = 10;
      }
    }

    // Score content tokens
    let tokenScore = 0;
    let matchedTokens = 0;

    for (const t of contentTokens) {
      const s = scoreToken(t, r);
      if (s > 0) {
        tokenScore += s;
        matchedTokens++;
      }
    }

    // If there are content tokens, require at least one to match (unless phrase matched)
    if (contentTokens.length > 0 && matchedTokens === 0 && phraseBonus === 0) continue;

    // Weight by match_score (0-100 normalised to 0.5-1.5 multiplier)
    const matchMultiplier =
      r.match_score != null ? 0.5 + r.match_score / 100 : 1;

    // Bonus for matching all content tokens
    const completenessBonus =
      contentTokens.length > 0 && matchedTokens === contentTokens.length
        ? 5
        : 0;

    const finalScore =
      (tokenScore + completenessBonus + phraseBonus) * matchMultiplier +
      (dayIndices.length > 0 ? 1 : 0); // small bump for day match existing

    scored.push({ restaurant: r, score: finalScore });
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .map((s) => s.restaurant);
}
