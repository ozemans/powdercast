"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Fuse from "fuse.js";
import type { ResortWithConditions } from "@/lib/types";
import { formatSnowfall, formatTemp } from "@/lib/utils";

interface SearchBarProps {
  resorts: ResortWithConditions[];
  placeholder?: string;
}

export default function SearchBar({
  resorts,
  placeholder = "Search resorts...",
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ResortWithConditions[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fuse = useRef(
    new Fuse(resorts, {
      keys: [
        { name: "name", weight: 0.6 },
        { name: "state_province", weight: 0.2 },
        { name: "region", weight: 0.2 },
      ],
      threshold: 0.35,
      includeScore: true,
    })
  );

  // Update fuse index when resorts change
  useEffect(() => {
    fuse.current = new Fuse(resorts, {
      keys: [
        { name: "name", weight: 0.6 },
        { name: "state_province", weight: 0.2 },
        { name: "region", weight: 0.2 },
      ],
      threshold: 0.35,
      includeScore: true,
    });
  }, [resorts]);

  const handleSearch = useCallback(
    (value: string) => {
      setQuery(value);
      if (value.trim().length === 0) {
        setResults([]);
        setIsOpen(false);
        return;
      }
      const fuseResults = fuse.current.search(value).slice(0, 8);
      setResults(fuseResults.map((r) => r.item));
      setIsOpen(fuseResults.length > 0);
      setSelectedIndex(-1);
    },
    []
  );

  const navigateToResort = useCallback(
    (slug: string) => {
      setQuery("");
      setIsOpen(false);
      router.push(`/resort/${slug}`);
    },
    [router]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      navigateToResort(results[selectedIndex].slug);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative w-full max-w-xl" ref={dropdownRef}>
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder}
          className="w-full rounded-xl border border-border bg-bg-secondary py-3 pl-10 pr-4 text-sm text-text-primary placeholder-text-secondary outline-none transition-colors focus:border-accent-blue focus:ring-1 focus:ring-accent-blue"
        />
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute mt-2 w-full overflow-hidden rounded-xl border border-border bg-bg-secondary shadow-2xl">
          {results.map((resort, index) => (
            <button
              key={resort.slug}
              onClick={() => navigateToResort(resort.slug)}
              className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${
                index === selectedIndex
                  ? "bg-bg-elevated"
                  : "hover:bg-bg-elevated"
              }`}
            >
              <div>
                <div className="text-sm font-medium text-text-primary">
                  {resort.name}
                </div>
                <div className="text-xs text-text-secondary">
                  {resort.state_province} &middot; {resort.region}
                </div>
              </div>
              <div className="flex items-center gap-3 text-right">
                <span
                  className={`text-sm font-bold tabular-nums ${
                    resort.snow_24h >= 6
                      ? "text-accent-orange"
                      : "text-accent-blue"
                  }`}
                >
                  {formatSnowfall(resort.snow_24h)}
                </span>
                <span className="text-xs text-text-secondary tabular-nums">
                  {formatTemp(resort.current_temp)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
