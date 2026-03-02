"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import Link from "next/link";
import type { ResortWithConditions } from "@/lib/types";
import { formatSnowfall } from "@/lib/utils";

// Fix Leaflet default marker icons in Next.js
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)
  ._getIconUrl;
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

// 5-tier snowfall color + size system
function getPinStyle(snow: number): {
  color: string;
  size: number;
  ring: boolean;
} {
  if (snow === 0)
    return { color: "#2D4A6A", size: 20, ring: false }; // muted slate — no snow
  if (snow < 2)
    return { color: "#22D3EE", size: 24, ring: false }; // accent cyan — trace
  if (snow < 6)
    return { color: "#38BDF8", size: 28, ring: false }; // sky blue — good
  if (snow < 12)
    return { color: "#F97316", size: 32, ring: true }; // accent orange — powder
  return { color: "#EF4444", size: 36, ring: true }; // red — epic
}

function createSnowfallIcon(snowfall: number) {
  const { color, size, ring } = getPinStyle(snowfall);
  const label = snowfall > 0 ? `${Math.round(snowfall)}"` : "0";
  const fontSize = size <= 24 ? 9 : size <= 28 ? 10 : 12;

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
        font-size: ${fontSize}px;
        font-weight: 700;
        border: ${ring ? "2px solid rgba(255,255,255,0.5)" : "1.5px solid rgba(255,255,255,0.2)"};
        box-shadow: ${ring ? `0 2px 12px rgba(0,0,0,0.5), 0 0 8px ${color}55` : "0 1px 6px rgba(0,0,0,0.4)"};
        font-family: system-ui, sans-serif;
        letter-spacing: -0.02em;
      ">${label}</div>
    `,
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 4],
  });
}

export default function ResortMap({ resorts, selectedRegion }: ResortMapProps) {
  const filtered = selectedRegion
    ? resorts.filter((r) => r.region === selectedRegion)
    : resorts;

  // Center of CONUS
  const center: [number, number] = [42.5, -110.0];

  useEffect(() => {
    window.dispatchEvent(new Event("resize"));
  }, []);

  return (
    <MapContainer
      center={center}
      zoom={5}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      {/* CartoDB Dark Matter — clean dark tiles that match PowderCast's palette */}
      <TileLayer
        attribution='&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        maxZoom={19}
        subdomains="abcd"
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
                fontFamily:
                  "var(--font-instrument), system-ui, -apple-system, sans-serif",
                minWidth: "190px",
                background: "#0D1E35",
                margin: "-8px -12px",
                padding: "12px 14px",
                borderRadius: "8px",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "14px",
                  marginBottom: "2px",
                  color: "#E6F0FF",
                }}
              >
                {resort.name}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "#4A7396",
                  marginBottom: "10px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {resort.state_province} · {resort.region}
              </div>

              <div
                style={{ display: "flex", gap: "12px", marginBottom: "10px" }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#4A7396",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "2px",
                    }}
                  >
                    24h Snow
                  </div>
                  <div
                    style={{
                      fontSize: "20px",
                      fontWeight: 700,
                      color:
                        resort.snow_24h >= 6
                          ? "#F97316"
                          : resort.snow_24h > 0
                          ? "#22D3EE"
                          : "#4A7396",
                      lineHeight: 1,
                    }}
                  >
                    {formatSnowfall(resort.snow_24h)}
                  </div>
                </div>
                <div style={{ borderLeft: "1px solid rgba(34,211,238,0.1)", paddingLeft: "12px" }}>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#4A7396",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "2px",
                    }}
                  >
                    48h
                  </div>
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color: "#E6F0FF",
                      lineHeight: 1,
                    }}
                  >
                    {formatSnowfall(resort.snow_48h)}
                  </div>
                </div>
                <div style={{ borderLeft: "1px solid rgba(34,211,238,0.1)", paddingLeft: "12px" }}>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#4A7396",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "2px",
                    }}
                  >
                    Temp
                  </div>
                  <div
                    style={{
                      fontSize: "15px",
                      fontWeight: 600,
                      color:
                        resort.current_temp <= 28
                          ? "#22D3EE"
                          : resort.current_temp >= 40
                          ? "#F97316"
                          : "#E6F0FF",
                      lineHeight: 1,
                    }}
                  >
                    {Math.round(resort.current_temp)}°F
                  </div>
                </div>
              </div>

              <Link
                href={`/resort/${resort.slug}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "#22D3EE",
                  textDecoration: "none",
                }}
              >
                View forecast →
              </Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
