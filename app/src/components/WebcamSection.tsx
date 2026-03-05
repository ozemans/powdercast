"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface Webcam {
  name: string;
  url: string;
  type: "youtube" | "iframe" | "link";
}

interface WebcamSectionProps {
  webcams?: Webcam[];
  webcamUrl?: string | null;
  resortName: string;
}

function extractYoutubeId(url: string): string | null {
  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?/]+)/,
    /youtube\.com\/embed\/([^?/]+)/,
    /youtube\.com\/live\/([^?/]+)/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

function WebcamEmbed({ cam, resortName }: { cam: Webcam; resortName: string }) {
  const youtubeId = extractYoutubeId(cam.url);

  if (youtubeId || cam.type === "youtube") {
    const id = youtubeId || cam.url.split("/").pop();
    return (
      <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "16/9" }}>
        <iframe
          src={`https://www.youtube.com/embed/${id}?autoplay=0&mute=1&rel=0`}
          title={`${resortName} — ${cam.name}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 h-full w-full rounded-lg border border-border"
        />
      </div>
    );
  }

  if (cam.type === "iframe") {
    return (
      <div className="relative w-full overflow-hidden rounded-lg" style={{ aspectRatio: "16/9" }}>
        <iframe
          src={cam.url}
          title={`${resortName} — ${cam.name}`}
          className="absolute inset-0 h-full w-full rounded-lg border border-border"
        />
      </div>
    );
  }

  // Link fallback
  return (
    <a
      href={cam.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-accent-blue/25 bg-accent-blue/5 px-4 py-3 text-sm font-medium text-accent-blue transition-all hover:border-accent-blue/50 hover:bg-accent-blue/10"
    >
      <svg className="h-5 w-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
      </svg>
      <span>{cam.name === "All Cams" ? "View All Webcams ↗" : `${cam.name} ↗`}</span>
    </a>
  );
}

export default function WebcamSection({
  webcams,
  webcamUrl,
  resortName,
}: WebcamSectionProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  // Build cam list: prefer webcams array, fall back to single webcamUrl
  const cams: Webcam[] = webcams && webcams.length > 0
    ? webcams
    : webcamUrl
    ? [{ name: "Live Cam", url: webcamUrl, type: extractYoutubeId(webcamUrl) ? "youtube" : "link" }]
    : [];

  if (cams.length === 0) return null;

  // Separate embeddable cams from link-only cams
  const embeddable = cams.filter((c) => c.type !== "link");
  const links = cams.filter((c) => c.type === "link");
  const activeCam = embeddable[activeIndex] || embeddable[0];

  return (
    <div className="rounded-xl border border-border bg-bg-secondary p-4 sm:p-5">
      <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider text-text-secondary">
        {embeddable.length > 0 ? "Live Webcams" : "Webcams"}
      </h3>

      {/* Tab selector for multiple embeddable cams */}
      {embeddable.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {embeddable.map((cam, i) => (
            <button
              key={cam.url}
              onClick={() => setActiveIndex(i)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                i === activeIndex
                  ? "bg-accent-blue text-white"
                  : "bg-bg-primary text-text-secondary hover:text-text-primary"
              )}
            >
              {cam.name}
            </button>
          ))}
        </div>
      )}

      {/* Active embed */}
      {activeCam && <WebcamEmbed cam={activeCam} resortName={resortName} />}

      {/* Link fallbacks */}
      {links.length > 0 && (
        <div className={embeddable.length > 0 ? "mt-3 space-y-2" : "space-y-2"}>
          {links.map((cam) => (
            <WebcamEmbed key={cam.url} cam={cam} resortName={resortName} />
          ))}
        </div>
      )}
    </div>
  );
}
