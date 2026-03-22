#!/usr/bin/env node

/**
 * First Table Data Enricher
 * Adds vibe_tags, value_score, match_score algorithmically.
 * Pitches are generated separately by Claude via the skill.
 *
 * Usage: node scripts/enrich-data.mjs
 * Reads: public/raw-data.json + preferences.json
 * Writes: public/data.json
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// --- Vibe tag inference ---

const VIBE_RULES = [
  // [condition_fn, tag]
  [r => r.tags.good_for?.includes('Date night'), 'romantic'],
  [r => r.tags.good_for?.includes('Special occasion'), 'special-occasion'],
  [r => r.tags.good_for?.includes('Families') || r.tags.good_for?.includes('Kids'), 'family-friendly'],
  [r => r.tags.good_for?.includes('Bar scene') || r.tags.good_for?.includes('Live music'), 'lively'],
  [r => r.tags.good_for?.includes('Hidden gems'), 'hidden-gem'],
  [r => r.tags.good_for?.includes('Craft beer') || r.tags.good_for?.includes('Wine bar'), 'pub-vibe'],
  [r => r.tags.good_for?.includes('Views'), 'waterfront'],
  [r => r.tags.venue_type?.includes('Bars & pubs') || r.tags.venue_type?.includes('Sports bar'), 'pub-vibe'],
  [r => r.tags.venue_type?.includes('Cocktail bar') || r.tags.venue_type?.includes('Wine bar'), 'trendy'],
  [r => r.tags.venue_type?.includes('Cafe'), 'casual'],
  [r => r.tags.venue_type?.includes('Late night'), 'lively'],
  [r => r.tags.venue_type?.includes('Gastropub'), 'cozy'],
  [r => r.tags.venue_type?.includes('Vineyard'), 'romantic'],
  [r => r.tags.features?.includes('Indoor & outdoor seating') || r.tags.features?.includes('Beer garden'), 'garden'],
  [r => r.cuisines?.some(c => ['Fine dining'].includes(c)), 'fine-dining'],
  [r => r.cuisines?.some(c => ['Fine dining'].includes(c)) || (r.price_tag === '$$$$' && r.rating >= 4.5), 'upscale'],
  [r => r.price_tag === '$' || r.price_tag === '$$', 'casual'],
  [r => r.is_new && r.review_count < 20, 'hidden-gem'],
  [r => r.tags.good_for?.includes('Business meetings'), 'quiet'],
];

function inferVibes(restaurant) {
  const vibes = new Set();
  for (const [condition, tag] of VIBE_RULES) {
    try {
      if (condition(restaurant)) vibes.add(tag);
    } catch { /* skip on missing data */ }
  }

  // If nothing matched, default based on venue
  if (vibes.size === 0) vibes.add('casual');

  // Cap at 4 tags
  return [...vibes].slice(0, 4);
}

// --- Value score (1-10) ---

function parsePrice(priceStr) {
  if (!priceStr) return null;
  const nums = priceStr.match(/\d+/g);
  if (!nums || nums.length === 0) return null;
  return nums.reduce((a, b) => a + parseInt(b), 0) / nums.length;
}

function parseFee(feeStr) {
  if (!feeStr) return 10;
  const match = feeStr.match(/\d+/);
  return match ? parseInt(match[0]) : 10;
}

function computeValueScore(r) {
  let score = 5; // baseline

  const avgMains = parsePrice(r.mains_price_range);
  const fee = parseFee(r.booking_fee);

  // Lower mains = better value (you save more relative to cost)
  if (avgMains) {
    if (avgMains <= 20) score += 2;
    else if (avgMains <= 30) score += 1;
    else if (avgMains >= 40) score -= 1;
  }

  // Lower fee = better
  if (fee <= 8) score += 1;
  else if (fee >= 15) score -= 1;

  // Higher rating = quality for money
  if (r.rating) {
    if (r.rating >= 4.7) score += 2;
    else if (r.rating >= 4.4) score += 1;
    else if (r.rating < 3.5) score -= 1;
  }

  // More reviews = confidence in quality
  if (r.review_count >= 100) score += 0.5;
  else if (r.review_count < 5) score -= 0.5;

  return Math.max(1, Math.min(10, Math.round(score)));
}

// --- Match score (0-100) ---

function computeMatchScore(r, prefs) {
  let score = 0;

  // Cuisine match (+30)
  const cuisineLower = r.cuisines?.map(c => c.toLowerCase()) || [];
  const prefCuisines = prefs.preferred_cuisines?.map(c => c.toLowerCase()) || [];
  if (prefCuisines.some(pc => cuisineLower.some(c => c.includes(pc) || pc.includes(c)))) {
    score += 30;
  }

  // Vibe match (+20) — check against good_for tags
  const prefVibes = prefs.preferred_vibes || [];
  const goodFor = r.tags.good_for?.map(g => g.toLowerCase()) || [];
  for (const vibe of prefVibes) {
    const vibeLower = vibe.toLowerCase().replace('-', ' ');
    if (goodFor.some(g => g.includes(vibeLower) || vibeLower.includes(g))) {
      score += 10; // up to 20
    }
  }

  // Budget match (+25) — mains midpoint / 2 (since 50% off) vs budget_per_person
  const avgMains = parsePrice(r.mains_price_range);
  if (avgMains && prefs.budget_per_person) {
    const effectiveCost = avgMains / 2 + parseFee(r.booking_fee) / prefs.party_size;
    if (effectiveCost <= prefs.budget_per_person) score += 25;
    else if (effectiveCost <= prefs.budget_per_person * 1.3) score += 15;
    else if (effectiveCost <= prefs.budget_per_person * 1.6) score += 5;
  }

  // Has availability (+15)
  if (r.slots?.length > 0) score += 15;

  // Dietary match (+10)
  if (prefs.dietary?.length > 0) {
    const dietaryTags = r.tags.dietary?.map(d => d.toLowerCase()) || [];
    if (prefs.dietary.some(d => dietaryTags.some(dt => dt.includes(d.toLowerCase())))) {
      score += 10;
    }
  } else {
    // No dietary requirement = automatic match
    score += 10;
  }

  // Avoid cuisines penalty (-50)
  const avoidCuisines = prefs.avoid_cuisines?.map(c => c.toLowerCase()) || [];
  if (avoidCuisines.some(ac => cuisineLower.some(c => c.includes(ac)))) {
    score -= 50;
  }

  return Math.max(0, Math.min(100, score));
}

// --- Generate pitch ---

function generatePitch(r) {
  const cuisine = r.cuisines?.[0] || 'Restaurant';
  const suburb = r.suburb || '';
  const city = r.city || '';
  const location = suburb || city;

  // Pick the most interesting vibe
  const vibe = r.vibe_tags?.[0] || 'casual';

  // Build pitch components
  const parts = [];

  // Style + cuisine + location
  const vibeAdj = {
    'romantic': 'Romantic', 'casual': 'Casual', 'upscale': 'Upscale',
    'trendy': 'Trendy', 'cozy': 'Cozy', 'lively': 'Lively',
    'hidden-gem': 'Hidden-gem', 'family-friendly': 'Family-friendly',
    'fine-dining': 'Fine-dining', 'pub-vibe': 'Pub-style',
    'special-occasion': 'Special-occasion', 'quiet': 'Quiet',
    'waterfront': 'Waterfront', 'garden': 'Garden-setting',
  }[vibe] || 'Casual';

  parts.push(`${vibeAdj} ${cuisine} in ${location}`);

  // Standout quality
  if (r.rating >= 4.7 && r.review_count >= 50) {
    parts.push('stellar reviews');
  } else if (r.rating >= 4.5) {
    parts.push('strong reviews');
  } else if (r.is_new) {
    parts.push('new addition');
  } else if (r.value_score >= 8) {
    parts.push('great value');
  } else if (r.tags.good_for?.includes('Date night')) {
    parts.push('date-night spot');
  } else if (r.tags.good_for?.includes('Groups')) {
    parts.push('good for groups');
  } else if (r.tags.features?.includes('Indoor & outdoor seating')) {
    parts.push('indoor & outdoor');
  } else if (r.review_count >= 100) {
    parts.push('popular choice');
  } else {
    parts.push('worth a try');
  }

  const pitch = parts.join(' — ');
  return pitch.length > 80 ? pitch.substring(0, 77) + '...' : pitch;
}

// --- Main ---

function main() {
  const rawData = JSON.parse(readFileSync(join(ROOT, 'public', 'raw-data.json'), 'utf-8'));
  const prefs = JSON.parse(readFileSync(join(ROOT, 'preferences.json'), 'utf-8'));

  console.log(`Enriching ${rawData.restaurants.length} restaurants...`);

  const enriched = rawData.restaurants.map((r, i) => {
    // Compute algorithmic fields
    r.vibe_tags = inferVibes(r);
    r.value_score = computeValueScore(r);
    r.match_score = computeMatchScore(r, prefs);
    r.pitch = generatePitch(r);

    if ((i + 1) % 100 === 0) {
      process.stdout.write(`\r  Processed ${i + 1}/${rawData.restaurants.length}`);
    }
    return r;
  });

  console.log(`\r  Processed ${enriched.length}/${rawData.restaurants.length}`);

  // Sort by match_score descending
  enriched.sort((a, b) => b.match_score - a.match_score);

  const output = {
    last_updated: new Date().toISOString(),
    fetch_cities: rawData.fetch_cities,
    restaurant_count: enriched.length,
    restaurants: enriched
  };

  const outPath = join(ROOT, 'public', 'data.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  // Summary
  console.log(`\n✓ Wrote ${enriched.length} enriched restaurants to public/data.json`);
  console.log(`  File size: ${(Buffer.byteLength(JSON.stringify(output)) / 1024).toFixed(0)} KB`);

  // Stats
  const avgMatch = Math.round(enriched.reduce((s, r) => s + r.match_score, 0) / enriched.length);
  const avgValue = (enriched.reduce((s, r) => s + r.value_score, 0) / enriched.length).toFixed(1);
  const withSlots = enriched.filter(r => r.slots.length > 0).length;

  console.log(`\n  Avg match score: ${avgMatch}/100`);
  console.log(`  Avg value score: ${avgValue}/10`);
  console.log(`  With availability: ${withSlots}/${enriched.length}`);

  console.log(`\n  Top 5 matches:`);
  for (const r of enriched.slice(0, 5)) {
    console.log(`    ${r.match_score}% | ${r.name} — ${r.pitch}`);
  }

  // Vibe distribution
  const vibeCounts = {};
  for (const r of enriched) {
    for (const v of r.vibe_tags) {
      vibeCounts[v] = (vibeCounts[v] || 0) + 1;
    }
  }
  console.log(`\n  Vibe distribution:`);
  for (const [vibe, count] of Object.entries(vibeCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)) {
    console.log(`    ${vibe}: ${count}`);
  }
}

main();
