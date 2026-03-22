"use client";

import type { Restaurant } from "@/lib/types";

function StarRating({ rating }: { rating: number | null }) {
  if (rating == null) return <span className="text-xs text-[var(--color-text-dim)]">New</span>;
  const full = Math.floor(rating);
  const hasHalf = rating - full >= 0.3;
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className={`text-xs ${
            i < full
              ? "text-[var(--color-gold)]"
              : i === full && hasHalf
              ? "text-[var(--color-gold)] opacity-50"
              : "text-[var(--color-text-dim)]"
          }`}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function MatchBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const color =
    score >= 80
      ? "text-[var(--color-success)] bg-[var(--color-success)]/10 border-[var(--color-success)]/20"
      : score >= 60
      ? "text-[var(--color-accent)] bg-[var(--color-accent-muted)] border-[var(--color-accent)]/20"
      : "text-[var(--color-text-muted)] bg-[var(--color-bg-hover)] border-[var(--color-border)]";
  return (
    <span className={`absolute top-3 right-3 text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>
      {score}%
    </span>
  );
}

function SlotPills({ slots }: { slots: Restaurant["slots"] }) {
  if (slots.length === 0) {
    return <span className="text-xs text-[var(--color-text-dim)] italic">No availability</span>;
  }

  const upcoming = slots.slice(0, 4);
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="flex flex-wrap gap-1">
      {upcoming.map((slot) => {
        const [y, m, day2] = slot.date.split("-").map(Number);
          const d = new Date(y, m - 1, day2);
        const day = dayNames[d.getDay()];
        const date = d.getDate();
        return (
          <span
            key={slot.date}
            className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-accent-muted)] text-[var(--color-accent)] font-medium"
          >
            {day} {date}
          </span>
        );
      })}
      {slots.length > 4 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-bg-hover)] text-[var(--color-text-dim)]">
          +{slots.length - 4}
        </span>
      )}
    </div>
  );
}

export function RestaurantCard({ restaurant: r }: { restaurant: Restaurant }) {
  return (
    <a
      href={r.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group relative flex flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] overflow-hidden transition-all duration-200 hover:border-[var(--color-border-light)] hover:shadow-lg hover:shadow-black/20 hover:-translate-y-0.5"
    >
      {/* Image */}
      <div className="relative h-40 overflow-hidden bg-[var(--color-bg-hover)]">
        {r.image ? (
          <img
            src={r.image}
            alt={r.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-[var(--color-text-dim)] text-sm">
            No image
          </div>
        )}
        <MatchBadge score={r.match_score} />
        {r.is_new && (
          <span className="absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[var(--color-warning)]/90 text-black">
            New
          </span>
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[var(--color-bg-card)] to-transparent" />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-2.5 p-4 pt-2">
        {/* Name + Rating row */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors line-clamp-2">
            {r.name}
          </h3>
          <div className="flex flex-col items-end shrink-0">
            <StarRating rating={r.rating} />
            {r.review_count > 0 && (
              <span className="text-[10px] text-[var(--color-text-dim)]">{r.review_count}</span>
            )}
          </div>
        </div>

        {/* Cuisine + Location */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--color-text-muted)]">
          <span>{r.cuisines.join(", ") || "Restaurant"}</span>
          <span className="text-[var(--color-text-dim)]">·</span>
          <span>{r.suburb}</span>
          {r.price_tag && (
            <>
              <span className="text-[var(--color-text-dim)]">·</span>
              <span className="font-medium text-[var(--color-text)]">{r.price_tag}</span>
            </>
          )}
        </div>

        {/* Pitch */}
        {r.pitch && (
          <p className="text-xs text-[var(--color-text-dim)] italic leading-relaxed line-clamp-2">
            {r.pitch}
          </p>
        )}

        {/* Vibe tags */}
        {r.vibe_tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {r.vibe_tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-muted)]"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Footer: slots + fee */}
        <div className="flex items-end justify-between gap-2 pt-1 border-t border-[var(--color-border)]/50">
          <SlotPills slots={r.slots} />
          <span className="text-[10px] text-[var(--color-text-dim)] whitespace-nowrap">
            Fee: {r.booking_fee}
          </span>
        </div>
      </div>
    </a>
  );
}
