"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ErrorBar,
} from "recharts";
import type { DailySummary } from "@/lib/types";
import { formatDateShort, formatDate, getConfidenceLabel } from "@/lib/utils";

interface SnowfallChartProps {
  days: DailySummary[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      date: string;
      fullDate: string;
      snowfall: number;
      snowLow: number;
      snowHigh: number;
      confidence: "high" | "medium" | "low";
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  return (
    <div
      style={{
        background: "#0D1E35",
        border: "1px solid rgba(34,211,238,0.15)",
        borderRadius: "10px",
        padding: "10px 14px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ color: "#E6F0FF", fontSize: "13px", fontWeight: 600 }}>
        {data.fullDate}
      </div>
      <div
        style={{
          color: data.snowfall >= 6 ? "#F97316" : "#22D3EE",
          fontSize: "22px",
          fontWeight: 700,
          marginTop: "2px",
          fontFamily: "var(--font-bebas)",
          letterSpacing: "0.05em",
        }}
      >
        {data.snowfall}&quot;
      </div>
      <div style={{ color: "#4A7396", fontSize: "11px", marginTop: "2px" }}>
        Range: {data.snowLow}&quot; – {data.snowHigh}&quot;
      </div>
      <div style={{ color: "#4A7396", fontSize: "11px", marginTop: "1px" }}>
        {getConfidenceLabel(data.confidence)}
      </div>
    </div>
  );
}

export default function SnowfallChart({ days }: SnowfallChartProps) {
  if (!days || days.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-bg-secondary text-sm text-text-secondary">
        No forecast data available
      </div>
    );
  }

  const data = days.map((day) => ({
    name: formatDateShort(day.date),
    fullDate: formatDate(day.date),
    date: day.date,
    snowfall: day.snowfall_total,
    snowLow: day.snowfall_low,
    snowHigh: day.snowfall_high,
    confidence: day.confidence,
    // ErrorBar expects [minus, plus] — show spread above and below
    errorRange: [
      Math.max(0, day.snowfall_total - day.snowfall_low),
      Math.max(0, day.snowfall_high - day.snowfall_total),
    ],
  }));

  const maxSnow = Math.max(...data.map((d) => d.snowHigh), 4);

  return (
    <div className="h-64 w-full rounded-xl border border-border bg-bg-secondary p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 12, right: 8, left: -12, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(34,211,238,0.07)"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "#4A7396", fontSize: 11 }}
            axisLine={{ stroke: "rgba(34,211,238,0.1)" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#4A7396", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            domain={[0, Math.ceil(maxSnow / 2) * 2]}
            tickFormatter={(value: number) => `${value}"`}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(34,211,238,0.05)" }}
          />
          <Bar dataKey="snowfall" radius={[4, 4, 0, 0]} maxBarSize={48}>
            <ErrorBar
              dataKey="errorRange"
              width={4}
              strokeWidth={1.5}
              stroke="rgba(255,255,255,0.25)"
            />
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.snowfall >= 6 ? "#F97316" : "#22D3EE"}
                fillOpacity={
                  entry.confidence === "high"
                    ? 0.9
                    : entry.confidence === "medium"
                    ? 0.65
                    : 0.4
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
