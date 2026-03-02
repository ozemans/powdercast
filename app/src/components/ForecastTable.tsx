"use client";

import type { DailySummary } from "@/lib/types";
import {
  formatDate,
  formatDateShort,
  formatSnowfall,
  formatWind,
  cn,
} from "@/lib/utils";
import { ConditionsIcon } from "./ConditionsIcon";
import { useUnit } from "@/contexts/UnitContext";

interface ForecastTableProps {
  days: DailySummary[];
}

export default function ForecastTable({ days }: ForecastTableProps) {
  const { displayTemp } = useUnit();

  if (!days || days.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-bg-secondary p-6 text-center text-sm text-text-secondary">
        No forecast data available
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-bg-secondary">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wider text-text-secondary">
            <th className="px-4 py-3 text-left font-medium">Date</th>
            <th className="px-4 py-3 text-left font-medium">Conditions</th>
            <th className="px-4 py-3 text-right font-medium">Snow</th>
            <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">
              Range
            </th>
            <th className="px-4 py-3 text-right font-medium">Hi / Lo</th>
            <th className="hidden px-4 py-3 text-right font-medium md:table-cell">
              Wind
            </th>
            <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">
              Quality
            </th>
            <th className="hidden px-4 py-3 text-right font-medium lg:table-cell">
              Confidence
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => {
            const isPowder = day.snowfall_total >= 6;
            // "Mon, Mar 3" → split to get "Mar 3"
            const dateParts = formatDate(day.date).split(",");
            const monthDay = dateParts.length > 1 ? dateParts[1].trim() : dateParts[0];
            return (
              <tr
                key={day.date}
                className={cn(
                  "border-b border-border/50 last:border-b-0 transition-colors",
                  isPowder
                    ? "bg-accent-orange/5 hover:bg-accent-orange/10"
                    : "hover:bg-bg-elevated/50"
                )}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-text-primary">
                    {formatDateShort(day.date)}
                  </div>
                  <div className="text-[11px] text-text-secondary">
                    {monthDay}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ConditionsIcon conditions={day.conditions} size={18} />
                    <span className="text-text-primary">{day.conditions}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span
                    className={cn(
                      "text-base font-bold tabular-nums",
                      isPowder ? "text-accent-orange" : "text-accent-blue"
                    )}
                  >
                    {formatSnowfall(day.snowfall_total)}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-right tabular-nums text-text-secondary sm:table-cell">
                  {formatSnowfall(day.snowfall_low)} –{" "}
                  {formatSnowfall(day.snowfall_high)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-text-primary">
                  {displayTemp(day.temp_high)}{" "}
                  <span className="text-text-secondary">
                    / {displayTemp(day.temp_low)}
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-right tabular-nums text-text-secondary md:table-cell">
                  {formatWind(day.wind_avg)}
                  <span className="ml-1 text-[11px]">
                    (G {formatWind(day.wind_gust)})
                  </span>
                </td>
                <td className="hidden px-4 py-3 text-right lg:table-cell">
                  {day.snow_quality ? (
                    <span
                      className={cn(
                        "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                        day.snow_quality === "Fresh Powder" &&
                          "bg-accent-blue/15 text-accent-blue",
                        day.snow_quality === "Packed Powder" &&
                          "bg-accent-green/15 text-accent-green",
                        day.snow_quality === "Spring Conditions" &&
                          "bg-accent-orange/15 text-accent-orange",
                        day.snow_quality === "Wind Affected" &&
                          "bg-text-secondary/15 text-text-secondary",
                        day.snow_quality === "Wet/Heavy" &&
                          "bg-accent-orange/15 text-accent-orange",
                        !["Fresh Powder","Packed Powder","Spring Conditions","Wind Affected","Wet/Heavy"].includes(day.snow_quality) &&
                          "bg-text-secondary/15 text-text-secondary"
                      )}
                    >
                      {day.snow_quality}
                    </span>
                  ) : (
                    <span className="text-[11px] text-text-secondary">—</span>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-right lg:table-cell">
                  <span
                    className={cn(
                      "inline-block rounded-full px-2 py-0.5 text-[11px] font-medium",
                      day.confidence === "high" &&
                        "bg-accent-green/15 text-accent-green",
                      day.confidence === "medium" &&
                        "bg-accent-blue/15 text-accent-blue",
                      day.confidence === "low" &&
                        "bg-text-secondary/15 text-text-secondary"
                    )}
                  >
                    {day.confidence}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
