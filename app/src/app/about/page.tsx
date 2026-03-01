import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About — PowderCast",
  description:
    "Learn how PowderCast generates multi-model snow forecasts for North American ski resorts.",
};

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="mb-2 text-3xl font-bold text-text-primary">
        About PowderCast
      </h1>
      <p className="mb-8 text-text-secondary">
        Free, open-source snow forecasting for every mountain.
      </p>

      {/* What it is */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-text-primary">
          What is PowderCast?
        </h2>
        <p className="mb-3 text-sm leading-relaxed text-text-secondary">
          PowderCast is a snow forecasting tool that blends multiple
          weather models to generate accurate snowfall predictions for 200+
          North American ski resorts. Instead of relying on a single model,
          we combine GFS, ECMWF, ICON, and GEM forecasts into a
          confidence-weighted blend that outperforms any individual model.
        </p>
        <p className="text-sm leading-relaxed text-text-secondary">
          The result is a 7-day snowfall forecast for each resort, complete
          with confidence scores and forecast ranges that let you know how
          certain the prediction is. We also integrate SNOTEL ground-truth
          data to validate and improve our forecasts over time.
        </p>
      </section>

      {/* Data Sources */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-text-primary">
          Data Sources
        </h2>
        <div className="space-y-4">
          <DataSourceCard
            name="Open-Meteo"
            url="https://open-meteo.com"
            description="Free weather API providing GFS, ECMWF IFS, ICON, and GEM model data. Forecasts are fetched for the mid-mountain elevation of each resort with 3-hour resolution."
          />
          <DataSourceCard
            name="SNOTEL / NRCS"
            url="https://www.nrcs.usda.gov/wps/portal/wcc/home/snowClimateMonitoring/snowpack/"
            description="USDA Natural Resources Conservation Service SNOTEL network. Automated snow telemetry stations measuring snow depth, snow water equivalent (SWE), temperature, and precipitation across western mountain ranges."
          />
          <DataSourceCard
            name="National Weather Service"
            url="https://www.weather.gov"
            description="NOAA National Weather Service provides supplementary forecast data, avalanche alerts, and winter weather advisories."
          />
        </div>
      </section>

      {/* Methodology */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-text-primary">
          Methodology
        </h2>
        <div className="space-y-4 rounded-xl border border-border bg-bg-secondary p-5">
          <MethodStep
            number={1}
            title="Multi-Model Fetch"
            description="Every 6 hours, we fetch 7-day forecasts from 4 global weather models (GFS, ECMWF, ICON, GEM) for the mid-mountain coordinate of each resort."
          />
          <MethodStep
            number={2}
            title="Model Blending"
            description="Individual model forecasts are blended using performance-weighted averaging. Models that have been more accurate for a given region in the past receive higher weight."
          />
          <MethodStep
            number={3}
            title="Confidence Scoring"
            description="Model agreement determines confidence. When all 4 models agree on snowfall amounts, confidence is HIGH. Significant disagreement yields LOW confidence and wider forecast ranges."
          />
          <MethodStep
            number={4}
            title="SNOTEL Validation"
            description="Forecasts are compared against real-time SNOTEL observations. This feedback loop helps calibrate model weights and identify systematic biases by region and elevation."
          />
          <MethodStep
            number={5}
            title="Daily Summary"
            description="Hourly blended data is aggregated into daily summaries with snowfall totals, temperature ranges, wind conditions, and a human-readable confidence label."
          />
        </div>
      </section>

      {/* Models */}
      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-text-primary">
          Weather Models
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <ModelCard
            name="GFS"
            org="NOAA / NCEP"
            resolution="0.25 deg"
            color="accent-blue"
            description="Global Forecast System. American model, updated 4x daily."
          />
          <ModelCard
            name="ECMWF"
            org="ECMWF"
            resolution="0.25 deg"
            color="accent-green"
            description="European model. Often considered the gold standard for medium-range."
          />
          <ModelCard
            name="ICON"
            org="DWD"
            resolution="0.125 deg"
            color="yellow-500"
            description="German model with higher resolution. Strong for complex terrain."
          />
          <ModelCard
            name="GEM"
            org="ECCC"
            resolution="0.25 deg"
            color="accent-purple"
            description="Canadian model. Valuable for northern and Pacific patterns."
          />
        </div>
      </section>

      {/* Open Source */}
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-bold text-text-primary">
          Open Source
        </h2>
        <p className="mb-4 text-sm leading-relaxed text-text-secondary">
          PowderCast is open source. The full data pipeline, forecast engine,
          and frontend are available on GitHub.
        </p>
        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-bg-secondary border border-border px-4 py-2 text-sm font-medium text-text-primary transition-colors hover:bg-bg-elevated"
        >
          <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
          View on GitHub
        </a>
      </section>
    </div>
  );
}

function DataSourceCard({
  name,
  url,
  description,
}: {
  name: string;
  url: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-4">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-semibold text-accent-blue hover:underline"
      >
        {name}
      </a>
      <p className="mt-1 text-xs leading-relaxed text-text-secondary">
        {description}
      </p>
    </div>
  );
}

function MethodStep({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-accent-blue/20 text-xs font-bold text-accent-blue">
        {number}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <p className="mt-0.5 text-xs leading-relaxed text-text-secondary">
          {description}
        </p>
      </div>
    </div>
  );
}

function ModelCard({
  name,
  org,
  resolution,
  color,
  description,
}: {
  name: string;
  org: string;
  resolution: string;
  color: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-secondary p-4">
      <div className="flex items-center gap-2">
        <div className={`h-3 w-3 rounded-full bg-${color}`} />
        <span className="text-sm font-bold text-text-primary">{name}</span>
        <span className="text-[11px] text-text-secondary">({org})</span>
      </div>
      <p className="mt-1 text-xs text-text-secondary">{description}</p>
      <p className="mt-1 text-[11px] text-text-secondary">
        Resolution: {resolution}
      </p>
    </div>
  );
}
