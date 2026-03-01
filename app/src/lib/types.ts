export interface Resort {
  id: number;
  name: string;
  slug: string;
  state_province: string;
  country: string;
  region: string;
  latitude: number;
  longitude: number;
  elevation_base_ft: number;
  elevation_mid_ft: number;
  elevation_summit_ft: number;
  vertical_drop_ft: number;
  acreage: number;
  trail_count: number;
  lift_count: number;
  pass_affiliation: string;
  snowmaking_pct: number;
  avg_annual_snowfall_in: number;
  website: string;
  snow_report_url: string;
  webcam_url: string | null;
  timezone: string;
  operating_season: string;
}

export interface HourlyForecast {
  time: string;
  temperature_2m: number;
  snowfall: number;
  precipitation: number;
  snow_depth: number;
  freezing_level_height: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  cloud_cover: number;
  weather_code: number;
}

export interface ModelForecast {
  hourly: {
    time: string[];
    temperature_2m: number[];
    snowfall: number[];
    precipitation: number[];
    snow_depth: number[];
    freezing_level_height: number[];
    wind_speed_10m: number[];
    wind_direction_10m: number[];
    cloud_cover: number[];
    weather_code: number[];
  };
}

export interface DailySummary {
  date: string;
  snowfall_total: number;
  snowfall_low: number;
  snowfall_high: number;
  temp_high: number;
  temp_low: number;
  wind_avg: number;
  wind_gust: number;
  conditions: string;
  confidence: "high" | "medium" | "low";
}

export interface ResortForecast {
  slug: string;
  last_updated: string;
  models: Record<string, ModelForecast>;
  blended: {
    hourly: {
      time: string[];
      snowfall: number[];
      temperature_2m: number[];
      confidence: string[];
    };
    daily_summary: DailySummary[];
  };
}

export interface SnotelStation {
  name: string;
  triplet: string;
  elevation_ft: number;
  distance_mi: number;
  latest: {
    date: string;
    snow_depth_in: number;
    swe_in: number;
    temp_f: number;
    precip_accum_in: number;
  };
  history_7d: Array<{
    date: string;
    snow_depth_in: number;
    swe_in: number;
  }>;
}

export interface ResortObservations {
  slug: string;
  last_updated: string;
  snotel_stations: SnotelStation[];
}

export interface ResortWithConditions extends Resort {
  snow_24h: number;
  snow_48h: number;
  snow_7d: number;
  current_temp: number;
  conditions: string;
}

export type Region =
  | "Pacific Northwest"
  | "California / Sierra"
  | "Northern Rockies"
  | "Central Rockies"
  | "Wasatch / Utah"
  | "Southwest"
  | "Midwest"
  | "Northeast / New England"
  | "Southeast"
  | "British Columbia"
  | "Alberta"
  | "Eastern Canada";

export const REGIONS: Region[] = [
  "Pacific Northwest",
  "California / Sierra",
  "Northern Rockies",
  "Central Rockies",
  "Wasatch / Utah",
  "Southwest",
  "Midwest",
  "Northeast / New England",
  "Southeast",
  "British Columbia",
  "Alberta",
  "Eastern Canada",
];

export const WMO_WEATHER_CODES: Record<number, string> = {
  0: "Clear",
  1: "Mainly Clear",
  2: "Partly Cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime Fog",
  51: "Light Drizzle",
  53: "Drizzle",
  55: "Heavy Drizzle",
  56: "Light Freezing Drizzle",
  57: "Freezing Drizzle",
  61: "Light Rain",
  63: "Rain",
  65: "Heavy Rain",
  66: "Light Freezing Rain",
  67: "Freezing Rain",
  71: "Light Snow",
  73: "Snow",
  75: "Heavy Snow",
  77: "Snow Grains",
  80: "Light Rain Showers",
  81: "Rain Showers",
  82: "Heavy Rain Showers",
  85: "Light Snow Showers",
  86: "Heavy Snow Showers",
  95: "Thunderstorm",
  96: "Thunderstorm + Hail",
  99: "Thunderstorm + Heavy Hail",
};
