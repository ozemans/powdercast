import Link from "next/link";
import type { ResortWithConditions } from "@/lib/types";
import { formatSnowfall, formatTemp, cn } from "@/lib/utils";
import { ConditionsIcon } from "./ConditionsIcon";

interface ResortCardProps {
  resort: ResortWithConditions;
}

export default function ResortCard({ resort }: ResortCardProps) {
  const isPowderDay = resort.snow_24h >= 6;

  return (
    <Link
      href={`/resort/${resort.slug}`}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border bg-bg-secondary transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20",
        isPowderDay ? "border-accent-orange/40" : "border-border"
      )}
    >
      {/* Powder day badge */}
      {isPowderDay && (
        <div className="absolute right-3 top-3 rounded-full bg-accent-orange/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-orange">
          Powder
        </div>
      )}

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Resort name and location */}
        <div className="mb-4">
          <h3 className="text-base font-semibold text-text-primary group-hover:text-accent-blue transition-colors">
            {resort.name}
          </h3>
          <p className="text-xs text-text-secondary">
            {resort.state_province} &middot; {resort.region}
          </p>
        </div>

        {/* Big snowfall number */}
        <div className="mb-4 flex items-end gap-1">
          <span
            className={cn(
              "text-4xl font-bold tabular-nums leading-none",
              isPowderDay ? "text-accent-orange" : "text-accent-blue"
            )}
          >
            {resort.snow_24h}
          </span>
          <span className="mb-0.5 text-sm text-text-secondary">&quot;/24h</span>
        </div>

        {/* Stats row */}
        <div className="mt-auto flex items-center gap-4 border-t border-border pt-3 text-xs text-text-secondary">
          <div className="flex items-center gap-1.5">
            <ConditionsIcon conditions={resort.conditions} size={14} />
            <span>{resort.conditions}</span>
          </div>
          <div className="tabular-nums">{formatSnowfall(resort.snow_48h)} / 48h</div>
          <div className="ml-auto tabular-nums">{formatTemp(resort.current_temp)}</div>
        </div>
      </div>
    </Link>
  );
}
