"use client";

import { useUnit } from "@/contexts/UnitContext";

export function UnitToggle() {
  const { tempUnit, setTempUnit } = useUnit();

  return (
    <div className="flex items-center rounded-lg border border-border bg-bg-primary overflow-hidden text-xs font-medium">
      <button
        onClick={() => setTempUnit("F")}
        className={`px-2.5 py-1 transition-colors ${
          tempUnit === "F"
            ? "bg-accent-blue/15 text-accent-blue"
            : "text-text-secondary hover:text-text-primary"
        }`}
      >
        °F
      </button>
      <div className="w-px h-4 bg-border" />
      <button
        onClick={() => setTempUnit("C")}
        className={`px-2.5 py-1 transition-colors ${
          tempUnit === "C"
            ? "bg-accent-blue/15 text-accent-blue"
            : "text-text-secondary hover:text-text-primary"
        }`}
      >
        °C
      </button>
    </div>
  );
}
