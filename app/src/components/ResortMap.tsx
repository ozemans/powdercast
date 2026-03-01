"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import type { ResortWithConditions } from "@/lib/types";
import { formatSnowfall, formatTemp } from "@/lib/utils";

// Fix Leaflet default marker icons in Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface ResortMapProps {
  resorts: ResortWithConditions[];
  selectedRegion: string | null;
}

function createSnowfallIcon(snowfall: number) {
  const isPowder = snowfall >= 6;
  const color = isPowder ? "#FF6B35" : "#4A9BD9";
  const size = isPowder ? 32 : 26;

  return L.divIcon({
    html: `
      <div style="
        display: flex;
        align-items: center;
        justify-content: center;
        width: ${size}px;
        height: ${size}px;
        border-radius: 50%;
        background: ${color};
        color: white;
        font-size: ${isPowder ? 12 : 10}px;
        font-weight: 700;
        border: 2px solid rgba(255,255,255,0.3);
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        font-family: system-ui, sans-serif;
      ">${Math.round(snowfall)}"</div>
    `,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2)],
  });
}

export default function ResortMap({
  resorts,
  selectedRegion,
}: ResortMapProps) {
  const filtered = selectedRegion
    ? resorts.filter((r) => r.region === selectedRegion)
    : resorts;

  // Center of CONUS
  const center: [number, number] = [42.5, -110.0];

  useEffect(() => {
    // Force Leaflet to recalculate sizes after mount
    window.dispatchEvent(new Event("resize"));
  }, []);

  return (
    <MapContainer
      center={center}
      zoom={5}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='Map data: &copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
        url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
        maxZoom={17}
      />
      {filtered.map((resort) => (
        <Marker
          key={resort.slug}
          position={[resort.latitude, resort.longitude]}
          icon={createSnowfallIcon(resort.snow_24h)}
        >
          <Popup>
            <div
              style={{
                fontFamily: "system-ui, sans-serif",
                minWidth: "180px",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "14px",
                  marginBottom: "4px",
                  color: "#0F1729",
                }}
              >
                {resort.name}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#555",
                  marginBottom: "8px",
                }}
              >
                {resort.state_province} &middot; {resort.region}
              </div>
              <div style={{ display: "flex", gap: "12px", marginBottom: "8px" }}>
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#888",
                      textTransform: "uppercase",
                    }}
                  >
                    24h Snow
                  </div>
                  <div
                    style={{
                      fontSize: "18px",
                      fontWeight: 700,
                      color: resort.snow_24h >= 6 ? "#FF6B35" : "#4A9BD9",
                    }}
                  >
                    {formatSnowfall(resort.snow_24h)}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#888",
                      textTransform: "uppercase",
                    }}
                  >
                    48h
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#333" }}>
                    {formatSnowfall(resort.snow_48h)}
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "#888",
                      textTransform: "uppercase",
                    }}
                  >
                    Temp
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 600, color: "#333" }}>
                    {formatTemp(resort.current_temp)}
                  </div>
                </div>
              </div>
              <Link
                href={`/resort/${resort.slug}`}
                style={{
                  display: "inline-block",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#4A9BD9",
                  textDecoration: "none",
                }}
              >
                View forecast &rarr;
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
