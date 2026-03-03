"use client";

import type { ResortForecast } from "@/lib/types";
import { WMO_WEATHER_CODES } from "@/lib/types";
import { formatSnowfall, formatWind, cn } from "@/lib/utils";
import { ConditionsIcon } from "./ConditionsIcon";
import { useUnit } from "@/contexts/UnitContext";

interface DayDetailPanelProps {
  date: string;
  hourly: ResortForecast["blended"]["hourly"];
}

interface PeriodData {
  label: string;
  snowfall: number;
  tempHigh: number | null;
  tempLow: number | null;
  baseTempHigh: number | null;
  baseTempLow: number | null;
  summitTempHigh: number | null;
  summitTempLow: number | null;
  windAvg: number | null;
  windGust: number | null;
  conditions: string;
}

const PERIODS = [
  { label: "Night", startHour: 0, endHour: 6 },
  { label: "Morning", startHour: 6, endHour: 12 },
  { label: "Afternoon", startHour: 12, endHour: 18 },
  { label: "Evening", startHour: 18, endHour: 24 },
];

function aggregatePeriod(
  hourly: ResortForecast["blended"]["hourly"],
  date: string,
  startHour: number,
  endHour: number
): PeriodData | null {
  const indices: number[] = [];
  for (let i = 0; i < hourly.time.length; i++) {
    const t = hourly.time[i];
    if (!t.startsWith(date)) continue;
    const hour = parseInt(t.slice(11, 13), 10);
    if (hour >= startHour && hour < endHour) {
      indices.push(i);
    }
  }
  if (indices.length === 0) return null;

  const vals = (arr: (number | null)[] | undefined) =>
    indices.map(i => arr?.[i]).filter((v): v is number => v != null);

  const temps = vals(hourly.temperature_2m);
  const baseTemps = vals(hourly.base_temp);
  const summitTemps = vals(hourly.summit_temp);
  const winds = vals(hourly.wind_speed);
  const gusts = vals(hourly.wind_gust);
  const snows = vals(hourly.snowfall);
  const codes = vals(hourly.weather_code);

  const dominantCode = codes.length > 0 ? Math.max(...codes) : null;

  return {
    label: PERIODS.find(p => p.startHour === startHour)!.label,
    snowfall: snows.reduce((a, b) => a + b, 0),
    tempHigh: temps.length ? Math.max(...temps) : null,
    tempLow: temps.length ? Math.min(...temps) : null,
    baseTempHigh: baseTemps.length ? Math.max(...baseTemps) : null,
    baseTempLow: baseTemps.length ? Math.min(...baseTemps) : null,
    summitTempHigh: summitTemps.length ? Math.max(...summitTemps) : null,
    summitTempLow: summitTemps.length ? Math.min(...summitTemps) : null,
    windAvg: winds.length ? winds.reduce((a, b) => a + b, 0) / winds.length : null,
    windGust: gusts.length ? Math.max(...gusts) : null,
    conditions: dominantCode !== null ? (WMO_WEATHER_CODES[dominantCode] ?? "Unknown") : "Unknown",
  };
}

export default function DayDetailPanel({ date, hourly }: DayDetailPanelProps) {
  const { displayTemp } = useUnit();

  const periods = PERIODS
    .map(p => aggregatePeriod(hourly, date, p.startHour, p.endHour))
    .filter((p): p is PeriodData => p !== null);

  if (periods.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {periods.map((period) => {
        const isPowder = period.snowfall >= 3;
        return (
          <div
            key={period.label}
            className={cn(
              "rounded-lg border p-3",
              isPowder
                ? "border-accent-orange/30 bg-accent-orange/5"
                : "border-border bg-bg-primary"
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                {period.label}
              </span>
              <ConditionsIcon conditions={period.conditions} size={16} />
            </div>

            <div className={cn(
              "text-lg font-bold tabular-nums",
              isPowder ? "text-accent-orange" : "text-accent-blue"
            )}>
              {formatSnowfall(period.snowfall)}
            </div>

            <div className="mt-2 space-y-0.5 text-[11px]">
              {period.summitTempHigh != null && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Summit</span>
                  <span className="tabular-nums text-text-primary">
                    {displayTemp(period.summitTempHigh)} / {displayTemp(period.summitTempLow)}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-text-secondary">Mid</span>
                <span className="tabular-nums text-text-primary">
                  {displayTemp(period.tempHigh)} / {displayTemp(period.tempLow)}
                </span>
              </div>
              {period.baseTempHigh != null && (
                <div className="flex justify-between">
                  <span className="text-text-secondary">Base</span>
                  <span className="tabular-nums text-text-primary">
                    {displayTemp(period.baseTempHigh)} / {displayTemp(period.baseTempLow)}
                  </span>
                </div>
              )}
            </div>

            {period.windAvg != null && (
              <div className="mt-1 text-[11px] text-text-secondary">
                {formatWind(period.windAvg)}
                {period.windGust != null && (
                  <span className="ml-1">(G {formatWind(period.windGust)})</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
