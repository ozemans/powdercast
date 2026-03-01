"use client";

import { useState, useMemo } from "react";
import dynamic from "next/dynamic";
import type { ResortWithConditions } from "@/lib/types";

// CRITICAL: Leaflet must be loaded client-side only
const ResortMap = dynamic(() => import("@/components/ResortMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-bg-primary">
      <div className="text-center">
        <div className="mb-2 h-8 w-8 animate-spin rounded-full border-2 border-accent-blue border-t-transparent mx-auto" />
        <span className="text-sm text-text-secondary">Loading map...</span>
      </div>
    </div>
  ),
});

interface MapClientProps {
  resorts: ResortWithConditions[];
  regions: string[];
}

export default function MapClient({ resorts, regions }: MapClientProps) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);

  const activeRegions = useMemo(() => {
    const dataRegions = new Set(resorts.map((r) => r.region));
    return regions.filter((r) => dataRegions.has(r));
  }, [resorts, regions]);

  if (resorts.length === 0) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary">
            No Resort Data Available
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            The data pipeline hasn&apos;t run yet.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Region filters */}
      <div className="flex flex-shrink-0 gap-2 overflow-x-auto border-b border-border bg-bg-secondary px-4 py-3">
        <button
          onClick={() => setSelectedRegion(null)}
          className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
            selectedRegion === null
              ? "bg-accent-blue text-white"
              : "bg-bg-elevated text-text-secondary hover:text-text-primary"
          }`}
        >
          All Regions
        </button>
        {activeRegions.map((region) => (
          <button
            key={region}
            onClick={() =>
              setSelectedRegion(selectedRegion === region ? null : region)
            }
            className={`flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              selectedRegion === region
                ? "bg-accent-blue text-white"
                : "bg-bg-elevated text-text-secondary hover:text-text-primary"
            }`}
          >
            {region}
          </button>
        ))}
      </div>

      {/* Map */}
      <div className="flex-1">
        <ResortMap resorts={resorts} selectedRegion={selectedRegion} />
      </div>
    </div>
  );
}
