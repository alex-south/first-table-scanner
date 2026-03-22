// First Table Scanner — shared TypeScript types

export interface Slot {
  date: string;
  sessions: string[];
}

export interface Tags {
  cuisine: string[];
  dietary: string[];
  good_for: string[];
  venue_type: string[];
  features: string[];
  price: string[];
  other: string[];
}

export interface BookingPrice {
  session: string;
  price: string;
  discount: string;
}

export interface Restaurant {
  id: number;
  name: string;
  slug: string;
  city: string;
  suburb: string;
  suburb_slug: string;
  cuisines: string[];
  price_tag: string | null;
  mains_price_range: string | null;
  booking_fee: string;
  rating: number | null;
  review_count: number;
  review_summary: string | null;
  street: string;
  lat: number | null;
  lng: number | null;
  image: string | null;
  is_new: boolean;
  featured: boolean;
  featured_text: string;
  offers_first_table: boolean;
  offers_regular_table: boolean;
  additional_people: number;
  min_diners: number;
  max_diners: number;
  session_types: string[];
  website: string | null;
  menu_link: string | null;
  slots: Slot[];
  tags: Tags;
  booking_prices: BookingPrice[];
  url: string;
  vibe_tags: string[];
  value_score: number | null;
  match_score: number | null;
  pitch: string | null;
}

export interface RestaurantData {
  last_updated: string;
  fetch_cities: string[];
  restaurant_count: number;
  restaurants: Restaurant[];
}

// localStorage types

export type PlannerData = Record<string, number[]>; // date -> restaurant IDs

export interface HistoryEntry {
  restaurantId: number;
  date: string;
  rating: number | null;
  notes: string;
  amountSpent: number | null;
}

export interface UserPreferences {
  selectedCuisines: string[];
  budgetRange: [number, number] | null;
  selectedVibes: string[];
  selectedDietary: string[];
  partySize: number;
}
