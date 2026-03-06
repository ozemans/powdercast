import { promises as fs } from "fs";
import path from "path";
import Link from "next/link";
import type { Metadata } from "next";
import type {
  ResortWithConditions,
  ResortForecast,
  ResortObservations,
} from "@/lib/types";
import {
  formatTemp,
  formatSnowfall,
  formatNetChange,
  formatElevation,
  formatWind,
  formatDate,
  getSnowpackStatus,
} from "@/lib/utils";
import ForecastTable from "@/components/ForecastTable";
import SnowfallChart from "@/components/SnowfallChart";
import ModelComparison from "@/components/ModelComparison";
import { ConditionsIcon } from "@/components/ConditionsIcon";
import WebcamSection from "@/components/WebcamSection";
import type { Webcam } from "@/components/WebcamSection";
import RecentConditionsCard from "@/components/RecentConditionsCard";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getResort(
  slug: string
): Promise<ResortWithConditions | null> {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "resorts.json"
    );
    const data = await fs.readFile(filePath, "utf-8");
    const resorts: ResortWithConditions[] = JSON.parse(data);
    return resorts.find((r) => r.slug === slug) || null;
  } catch {
    return null;
  }
}

async function getForecast(slug: string): Promise<ResortForecast | null> {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "forecasts",
      `${slug}.json`
    );
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as ResortForecast;
  } catch {
    return null;
  }
}

async function getObservations(
  slug: string
): Promise<ResortObservations | null> {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "observations",
      `${slug}.json`
    );
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data) as ResortObservations;
  } catch {
    return null;
  }
}

async function getWebcams(slug: string): Promise<Webcam[]> {
  try {
    const filePath = path.join(process.cwd(), "public", "data", "webcams.json");
    const data = await fs.readFile(filePath, "utf-8");
    const all = JSON.parse(data) as Record<string, Webcam[]>;
    return all[slug] || [];
  } catch {
    return [];
  }
}

export async function generateStaticParams() {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "data",
      "resorts.json"
    );
    const data = await fs.readFile(filePath, "utf-8");
    const resorts: ResortWithConditions[] = JSON.parse(data);
    return resorts.map((r) => ({ slug: r.slug }));
  } catch {
    return [];
  }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const resort = await getResort(slug);
  if (!resort) {
    return { title: "Resort Not Found — PowderCast" };
  }
  return {
    title: `${resort.name} Snow Forecast — PowderCast`,
    description: `14-day snow forecast for ${resort.name}, ${resort.state_province}. Current: ${formatSnowfall(resort.snow_24h)} in 24h, ${formatTemp(resort.current_temp)}.`,
  };
}

export default async function ResortPage({ params }: PageProps) {
  const { slug } = await params;
  const [resort, forecast, observations, webcams] = await Promise.all([
    getResort(slug),
    getForecast(slug),
    getObservations(slug),
    getWebcams(slug),
  ]);

  if (!resort) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary">
            Resort Not Found
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            We couldn&apos;t find a resort with that name.
          </p>
          <Link
            href="/"
            className="mt-4 inline-block text-sm text-accent-blue hover:underline"
          >
            &larr; Back to all resorts
          </Link>
        </div>
      </div>
    );
  }

  const isPowderDay = resort.snow_24h >= 6;

  // Calculate blended 14-day total
  const blendedTotal =
    forecast?.blended.daily_summary.reduce(
      (sum, d) => sum + d.snowfall_total,
      0
    ) ?? 0;

  // Melt / snowpack metrics
  const dailySummary = forecast?.blended.daily_summary ?? [];
  const hasMeltData = dailySummary.some((d) => d.melt_total > 0);
  const netSnow7d = dailySummary.reduce(
    (sum, d) => sum + d.net_snow_change,
    0
  );
  const lastDayDepleted = dailySummary.at(-1)?.days_until_depleted ?? null;
  const snowpackStatus = getSnowpackStatus(lastDayDepleted);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-4 text-xs text-text-secondary">
        <Link href="/" className="hover:text-accent-blue">
          Home
        </Link>{" "}
        <span className="mx-1">/</span>{" "}
        <span className="text-text-primary">{resort.name}</span>
      </nav>

      {/* Resort Header */}
      <div className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-brand text-3xl tracking-wider text-text-primary sm:text-4xl">
              {resort.name.toUpperCase()}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {resort.state_province}, {resort.country} &middot; {resort.region}
            </p>
            <div className="mt-2 flex items-center gap-4 text-xs text-text-secondary">
              <span>
                Base: {formatElevation(resort.elevation_base_ft)}
              </span>
              <span>
                Mid: {formatElevation(resort.elevation_mid_ft)}
              </span>
              <span>
                Summit: {formatElevation(resort.elevation_summit_ft)}
              </span>
            </div>
          </div>

          {/* Current conditions card */}
          <div
            className={`flex-shrink-0 rounded-xl border p-4 ${
              isPowderDay
                ? "border-accent-orange/40 bg-accent-orange/5"
                : "border-border bg-bg-secondary"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div
                  className={`text-3xl font-bold tabular-nums ${
                    isPowderDay ? "text-accent-orange" : "text-accent-blue"
                  }`}
                >
                  {formatSnowfall(resort.snow_24h)}
                </div>
                <div className="text-[11px] text-text-secondary">24h</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="text-center">
                <div className="text-xl font-bold tabular-nums text-text-primary">
                  {formatSnowfall(resort.snow_48h)}
                </div>
                <div className="text-[11px] text-text-secondary">48h</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="text-center">
                <div className="text-xl font-bold tabular-nums text-text-primary">
                  {formatSnowfall(resort.snow_14d)}
                </div>
                <div className="text-[11px] text-text-secondary">14d</div>
              </div>
              <div className="h-10 w-px bg-border" />
              <div className="flex items-center gap-2">
                <ConditionsIcon conditions={resort.conditions} size={20} />
                <div>
                  <div className="text-sm font-medium text-text-primary">
                    {formatTemp(resort.current_temp)}
                  </div>
                  <div className="text-[11px] text-text-secondary">
                    {resort.conditions}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Narrative Banner */}
      {forecast?.blended.narrative && (
        <div className="mb-6 rounded-xl border border-accent-blue/20 bg-accent-blue/5 p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <div>
              <p className="text-sm leading-relaxed text-text-primary">
                {forecast.blended.narrative}
              </p>
              {forecast.blended.snow_quality && (
                <span className={`mt-2 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                  forecast.blended.snow_quality === "Fresh Powder"
                    ? "bg-accent-blue/15 text-accent-blue"
                    : forecast.blended.snow_quality === "Packed Powder"
                    ? "bg-accent-green/15 text-accent-green"
                    : forecast.blended.snow_quality === "Spring Conditions"
                    ? "bg-accent-orange/15 text-accent-orange"
                    : forecast.blended.snow_quality === "Wind Affected"
                    ? "bg-text-secondary/15 text-text-secondary"
                    : forecast.blended.snow_quality === "Wet/Heavy"
                    ? "bg-accent-orange/15 text-accent-orange"
                    : "bg-text-secondary/15 text-text-secondary"
                }`}>
                  {forecast.blended.snow_quality}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Snowpack Health Banner */}
      {hasMeltData && lastDayDepleted !== null && (
        <div
          className={`mb-6 rounded-xl border p-4 ${
            snowpackStatus === "stable"
              ? "border-accent-green/20 bg-accent-green/5"
              : snowpackStatus === "watch"
              ? "border-accent-blue/20 bg-accent-blue/5"
              : snowpackStatus === "warning"
              ? "border-accent-orange/20 bg-accent-orange/5"
              : "border-accent-red/20 bg-accent-red/5"
          }`}
        >
          <div className="flex items-center gap-3">
            <svg
              className={`h-5 w-5 flex-shrink-0 ${
                snowpackStatus === "stable"
                  ? "text-accent-green"
                  : snowpackStatus === "watch"
                  ? "text-accent-blue"
                  : snowpackStatus === "warning"
                  ? "text-accent-orange"
                  : "text-accent-red"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
            <p className="text-sm text-text-primary">
              {snowpackStatus === "critical"
                ? `Snowpack may deplete in ${lastDayDepleted} day${lastDayDepleted === 1 ? "" : "s"}`
                : snowpackStatus === "warning"
                ? `Snowpack thinning — ${lastDayDepleted} days until depletion`
                : `Snowpack depletion possible in ${lastDayDepleted} days`}
            </p>
          </div>
        </div>
      )}

      {/* Daily Breakdown */}
      {forecast && forecast.blended.daily_summary.some((d) => d.narrative) && (
        <div className="mb-6 rounded-xl border border-border bg-bg-secondary p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">
            Daily Breakdown
          </h3>
          <div className="space-y-2">
            {forecast.blended.daily_summary.slice(0, 7).map((day, i) => (
              <div key={day.date} className="flex items-start gap-3">
                {day.snowfall_total >= 1 ? (
                  <span className="mt-0.5 flex h-5 min-w-[2.5rem] items-center justify-center rounded-full bg-accent-blue/15 px-1.5 text-[11px] font-bold tabular-nums text-accent-blue">
                    {formatSnowfall(day.snowfall_total)}
                  </span>
                ) : (
                  <span className="mt-0.5 flex h-5 min-w-[2.5rem] items-center justify-center rounded-full bg-bg-primary px-1.5 text-[11px] font-bold tabular-nums text-text-secondary">
                    —
                  </span>
                )}
                <p className="text-sm leading-relaxed text-text-primary">
                  {day.narrative}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: forecast data */}
        <div className="space-y-6 lg:col-span-2">
          {/* 14-Day Forecast */}
          <section>
            <h2 className="mb-3 font-brand text-xl tracking-wider text-text-primary">
              14-DAY FORECAST
            </h2>
            {forecast ? (
              <ForecastTable days={forecast.blended.daily_summary} hourly={forecast.blended.hourly} />
            ) : (
              <div className="rounded-xl border border-border bg-bg-secondary p-6 text-center text-sm text-text-secondary">
                Forecast data not yet available for this resort.
              </div>
            )}
          </section>

          {/* Snowfall Chart */}
          <section>
            <h2 className="mb-3 font-brand text-xl tracking-wider text-text-primary">
              SNOWFALL FORECAST
            </h2>
            {forecast ? (
              <SnowfallChart days={forecast.blended.daily_summary} />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-bg-secondary text-sm text-text-secondary">
                No chart data available
              </div>
            )}
          </section>

          {/* Model Comparison */}
          {forecast && (
            <section>
              <h2 className="mb-3 font-brand text-xl tracking-wider text-text-primary">
                MODEL COMPARISON
              </h2>
              <ModelComparison
                models={forecast.models}
                blendedTotal={blendedTotal}
              />
            </section>
          )}

          {/* SNOTEL Observations */}
          {observations && observations.snotel_stations.length > 0 && (
            <section>
              <h2 className="mb-3 font-brand text-xl tracking-wider text-text-primary">
                SNOTEL OBSERVATIONS
              </h2>
              <div className="space-y-4">
                {observations.snotel_stations.map((station) => (
                  <div
                    key={station.triplet}
                    className="rounded-xl border border-border bg-bg-secondary p-4 sm:p-5"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-semibold text-text-primary">
                          {station.name}
                        </h3>
                        <p className="text-xs text-text-secondary">
                          {formatElevation(station.elevation_ft)} &middot;{" "}
                          {station.distance_mi} mi away
                        </p>
                      </div>
                      <span className="text-[11px] text-text-secondary">
                        {station.triplet}
                      </span>
                    </div>

                    {/* Latest readings */}
                    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <div className="rounded-lg bg-bg-primary p-3">
                        <div className="text-[11px] uppercase text-text-secondary">
                          Snow Depth
                        </div>
                        <div className="text-lg font-bold tabular-nums text-accent-blue">
                          {station.latest.snow_depth_in}&quot;
                        </div>
                      </div>
                      <div className="rounded-lg bg-bg-primary p-3">
                        <div className="text-[11px] uppercase text-text-secondary">
                          SWE
                        </div>
                        <div className="text-lg font-bold tabular-nums text-text-primary">
                          {station.latest.swe_in}&quot;
                        </div>
                      </div>
                      <div className="rounded-lg bg-bg-primary p-3">
                        <div className="text-[11px] uppercase text-text-secondary">
                          Temp
                        </div>
                        <div className="text-lg font-bold tabular-nums text-text-primary">
                          {formatTemp(station.latest.temp_f)}
                        </div>
                      </div>
                      <div className="rounded-lg bg-bg-primary p-3">
                        <div className="text-[11px] uppercase text-text-secondary">
                          Precip Accum
                        </div>
                        <div className="text-lg font-bold tabular-nums text-text-primary">
                          {station.latest.precip_accum_in}&quot;
                        </div>
                      </div>
                    </div>

                    {/* 7-day history mini chart */}
                    <div>
                      <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-text-secondary">
                        7-Day Snow Depth Trend
                      </div>
                      <div className="flex items-end gap-1">
                        {station.history_7d.map((day, i) => {
                          const maxDepth = Math.max(
                            ...station.history_7d.map((d) => d.snow_depth_in)
                          );
                          const height =
                            maxDepth > 0
                              ? (day.snow_depth_in / maxDepth) * 48
                              : 4;
                          return (
                            <div
                              key={day.date}
                              className="flex flex-1 flex-col items-center gap-1"
                            >
                              <div
                                className="w-full rounded-sm bg-accent-blue/60"
                                style={{ height: `${Math.max(height, 2)}px` }}
                                title={`${day.date}: ${day.snow_depth_in}"`}
                              />
                              <span className="text-[9px] text-text-secondary">
                                {i === 0
                                  ? formatDate(day.date).split(",")[0]
                                  : i === station.history_7d.length - 1
                                  ? "Today"
                                  : ""}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-text-secondary">
                Last updated:{" "}
                {new Date(observations.last_updated).toLocaleString()}
              </p>
            </section>
          )}
        </div>

        {/* Right column: resort info */}
        <div className="space-y-6">
          {/* Resort Info Card */}
          <div className="rounded-xl border border-border bg-bg-secondary p-5">
            <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-text-secondary">
              Resort Info
            </h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-secondary">Vertical Drop</dt>
                <dd className="font-medium tabular-nums text-text-primary">
                  {formatElevation(resort.vertical_drop_ft)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Skiable Acreage</dt>
                <dd className="font-medium tabular-nums text-text-primary">
                  {resort.acreage ? resort.acreage.toLocaleString() : '—'} ac
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Trails</dt>
                <dd className="font-medium tabular-nums text-text-primary">
                  {resort.trail_count}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Lifts</dt>
                <dd className="font-medium tabular-nums text-text-primary">
                  {resort.lift_count}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Pass</dt>
                <dd className="font-medium text-text-primary">
                  {resort.pass_affiliation}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Snowmaking</dt>
                <dd className="font-medium tabular-nums text-text-primary">
                  {resort.snowmaking_pct}%
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Avg Annual Snow</dt>
                <dd className="font-medium tabular-nums text-text-primary">
                  {resort.avg_annual_snowfall_in}&quot;
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Season</dt>
                <dd className="font-medium text-text-primary">
                  {resort.operating_season}
                </dd>
              </div>
            </dl>

            <div className="mt-5 flex flex-col gap-2">
              <a
                href={resort.website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-lg bg-accent-blue px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-accent-blue/80"
              >
                Resort Website
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
              <a
                href={resort.snow_report_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border bg-bg-elevated px-4 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-bg-elevated/80"
              >
                Official Snow Report
              </a>
            </div>
          </div>

          {/* Forecast metadata */}
          {forecast && (
            <div className="rounded-xl border border-border bg-bg-secondary p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">
                Forecast Details
              </h3>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Last Updated</dt>
                  <dd className="text-text-primary">
                    {new Date(forecast.last_updated).toLocaleString()}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">Models Used</dt>
                  <dd className="text-text-primary">
                    {Object.keys(forecast.models)
                      .map((m) => m.toUpperCase())
                      .join(", ")}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-secondary">14-Day Blended Total</dt>
                  <dd className="font-bold text-accent-blue">
                    {formatSnowfall(blendedTotal)}
                  </dd>
                </div>
                {hasMeltData && (
                  <div className="flex justify-between">
                    <dt className="text-text-secondary">14-Day Net Snow</dt>
                    <dd
                      className={`font-bold ${
                        netSnow7d >= 0 ? "text-accent-green" : "text-accent-red"
                      }`}
                    >
                      {formatNetChange(netSnow7d)}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {/* Recent Conditions */}
          {forecast?.recent_conditions && (
            <RecentConditionsCard recentConditions={forecast.recent_conditions} />
          )}

          {/* Webcam */}
          <WebcamSection webcams={webcams} webcamUrl={resort.webcam_url} resortName={resort.name} />

          {/* Quick links */}
          <div className="rounded-xl border border-border bg-bg-secondary p-5">
            <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-text-secondary">
              Quick Links
            </h3>
            <div className="space-y-2">
              <Link
                href="/"
                className="flex items-center gap-2 text-sm text-accent-blue hover:underline"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                All Resorts
              </Link>
              <Link
                href="/map"
                className="flex items-center gap-2 text-sm text-accent-blue hover:underline"
              >
                <svg
                  className="h-3 w-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                View Map
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
