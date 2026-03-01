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
} from "recharts";
import type { DailySummary } from "@/lib/types";
import { formatDateShort, getConfidenceLabel } from "@/lib/utils";

interface SnowfallChartProps {
  days: DailySummary[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    payload: {
      date: string;
      snowfall: number;
      confidence: "high" | "medium" | "low";
      range: string;
    };
  }>;
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  return (
    <div
      style={{
        background: "#1A2332",
        border: "1px solid #2A3A52",
        borderRadius: "8px",
        padding: "10px 14px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
      }}
    >
      <div style={{ color: "#E8EDF5", fontSize: "13px", fontWeight: 600 }}>
        {data.date}
      </div>
      <div
        style={{
          color: data.snowfall >= 6 ? "#FF6B35" : "#4A9BD9",
          fontSize: "18px",
          fontWeight: 700,
          marginTop: "2px",
        }}
      >
        {data.snowfall}&quot;
      </div>
      <div
        style={{
          color: "#8B9DC3",
          fontSize: "11px",
          marginTop: "2px",
        }}
      >
        Range: {data.range}
      </div>
      <div
        style={{
          color: "#8B9DC3",
          fontSize: "11px",
          marginTop: "1px",
        }}
      >
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
    date: day.date,
    snowfall: day.snowfall_total,
    confidence: day.confidence,
    range: `${day.snowfall_low}" - ${day.snowfall_high}"`,
  }));

  const maxSnow = Math.max(...data.map((d) => d.snowfall), 4);

  return (
    <div className="h-64 w-full rounded-xl border border-border bg-bg-secondary p-4">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: -12, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#2A3A52"
            vertical={false}
          />
          <XAxis
            dataKey="name"
            tick={{ fill: "#8B9DC3", fontSize: 12 }}
            axisLine={{ stroke: "#2A3A52" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "#8B9DC3", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
            domain={[0, Math.ceil(maxSnow / 2) * 2]}
            tickFormatter={(value: number) => `${value}"`}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(74, 155, 217, 0.08)" }} />
          <Bar dataKey="snowfall" radius={[4, 4, 0, 0]} maxBarSize={48}>
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.snowfall >= 6 ? "#FF6B35" : "#4A9BD9"}
                fillOpacity={
                  entry.confidence === "high"
                    ? 1
                    : entry.confidence === "medium"
                    ? 0.75
                    : 0.5
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
