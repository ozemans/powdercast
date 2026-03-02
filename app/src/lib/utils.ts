import { WMO_WEATHER_CODES } from "./types";

export function formatTemp(temp: number | null | undefined): string {
  if (temp == null) return "—";
  return `${Math.round(temp)}°F`;
}

export function formatSnowfall(inches: number | null | undefined): string {
  if (inches == null) return '—';
  if (inches === 0) return '0"';
  if (inches < 1) return `${inches.toFixed(1)}"`;
  return `${Math.round(inches)}"`;
}

export function formatWind(mph: number | null | undefined): string {
  if (mph == null) return "—";
  return `${Math.round(mph)} mph`;
}

export function formatElevation(ft: number | null | undefined): string {
  if (ft == null) return "—";
  return `${ft.toLocaleString()} ft`;
}

// Parse YYYY-MM-DD as local time (avoids UTC-midnight off-by-one in US timezones)
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("T")[0].split("-").map(Number);
  return new Date(year, month - 1, day);
}

// "Mon, Mar 3" — full readable date for table rows and subtitles
export function formatDate(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// "Mon 3" — compact format for chart axis labels and tight spaces
export function formatDateShort(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  return `${weekday} ${date.getDate()}`;
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
