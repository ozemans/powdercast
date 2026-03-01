import { createClient } from "@libsql/client";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:local.db",
  authToken: process.env.TURSO_AUTH_TOKEN,
});

export default db;

export async function initializeDatabase() {
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS resorts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      state_province TEXT NOT NULL,
      country TEXT NOT NULL,
      region TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      elevation_base_ft INTEGER NOT NULL,
      elevation_mid_ft INTEGER NOT NULL,
      elevation_summit_ft INTEGER NOT NULL,
      vertical_drop_ft INTEGER NOT NULL,
      acreage INTEGER DEFAULT 0,
      trail_count INTEGER DEFAULT 0,
      lift_count INTEGER DEFAULT 0,
      pass_affiliation TEXT DEFAULT 'None',
      snowmaking_pct INTEGER DEFAULT 0,
      avg_annual_snowfall_in INTEGER DEFAULT 0,
      website TEXT DEFAULT '',
      snow_report_url TEXT DEFAULT '',
      webcam_url TEXT,
      timezone TEXT NOT NULL,
      operating_season TEXT DEFAULT 'Nov-Apr'
    );

    CREATE TABLE IF NOT EXISTS forecasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resort_id INTEGER NOT NULL,
      model_name TEXT NOT NULL,
      run_time TEXT NOT NULL,
      valid_time TEXT NOT NULL,
      temperature_f REAL,
      wind_speed_mph REAL,
      wind_direction INTEGER,
      precip_liquid_in REAL,
      snowfall_in REAL,
      snow_level_ft REAL,
      freezing_level_ft REAL,
      humidity_pct REAL,
      cloud_cover_pct REAL,
      weather_code INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (resort_id) REFERENCES resorts(id)
    );

    CREATE TABLE IF NOT EXISTS processed_forecasts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resort_id INTEGER NOT NULL,
      valid_time TEXT NOT NULL,
      snowfall_in REAL,
      snowfall_low REAL,
      snowfall_high REAL,
      temperature_f REAL,
      wind_speed_mph REAL,
      wind_gust_mph REAL,
      snow_quality TEXT,
      confidence TEXT,
      weather_code INTEGER,
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (resort_id) REFERENCES resorts(id)
    );

    CREATE TABLE IF NOT EXISTS observations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      resort_id INTEGER NOT NULL,
      station_name TEXT,
      station_triplet TEXT,
      station_elevation_ft INTEGER,
      timestamp TEXT NOT NULL,
      snow_depth_in REAL,
      swe_in REAL,
      temperature_f REAL,
      precip_accum_in REAL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (resort_id) REFERENCES resorts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_forecasts_resort_valid
      ON forecasts(resort_id, valid_time);
    CREATE INDEX IF NOT EXISTS idx_processed_resort_valid
      ON processed_forecasts(resort_id, valid_time);
    CREATE INDEX IF NOT EXISTS idx_observations_resort_time
      ON observations(resort_id, timestamp);
    CREATE INDEX IF NOT EXISTS idx_resorts_slug
      ON resorts(slug);
  `);
}
