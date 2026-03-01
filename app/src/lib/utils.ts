import { WMO_WEATHER_CODES } from "./types";

export function formatTemp(temp: number): string {
  return `${Math.round(temp)}°F`;
}

export function formatSnowfall(inches: number): string {
  if (inches === 0) return '0"';
  if (inches < 1) return `${inches.toFixed(1)}"`;
  return `${Math.round(inches)}"`;
}

export function formatWind(mph: number): string {
  return `${Math.round(mph)} mph`;
}

export function formatElevation(ft: number): string {
  return `${ft.toLocaleString()} ft`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
  });
}

export function getWeatherDescription(code: number): string {
  return WMO_WEATHER_CODES[code] || "Unknown";
}

export function getWeatherIcon(code: number): string {
  if (code >= 71 && code <= 77) return "heavy-snow";
  if (code >= 85 && code <= 86) return "snow-showers";
  if (code >= 61 && code <= 67) return "rain";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code >= 80 && code <= 82) return "rain-showers";
  if (code >= 95) return "thunderstorm";
  if (code >= 45 && code <= 48) return "fog";
  if (code === 3) return "overcast";
  if (code === 2) return "partly-cloudy";
  if (code <= 1) return "clear";
  return "unknown";
}

export function getSnowfallColor(inches: number): string {
  if (inches >= 6) return "#FF6B35"; // powder orange
  return "#4A9BD9"; // standard blue
}

export function getConfidenceLabel(
  confidence: "high" | "medium" | "low"
): string {
  switch (confidence) {
    case "high":
      return "High confidence";
    case "medium":
      return "Medium confidence";
    case "low":
      return "Low confidence";
  }
}

export function windDirectionToCompass(degrees: number): string {
  const directions = [
    "N",
    "NNE",
    "NE",
    "ENE",
    "E",
    "ESE",
    "SE",
    "SSE",
    "S",
    "SSW",
    "SW",
    "WSW",
    "W",
    "WNW",
    "NW",
    "NNW",
  ];
  const index = Math.round(degrees / 22.5) % 16;
  return directions[index];
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}
