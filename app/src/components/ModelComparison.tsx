import type { ModelForecast } from "@/lib/types";
import { formatSnowfall, cn } from "@/lib/utils";

interface ModelComparisonProps {
  models: Record<string, ModelForecast>;
  blendedTotal: number;
}

const MODEL_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  gfs: { bg: "bg-accent-blue", text: "text-accent-blue", label: "GFS" },
  ecmwf: { bg: "bg-accent-green", text: "text-accent-green", label: "ECMWF" },
  icon: { bg: "bg-yellow-500", text: "text-yellow-500", label: "ICON" },
  gem: { bg: "bg-accent-purple", text: "text-accent-purple", label: "GEM" },
};

export default function ModelComparison({
  models,
  blendedTotal,
}: ModelComparisonProps) {
  // Calculate 7-day total for each model
  const modelTotals = Object.entries(models).map(([key, model]) => {
    const total = model.hourly.snowfall.reduce((sum, val) => sum + val, 0);
    const config = MODEL_COLORS[key] || {
      bg: "bg-text-secondary",
      text: "text-text-secondary",
      label: key.toUpperCase(),
    };
    return { key, total, ...config };
  });

  const maxTotal = Math.max(
    ...modelTotals.map((m) => m.total),
    blendedTotal,
    1
  );

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-4 sm:p-5">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-secondary">
        Model Comparison — 7-Day Total
      </h3>

      <div className="space-y-3">
        {modelTotals.map((model) => (
          <div key={model.key} className="flex items-center gap-3">
            <span
              className={cn(
                "w-14 flex-shrink-0 text-xs font-bold",
                model.text
              )}
            >
              {model.label}
            </span>
            <div className="relative flex-1 h-6 rounded-md bg-bg-primary overflow-hidden">
              <div
                className={cn("h-full rounded-md transition-all", model.bg)}
                style={{
                  width: `${Math.max((model.total / maxTotal) * 100, 2)}%`,
                  opacity: 0.8,
                }}
              />
            </div>
            <span className="w-12 flex-shrink-0 text-right text-sm font-bold tabular-nums text-text-primary">
              {formatSnowfall(model.total)}
            </span>
          </div>
        ))}

        {/* Blended line */}
        <div className="mt-1 border-t border-border pt-3">
          <div className="flex items-center gap-3">
            <span className="w-14 flex-shrink-0 text-xs font-bold text-text-primary">
              Blend
            </span>
            <div className="relative flex-1 h-6 rounded-md bg-bg-primary overflow-hidden">
              <div
                className="h-full rounded-md bg-text-primary"
                style={{
                  width: `${Math.max((blendedTotal / maxTotal) * 100, 2)}%`,
                  opacity: 0.3,
                  backgroundImage:
                    "repeating-linear-gradient(90deg, transparent, transparent 4px, rgba(232,237,245,0.3) 4px, rgba(232,237,245,0.3) 8px)",
                }}
              />
            </div>
            <span className="w-12 flex-shrink-0 text-right text-sm font-bold tabular-nums text-text-primary">
              {formatSnowfall(blendedTotal)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
