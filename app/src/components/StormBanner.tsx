import Link from "next/link";
import type { ResortWithConditions } from "@/lib/types";

interface StormBannerProps {
  resorts: ResortWithConditions[];
}

export default function StormBanner({ resorts }: StormBannerProps) {
  const powderResorts = resorts.filter((r) => r.snow_48h >= 6);

  if (powderResorts.length === 0) return null;

  // Group by region
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
    <div className="relative overflow-hidden rounded-xl border border-accent-orange/30 bg-gradient-to-r from-accent-orange/10 via-accent-orange/5 to-bg-secondary">
      {/* Decorative snow particles */}
      <div className="absolute inset-0 overflow-hidden opacity-10">
        <div className="absolute left-[10%] top-[20%] h-1.5 w-1.5 rounded-full bg-white" />
        <div className="absolute left-[30%] top-[60%] h-1 w-1 rounded-full bg-white" />
        <div className="absolute left-[50%] top-[30%] h-2 w-2 rounded-full bg-white" />
        <div className="absolute left-[70%] top-[70%] h-1 w-1 rounded-full bg-white" />
        <div className="absolute left-[85%] top-[40%] h-1.5 w-1.5 rounded-full bg-white" />
      </div>

      <div className="relative px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-accent-orange/20">
              <svg
                className="h-4 w-4 text-accent-orange"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-accent-orange">
                Storm Alert — Up to {Math.round(maxSnow)}&quot; in 48 hours
              </h3>
              <p className="mt-0.5 text-xs text-text-secondary">
                {powderResorts.length} resort{powderResorts.length !== 1 ? "s" : ""}{" "}
                expecting 6&quot;+ across{" "}
                {topRegions.map((r) => r[0]).join(", ")}
                {topResort && (
                  <>
                    {" "}
                    &mdash;{" "}
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
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg bg-accent-orange/20 px-3 py-1.5 text-xs font-medium text-accent-orange transition-colors hover:bg-accent-orange/30"
          >
            View on map
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
                d="M9 5l7 7-7 7"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
