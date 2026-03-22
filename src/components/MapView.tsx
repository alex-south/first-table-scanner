"use client";

import { useEffect, useRef, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Restaurant } from "@/lib/types";

// Fix default marker icon issue with webpack
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

// Price-based marker colors
const PRICE_COLORS: Record<string, string> = {
  "$": "#34d399",    // green
  "$$": "#6c63ff",   // accent blue
  "$$$": "#a855f7",  // purple
  "$$$$": "#f59e0b", // gold
};

function createPriceIcon(priceTag: string | null): L.DivIcon {
  const color = PRICE_COLORS[priceTag || ""] || "#6c63ff";
  return L.divIcon({
    className: "",
    html: `<div style="
      width: 22px; height: 22px; border-radius: 50%;
      background: ${color}; border: 2.5px solid rgba(255,255,255,0.9);
      box-shadow: 0 2px 8px rgba(0,0,0,0.5);
      cursor: pointer;
    "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -14],
  });
}

// Auto-fit bounds when restaurants change
function FitBounds({ restaurants }: { restaurants: Restaurant[] }) {
  const map = useMap();
  const prevCount = useRef(0);

  useEffect(() => {
    const valid = restaurants.filter((r) => r.lat && r.lng);
    if (valid.length === 0) return;
    // Only re-fit when the count changes (filter applied), not on every render
    if (valid.length === prevCount.current) return;
    prevCount.current = valid.length;

    const bounds = L.latLngBounds(valid.map((r) => [r.lat!, r.lng!]));
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }, [restaurants, map]);

  return null;
}

// Star display
function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null;
  return <span className="text-[var(--color-gold)]">{"★".repeat(Math.round(rating))}</span>;
}

interface MapViewProps {
  restaurants: Restaurant[];
}

export default function MapView({ restaurants }: MapViewProps) {
  const validRestaurants = useMemo(
    () => restaurants.filter((r) => r.lat != null && r.lng != null),
    [restaurants]
  );

  // Default center: Auckland
  const defaultCenter: [number, number] = [-36.85, 174.76];
  const center = useMemo(() => {
    if (validRestaurants.length === 0) return defaultCenter;
    const avgLat = validRestaurants.reduce((s, r) => s + r.lat!, 0) / validRestaurants.length;
    const avgLng = validRestaurants.reduce((s, r) => s + r.lng!, 0) / validRestaurants.length;
    return [avgLat, avgLng] as [number, number];
  }, [validRestaurants]);

  return (
    <MapContainer
      center={center}
      zoom={12}
      className="h-full w-full rounded-xl"
      zoomControl={true}
      attributionControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://carto.com/">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />
      <FitBounds restaurants={validRestaurants} />
      {validRestaurants.map((r) => (
          <Marker
            key={r.id}
            position={[r.lat!, r.lng!]}
            icon={createPriceIcon(r.price_tag)}
          >
            <Popup>
              <div className="min-w-[200px] max-w-[260px]">
                {r.image && (
                  <img
                    src={r.image}
                    alt={r.name}
                    className="w-full h-24 object-cover rounded-lg mb-2"
                  />
                )}
                <p className="text-sm font-semibold text-[var(--color-text)] mb-0.5 leading-tight">
                  {r.name}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mb-1">
                  {r.cuisines.join(", ")} · {r.suburb}
                  {r.price_tag && ` · ${r.price_tag}`}
                </p>
                {r.rating && (
                  <p className="text-xs mb-1">
                    <Stars rating={r.rating} />
                    <span className="text-[var(--color-text-dim)] ml-1">
                      {r.rating} ({r.review_count})
                    </span>
                  </p>
                )}
                {r.slots.length > 0 && (
                  <p className="text-[10px] text-[var(--color-success)] mb-2">
                    {r.slots.length} day{r.slots.length > 1 ? "s" : ""} available · Fee: {r.booking_fee}
                  </p>
                )}
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs px-3 py-1.5 rounded-lg bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] transition-colors"
                >
                  View on First Table
                </a>
              </div>
            </Popup>
          </Marker>
        ))}
    </MapContainer>
  );
}
