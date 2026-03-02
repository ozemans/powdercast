import Link from "next/link";
import type { ResortWithConditions } from "@/lib/types";
import { formatSnowfall, formatTemp, cn } from "@/lib/utils";
import { ConditionsIcon } from "./ConditionsIcon";

interface ResortCardProps {
  resort: ResortWithConditions;
}

export default function ResortCard({ resort }: ResortCardProps) {
  const isPowderDay = resort.snow_24h >= 6;
  const hasSnow = resort.snow_24h > 0;

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

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Name and location */}
        <div className="mb-4 pr-16">
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
              {formatTemp(resort.current_temp)}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
