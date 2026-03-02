import Link from "next/link";
import type { ResortWithConditions } from "@/lib/types";

interface StormBannerProps {
  resorts: ResortWithConditions[];
}

export default function StormBanner({ resorts }: StormBannerProps) {
  const powderResorts = resorts.filter((r) => r.snow_48h >= 6);

  if (powderResorts.length === 0) return null;

  const regionCounts: Record<string, number> = {};
  for (const resort of powderResorts) {
    regionCounts[resort.region] = (regionCounts[resort.region] || 0) + 1;
  }

  const topRegions = Object.entries(regionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const maxSnow = Math.max(...powderResorts.map((r) => r.snow_48h));
  const topResort = powderResorts.find((r) => r.snow_48h === maxSnow);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-accent-orange/20 bg-bg-secondary">
      {/* Orange left accent bar */}
      <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-accent-orange via-accent-orange/70 to-accent-orange/20" />

      {/* Subtle background glow */}
      <div className="absolute inset-0 bg-gradient-to-r from-accent-orange/6 via-transparent to-transparent" />

      <div className="relative px-6 py-5 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            {/* Lightning icon */}
            <div className="mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-accent-orange/12 ring-1 ring-accent-orange/30">
              <svg
                className="h-5 w-5 text-accent-orange"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                  clipRule="evenodd"
                />
              </svg>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-accent-orange">
                Storm Alert
              </span>
              <h3 className="mt-0.5 text-base font-semibold text-text-primary">
                Up to{" "}
                <span className="text-accent-orange">
                  {Math.round(maxSnow)}&quot;
                </span>{" "}
                forecast in 48 hours
              </h3>
              <p className="mt-1 text-sm text-text-secondary">
                <span className="font-medium text-text-primary">
                  {powderResorts.length} resort
                  {powderResorts.length !== 1 ? "s" : ""}
                </span>{" "}
                expecting 6&quot;+ across{" "}
                {topRegions.map((r) => r[0]).join(", ")}
                {topResort && (
                  <>
                    {" · "}
                    <Link
                      href={`/resort/${topResort.slug}`}
                      className="font-medium text-accent-orange hover:underline"
                    >
                      {topResort.name}
                    </Link>{" "}
                    leads
                  </>
                )}
              </p>
            </div>
          </div>

          <Link
            href="/map"
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl border border-accent-orange/30 bg-accent-orange/10 px-4 py-2.5 text-sm font-medium text-accent-orange transition-all hover:border-accent-orange/50 hover:bg-accent-orange/18"
          >
            View Storm Map
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
