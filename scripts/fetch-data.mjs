#!/usr/bin/env node

/**
 * First Table Data Fetcher
 * Queries the First Table GraphQL API to pull restaurant listings
 * and availability data. Outputs raw-data.json for AI enrichment.
 *
 * Usage: node scripts/fetch-data.mjs [city-name]
 *   No args = all active cities from preferences.json
 *   city-name = just that city (e.g., "auckland")
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import https from 'https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const GRAPHQL_URL = 'https://stellate.firsttable.net/graphql';
const BATCH_SIZE = 500; // restaurants per query — API supports up to 500
const DELAY_MS = 500;   // polite delay between requests

// --- GraphQL helpers ---

const MAX_RETRIES = 3;
const RETRY_BASE_MS = 2000;

function gqlRequestOnce(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query, variables });
    const options = {
      hostname: 'stellate.firsttable.net',
      path: '/graphql',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Origin': 'https://www.firsttable.co.nz',
        'Referer': 'https://www.firsttable.co.nz/',
        'User-Agent': 'FirstTableScanner/1.0'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 500) {
          reject(new Error(`Server error ${res.statusCode}: ${data.substring(0, 200)}`));
          return;
        }
        try {
          const parsed = JSON.parse(data);
          if (parsed.errors) {
            reject(new Error(`GraphQL errors: ${JSON.stringify(parsed.errors)}`));
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data.substring(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function gqlRequest(query, variables = {}) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await gqlRequestOnce(query, variables);
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
      console.warn(`  Attempt ${attempt}/${MAX_RETRIES} failed: ${err.message}. Retrying in ${delay / 1000}s...`);
      await sleep(delay);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// --- Restaurant query ---

const RESTAURANT_QUERY = `
  query FetchRestaurants($cityId: Int!, $limit: Int!, $offset: Int!) {
    City(id: $cityId) {
      restaurants(limit: $limit, offset: $offset) {
        edges {
          node {
            id
            title
            slug
            rating
            reviewsCount
            mainsPriceRange
            bookingPrice
            city
            street
            lat
            lng
            heroImage
            isNew
            featured
            featuredText
            offersFirstTable
            offersRegularTable
            additionalPeopleAllowed
            minFirstTableDiners
            maxFirstTableDiners
            firstTableSessionTypes
            website
            menuLink
            reviewSummary
            sessionAvailability {
              date
              sessions
            }
            suburb {
              title
              slug
            }
            cuisines {
              edges {
                node {
                  title
                }
              }
            }
            tags {
              edges {
                node {
                  title
                  category
                }
              }
            }
            bookingPricesBySession {
              title
              price
              discount
            }
          }
        }
      }
    }
  }
`;

// --- Fetch all restaurants for a city ---

async function fetchCityRestaurants(cityName, cityId) {
  // First get the count
  const countData = await gqlRequest(`{ City(id: ${cityId}) { restaurantCount } }`);
  const total = countData.City.restaurantCount;
  console.log(`  ${cityName}: ${total} restaurants to fetch`);

  const allRestaurants = [];
  let offset = 0;

  while (offset < total) {
    const data = await gqlRequest(RESTAURANT_QUERY, {
      cityId,
      limit: BATCH_SIZE,
      offset
    });

    const edges = data.City.restaurants.edges;
    if (edges.length === 0) break;

    for (const edge of edges) {
      const node = edge.node;
      allRestaurants.push(transformRestaurant(node, cityName));
    }

    offset += edges.length;
    const pct = Math.min(100, Math.round((offset / total) * 100));
    process.stdout.write(`\r  ${cityName}: ${offset}/${total} (${pct}%)`);

    if (offset < total) await sleep(DELAY_MS);
  }

  console.log(`\r  ${cityName}: ${allRestaurants.length}/${total} fetched ✓`);
  return allRestaurants;
}

// --- Transform raw GraphQL data to our schema ---

function transformRestaurant(node, cityName) {
  const cuisines = node.cuisines.edges.map(e => e.node.title);

  // Group tags by category
  const tagsByCategory = {};
  for (const edge of node.tags.edges) {
    const { title, category } = edge.node;
    if (!tagsByCategory[category]) tagsByCategory[category] = [];
    tagsByCategory[category].push(title);
  }

  // Build availability: only dates with sessions
  const slots = node.sessionAvailability
    .filter(sa => sa.sessions.length > 0)
    .map(sa => ({
      date: sa.date,
      sessions: sa.sessions.map(s => s.toLowerCase())
    }));

  // Extract price category from tags
  const priceTag = tagsByCategory['Price']?.[0] || null;

  return {
    id: node.id,
    name: node.title,
    slug: node.slug,
    city: cityName,
    suburb: node.suburb?.title || node.city || '',
    suburb_slug: node.suburb?.slug || '',
    cuisines,
    price_tag: priceTag,
    mains_price_range: node.mainsPriceRange,
    booking_fee: node.bookingPrice,
    rating: node.rating ? Math.round(node.rating * 10) / 10 : null,
    review_count: node.reviewsCount || 0,
    review_summary: node.reviewSummary || null,
    street: node.street,
    lat: node.lat ? parseFloat(node.lat) : null,
    lng: node.lng ? parseFloat(node.lng) : null,
    image: node.heroImage ? `https://images.firsttable.net/${node.heroImage}` : null,
    is_new: node.isNew || false,
    featured: node.featured || false,
    featured_text: node.featuredText || '',
    offers_first_table: node.offersFirstTable || false,
    offers_regular_table: node.offersRegularTable || false,
    additional_people: node.additionalPeopleAllowed || 0,
    min_diners: node.minFirstTableDiners || 2,
    max_diners: node.maxFirstTableDiners || 4,
    session_types: node.firstTableSessionTypes || [],
    website: node.website || null,
    menu_link: node.menuLink || null,
    slots,
    tags: {
      cuisine: tagsByCategory['Cuisine'] || [],
      dietary: tagsByCategory['Dietary'] || [],
      good_for: tagsByCategory['Good for'] || [],
      venue_type: tagsByCategory['Venue type'] || [],
      features: tagsByCategory['Features'] || [],
      price: tagsByCategory['Price'] || [],
      other: tagsByCategory['Other'] || []
    },
    booking_prices: (node.bookingPricesBySession || []).map(bp => ({
      session: bp.title,
      price: bp.price,
      discount: bp.discount
    })),
    url: `https://www.firsttable.co.nz${node.slug}`,
    // AI enrichment fields — populated later by Claude
    vibe_tags: [],
    value_score: null,
    match_score: null,
    pitch: null
  };
}

// --- Main ---

async function main() {
  const prefs = JSON.parse(readFileSync(join(ROOT, 'preferences.json'), 'utf-8'));

  // Determine which cities to fetch
  const targetCity = process.argv[2]?.toLowerCase();
  let citiesToFetch;

  if (targetCity) {
    if (!prefs.cities[targetCity]) {
      console.error(`Unknown city: ${targetCity}. Available: ${Object.keys(prefs.cities).join(', ')}`);
      process.exit(1);
    }
    citiesToFetch = [[targetCity, prefs.cities[targetCity]]];
  } else {
    citiesToFetch = prefs.active_cities.map(name => [name, prefs.cities[name]]);
  }

  console.log(`Fetching restaurants from First Table GraphQL API...`);
  console.log(`Cities: ${citiesToFetch.map(([name]) => name).join(', ')}\n`);

  const allRestaurants = [];

  for (const [cityName, cityId] of citiesToFetch) {
    const restaurants = await fetchCityRestaurants(cityName, cityId);
    allRestaurants.push(...restaurants);
  }

  // Deduplicate by id (restaurants can appear in parent+child cities)
  const seen = new Set();
  const unique = allRestaurants.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  const output = {
    last_updated: new Date().toISOString(),
    fetch_cities: citiesToFetch.map(([name]) => name),
    restaurant_count: unique.length,
    restaurants: unique
  };

  const outPath = join(ROOT, 'public', 'raw-data.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n✓ Wrote ${unique.length} restaurants to ${outPath}`);
  console.log(`  File size: ${(Buffer.byteLength(JSON.stringify(output)) / 1024).toFixed(0)} KB`);
}

main().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});
