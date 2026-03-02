"use client";

import { useState, useMemo } from "react";
import type { ResortWithConditions } from "@/lib/types";
import SearchBar from "@/components/SearchBar";
import ResortCard from "@/components/ResortCard";
import StormBanner from "@/components/StormBanner";

interface HomeClientProps {
  resorts: ResortWithConditions[];
  regions: string[];
}

export default function HomeClient({ resorts, regions }: HomeClientProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [searchActive, setSearchActive] = useState(false);

  // Top snowfall resorts (top 8 by 24h snow)
  const topSnowfall = useMemo(
    () => [...resorts].sort((a, b) => b.snow_24h - a.snow_24h).slice(0, 8),
    [resorts]
  );

  // Filtered resorts for "All Resorts" section
  const filteredResorts = useMemo(
    () =>
      selectedRegion
        ? resorts.filter((r) => r.region === selectedRegion)
        : resorts,
    [resorts, selectedRegion]
  );

  // Get unique regions from data, preserving canonical order
  const activeRegions = useMemo(() => {
    const dataRegions = new Set(resorts.map((r) => r.region));
    return regions.filter((r) => dataRegions.has(r));
  }, [resorts, regions]);

  if (resorts.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-3 text-4xl">&#9731;</div>
          <h2 className="text-lg font-semibold text-text-primary">
            No Resort Data Available
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            The data pipeline hasn&apos;t run yet. Check back soon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Hero / Search */}
      <div className="mb-10 text-center">
        <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent-blue">
          Multi-Model · SNOTEL-Validated · 257 Resorts
        </p>
        <h1 className="mb-3 font-brand text-5xl tracking-widest text-text-primary sm:text-6xl">
          KNOW BEFORE YOU GO
        </h1>
        <p className="mb-7 text-sm text-text-secondary">
          Blended GFS · ECMWF · ICON · GEM forecasts for North American ski resorts
        </p>
        <div
          className="mx-auto"
          onFocus={() => setSearchActive(true)}
          onBlur={() => setTimeout(() => setSearchActive(false), 200)}
        >
          <SearchBar resorts={resorts} placeholder="Search resorts by name, state, or region..." />
        </div>
      </div>

      {/* Storm Banner */}
      {!searchActive && (
        <>
          <div className="mb-8">
            <StormBanner resorts={resorts} />
          </div>

          {/* Top Snowfall Next 24 Hours */}
          <section className="mb-10">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-brand text-2xl tracking-widest text-text-primary">
                TOP SNOWFALL — 24H
              </h2>
              <span className="text-xs text-text-secondary">
                {topSnowfall.length} resorts
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {topSnowfall.map((resort) => (
                <ResortCard key={resort.slug} resort={resort} />
              ))}
            </div>
          </section>

          {/* Browse by Region */}
          <section className="mb-10">
            <h2 className="mb-4 font-brand text-2xl tracking-widest text-text-primary">
              BROWSE BY REGION
            </h2>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedRegion(null)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  selectedRegion === null
                    ? "bg-accent-blue/15 text-accent-blue ring-1 ring-accent-blue/40"
                    : "border border-border bg-bg-secondary text-text-secondary hover:border-accent-blue/20 hover:bg-bg-elevated hover:text-text-primary"
                }`}
              >
                All Regions
              </button>
              {activeRegions.map((region) => {
                const count = resorts.filter((r) => r.region === region).length;
                return (
                  <button
                    key={region}
                    onClick={() =>
                      setSelectedRegion(
                        selectedRegion === region ? null : region
                      )
                    }
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      selectedRegion === region
                        ? "bg-accent-blue/15 text-accent-blue ring-1 ring-accent-blue/40"
                        : "border border-border bg-bg-secondary text-text-secondary hover:border-accent-blue/20 hover:bg-bg-elevated hover:text-text-primary"
                    }`}
                  >
                    {region}{" "}
                    <span className="opacity-50">({count})</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* All Resorts */}
          <section>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-brand text-2xl tracking-widest text-text-primary">
                {selectedRegion ? selectedRegion.toUpperCase() : "ALL RESORTS"}
              </h2>
              <span className="text-xs text-text-secondary">
                {filteredResorts.length} resort{filteredResorts.length !== 1 ? "s" : ""}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredResorts.map((resort) => (
                <ResortCard key={resort.slug} resort={resort} />
              ))}
            </div>
            {filteredResorts.length === 0 && (
              <div className="rounded-xl border border-border bg-bg-secondary p-12 text-center">
                <p className="text-sm text-text-secondary">
                  No resorts found in this region.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
