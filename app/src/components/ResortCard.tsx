"use client";

import Link from "next/link";
import type { ResortWithConditions } from "@/lib/types";
import { formatSnowfall, cn } from "@/lib/utils";
import { ConditionsIcon } from "./ConditionsIcon";
import { useUnit } from "@/contexts/UnitContext";
import { useFavorites } from "@/hooks/useFavorites";

interface ResortCardProps {
  resort: ResortWithConditions;
}

// Derive a compact snow quality label from conditions string
function getQualityLabel(conditions: string): string | null {
  const c = conditions.toLowerCase();
  if (c.includes("fresh") || c.includes("powder")) return "Powder";
  if (c.includes("spring") || c.includes("corn")) return "Spring";
  if (c.includes("wet") || c.includes("heavy")) return "Wet";
  if (c.includes("wind")) return "Wind";
  return null;
}

export default function ResortCard({ resort }: ResortCardProps) {
  const { displayTemp } = useUnit();
  const { isFavorite, toggle } = useFavorites();

  const isPowderDay = resort.snow_24h >= 6;
  const hasSnow = resort.snow_24h > 0;
  const isSnowing = resort.conditions.toLowerCase().includes("snow");
  const qualityLabel = getQualityLabel(resort.conditions);
  const fav = isFavorite(resort.slug);

  return (
    <Link
      href={`/resort/${resort.slug}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border transition-all duration-200",
        "hover:-translate-y-1 hover:shadow-xl",
        isPowderDay
          ? "border-accent-orange/25 bg-bg-secondary hover:border-accent-orange/50 hover:shadow-accent-orange/10"
          : "border-border bg-bg-secondary hover:border-accent-blue/25 hover:shadow-accent-blue/5"
      )}
    >
      {/* Top accent bar */}
      <div
        className={cn(
          "h-0.5 w-full flex-shrink-0",
          isPowderDay
            ? "bg-gradient-to-r from-accent-orange via-accent-orange/50 to-transparent"
            : "bg-gradient-to-r from-accent-blue/40 via-accent-blue/15 to-transparent"
        )}
      />

      {/* Powder badge */}
      {isPowderDay && (
        <div className="absolute right-3 top-4 rounded-full bg-accent-orange px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-white shadow-lg shadow-accent-orange/30">
          Powder
        </div>
      )}

      {/* Currently snowing badge */}
      {!isPowderDay && isSnowing && (
        <div className="absolute right-3 top-4 flex items-center gap-1 rounded-full bg-accent-blue/15 px-2 py-0.5 text-[10px] font-medium text-accent-blue ring-1 ring-accent-blue/30">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-accent-blue" />
          Snowing
        </div>
      )}

      {/* Favorite button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggle(resort.slug);
        }}
        className={cn(
          "absolute left-3 top-4 flex h-6 w-6 items-center justify-center rounded-full transition-all",
          fav
            ? "text-accent-orange opacity-100"
            : "text-text-secondary opacity-0 group-hover:opacity-100"
        )}
        aria-label={fav ? "Remove from favorites" : "Add to favorites"}
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill={fav ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={fav ? 0 : 1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
          />
        </svg>
      </button>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Name and location */}
        <div className="mb-4 pr-16 pl-2">
          <h3 className="text-sm font-semibold leading-snug text-text-primary transition-colors group-hover:text-accent-blue">
            {resort.name}
          </h3>
          <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
            {resort.state_province} · {resort.region}
          </p>
        </div>

        {/* Big snowfall number */}
        <div className="mb-4 flex items-baseline gap-1.5">
          <span
            className={cn(
              "font-brand text-5xl leading-none tabular-nums",
              isPowderDay
                ? "text-accent-orange"
                : hasSnow
                ? "text-accent-blue"
                : "text-text-secondary"
            )}
          >
            {resort.snow_24h}
          </span>
          <div className="flex flex-col leading-none">
            <span className="text-[11px] font-medium text-text-secondary">in</span>
            <span className="text-[10px] text-text-secondary">/ 24h</span>
          </div>
        </div>

        {/* Bottom stats row */}
        <div className="mt-auto flex items-center border-t border-border/40 pt-3">
          <div className="flex items-center gap-1.5 text-[11px] text-text-secondary">
            <ConditionsIcon conditions={resort.conditions} size={13} />
            <span>{resort.conditions}</span>
          </div>
          <div className="ml-auto flex items-center gap-3 tabular-nums">
            {qualityLabel && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  qualityLabel === "Powder" && "bg-accent-blue/15 text-accent-blue",
                  qualityLabel === "Spring" && "bg-accent-orange/15 text-accent-orange",
                  qualityLabel === "Wet" && "bg-accent-orange/15 text-accent-orange",
                  qualityLabel === "Wind" && "bg-text-secondary/15 text-text-secondary"
                )}
              >
                {qualityLabel}
              </span>
            )}
            <span className="text-[11px] text-text-secondary">
              {formatSnowfall(resort.snow_48h)}/48h
            </span>
            <span
              className={cn(
                "text-xs font-semibold",
                resort.current_temp <= 28
                  ? "text-accent-blue"
                  : resort.current_temp >= 40
                  ? "text-accent-orange"
                  : "text-text-primary"
              )}
            >
              {displayTemp(resort.current_temp)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
