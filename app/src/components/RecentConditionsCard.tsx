import type { RecentConditions } from "@/lib/types";

interface RecentConditionsCardProps {
  recentConditions: RecentConditions;
}

export default function RecentConditionsCard({
  recentConditions: rc,
}: RecentConditionsCardProps) {
  const trendColor =
    rc.trend === "gaining"
      ? "text-accent-green"
      : rc.trend === "losing"
      ? "text-accent-red"
      : "text-accent-blue";

  const trendBg =
    rc.trend === "gaining"
      ? "bg-accent-green/15"
      : rc.trend === "losing"
      ? "bg-accent-red/15"
      : "bg-accent-blue/15";

  const trendArrow =
    rc.trend === "gaining" ? "\u2191" : rc.trend === "losing" ? "\u2193" : "\u2192";

  const trendLabel =
    rc.trend === "gaining"
      ? "Building"
      : rc.trend === "losing"
      ? "Melting"
      : "Stable";

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-text-secondary">
          Recent Conditions
        </h3>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${trendBg} ${trendColor}`}
        >
          {trendArrow} {trendLabel}
        </span>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Metric
          label="New Snow (48h)"
          value={rc.new_snow_48h_in}
          suffix='&quot;'
          highlight={rc.new_snow_48h_in >= 1}
        />
        <Metric
          label="New Snow (7d)"
          value={rc.new_snow_7d_in}
          suffix='&quot;'
          highlight={rc.new_snow_7d_in >= 3}
        />
        <Metric
          label="Current Depth"
          value={rc.current_depth_in}
          suffix='&quot;'
        />
        <Metric
          label="48h Change"
          value={rc.depth_change_48h_in}
          suffix='&quot;'
          signed
        />
        <Metric
          label="7d Change"
          value={rc.depth_change_7d_in}
          suffix='&quot;'
          signed
        />
        {rc.melt_48h_in > 0 && (
          <Metric
            label="Melt (48h)"
            value={rc.melt_48h_in}
            suffix='&quot;'
            negative
          />
        )}
      </div>

      <p className="text-sm leading-relaxed text-text-primary">
        {rc.narrative}
      </p>
    </div>
  );
}

function Metric({
  label,
  value,
  suffix,
  highlight,
  signed,
  negative,
}: {
  label: string;
  value: number;
  suffix: string;
  highlight?: boolean;
  signed?: boolean;
  negative?: boolean;
}) {
  let displayValue = value.toFixed(1);
  let colorClass = "text-text-primary";

  if (signed) {
    if (value > 0) {
      displayValue = `+${displayValue}`;
      colorClass = "text-accent-green";
    } else if (value < 0) {
      colorClass = "text-accent-red";
    }
  } else if (highlight) {
    colorClass = "text-accent-blue";
  } else if (negative) {
    colorClass = "text-accent-red";
  }

  return (
    <div className="rounded-lg bg-bg-primary p-3">
      <div className="text-[11px] uppercase text-text-secondary">{label}</div>
      <div
        className={`text-lg font-bold tabular-nums ${colorClass}`}
        dangerouslySetInnerHTML={{ __html: `${displayValue}${suffix}` }}
      />
    </div>
  );
}
