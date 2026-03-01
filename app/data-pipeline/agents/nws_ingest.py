"""
NWS (National Weather Service) forecast ingest agent.

For each US resort, fetches grid-based forecast data from the NWS API.
Uses a local JSON cache for grid coordinates (they never change for a given lat/lon).
Implements retries with exponential backoff since the NWS API can be flaky.

Canadian resorts are skipped -- NWS is US-only.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import time
from datetime import datetime, timezone

import requests

logger = logging.getLogger(__name__)

NWS_BASE = "https://api.weather.gov"
USER_AGENT = "(PowderCast, powdercast@example.com)"

GRID_CACHE_PATH = os.path.join(os.path.dirname(__file__), "..", ".nws_grid_cache.json")

MAX_RETRIES = 3


def _load_grid_cache() -> dict:
    """Load the NWS grid coordinate cache from disk."""
    if os.path.exists(GRID_CACHE_PATH):
        try:
            with open(GRID_CACHE_PATH, "r") as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            logger.warning("Grid cache file corrupted — starting fresh")
    return {}


def _save_grid_cache(cache: dict) -> None:
    """Persist the grid coordinate cache to disk."""
    with open(GRID_CACHE_PATH, "w") as f:
        json.dump(cache, f, indent=2)


def _nws_get(url: str) -> dict | None:
    """
    Make a GET request to the NWS API with retries and exponential backoff.
    Returns parsed JSON or None on failure.
    """
    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/geo+json",
    }

    for attempt in range(MAX_RETRIES):
        try:
            resp = requests.get(url, headers=headers, timeout=15)
            if resp.status_code == 404:
                logger.debug("NWS 404 for %s — location may not be covered", url)
                return None
            if resp.status_code == 500 or resp.status_code == 503:
                raise requests.RequestException(f"Server error {resp.status_code}")
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            wait = 2 ** attempt
            logger.warning(
                "NWS request failed (attempt %d/%d): %s — retrying in %ds",
                attempt + 1, MAX_RETRIES, e, wait,
            )
            time.sleep(wait)

    logger.error("All retries exhausted for NWS: %s", url)
    return None


def _get_grid_coords(lat: float, lon: float, cache: dict) -> dict | None:
    """
    Get NWS grid coordinates for a lat/lon.
    Uses cache first; fetches from API if not cached.
    Returns {"office": "...", "gridX": ..., "gridY": ...} or None.
    """
    cache_key = f"{lat:.4f},{lon:.4f}"
    if cache_key in cache:
        return cache[cache_key]

    # Round to 4 decimal places for the NWS API
    url = f"{NWS_BASE}/points/{lat:.4f},{lon:.4f}"
    data = _nws_get(url)
    if data is None:
        return None

    try:
        props = data["properties"]
        grid = {
            "office": props["gridId"],
            "gridX": props["gridX"],
            "gridY": props["gridY"],
            "forecast_url": props.get("forecastHourly", ""),
            "forecast_grid_url": props.get("forecastGridData", ""),
        }
        cache[cache_key] = grid
        return grid
    except (KeyError, TypeError) as e:
        logger.warning("Failed to parse NWS grid data: %s", e)
        return None


def _fetch_grid_forecast(grid: dict) -> dict | None:
    """
    Fetch the raw gridded forecast data for a grid point.
    This endpoint returns quantitative data (temperatures, wind, etc.)
    which is more useful than the text-based hourly forecast.
    """
    url = grid.get("forecast_grid_url")
    if not url:
        office = grid["office"]
        gx = grid["gridX"]
        gy = grid["gridY"]
        url = f"{NWS_BASE}/gridpoints/{office}/{gx},{gy}"

    return _nws_get(url)


def _parse_grid_forecast(data: dict) -> list[dict]:
    """
    Parse the NWS grid forecast into a list of observation-like dicts.
    NWS grid data uses ISO 8601 duration format for time periods.
    """
    if not data:
        return []

    try:
        props = data["properties"]
    except (KeyError, TypeError):
        return []

    # Extract temperature data as our primary time series
    temp_data = props.get("temperature", {}).get("values", [])
    wind_speed_data = props.get("windSpeed", {}).get("values", [])
    snow_data = props.get("snowfallAmount", {}).get("values", [])
    precip_data = props.get("quantitativePrecipitation", {}).get("values", [])

    # Build a time-indexed map from temperature (most reliable series)
    results = {}
    for entry in temp_data:
        vt = _parse_nws_time(entry.get("validTime", ""))
        if vt is None:
            continue
        # NWS temps are in Celsius by default in gridded data
        temp_c = entry.get("value")
        temp_f = round(temp_c * 9 / 5 + 32, 1) if temp_c is not None else None
        results[vt] = {
            "valid_time": vt,
            "temperature_f": temp_f,
            "wind_speed_mph": None,
            "snowfall_in": None,
            "precip_in": None,
        }

    # Merge wind speed
    for entry in wind_speed_data:
        vt = _parse_nws_time(entry.get("validTime", ""))
        if vt and vt in results:
            # NWS wind in km/h, convert to mph
            wind_kmh = entry.get("value")
            if wind_kmh is not None:
                results[vt]["wind_speed_mph"] = round(wind_kmh * 0.621371, 1)

    # Merge snowfall
    for entry in snow_data:
        vt = _parse_nws_time(entry.get("validTime", ""))
        if vt and vt in results:
            # NWS snowfall in mm, convert to inches
            snow_mm = entry.get("value")
            if snow_mm is not None:
                results[vt]["snowfall_in"] = round(snow_mm / 25.4, 2)

    # Merge precipitation
    for entry in precip_data:
        vt = _parse_nws_time(entry.get("validTime", ""))
        if vt and vt in results:
            # NWS precip in mm, convert to inches
            precip_mm = entry.get("value")
            if precip_mm is not None:
                results[vt]["precip_in"] = round(precip_mm / 25.4, 2)

    return list(results.values())


def _parse_nws_time(time_str: str) -> str | None:
    """
    Parse NWS ISO 8601 duration time format.
    Example: '2026-02-25T06:00:00+00:00/PT1H' -> '2026-02-25T06:00'
    We only need the start time of the period.
    """
    if not time_str:
        return None
    # Split off the duration part
    start = time_str.split("/")[0]
    try:
        dt = datetime.fromisoformat(start)
        return dt.strftime("%Y-%m-%dT%H:%M")
    except ValueError:
        return None


def _insert_nws_forecasts(
    conn: sqlite3.Connection,
    resort_id: int,
    forecast_data: list[dict],
    run_time: str,
) -> int:
    """Insert NWS forecast data into the forecasts table as model 'nws'."""
    rows = []
    for entry in forecast_data:
        rows.append((
            resort_id,
            "nws",
            run_time,
            entry["valid_time"],
            entry.get("temperature_f"),
            entry.get("wind_speed_mph"),
            None,  # wind_direction
            entry.get("precip_in"),
            entry.get("snowfall_in"),
            None,  # snow_level_ft
            None,  # freezing_level_ft
            None,  # humidity_pct
            None,  # cloud_cover_pct
            None,  # weather_code
        ))

    if not rows:
        return 0

    conn.executemany(
        """
        INSERT INTO forecasts (
            resort_id, model_name, run_time, valid_time,
            temperature_f, wind_speed_mph, wind_direction,
            precip_liquid_in, snowfall_in, snow_level_ft, freezing_level_ft,
            humidity_pct, cloud_cover_pct, weather_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    return len(rows)


def run(conn: sqlite3.Connection, resorts: list[dict] | None = None) -> None:
    """
    Main entry point. Fetch NWS forecasts for all US resorts.
    Canadian resorts are skipped.
    """
    if resorts is None:
        rows = conn.execute("SELECT * FROM resorts").fetchall()
        resorts = [dict(r) for r in rows]

    # Filter to US-only resorts
    us_resorts = [r for r in resorts if r.get("country") == "US"]
    logger.info(
        "NWS ingest: %d US resorts out of %d total (skipping Canadian)",
        len(us_resorts), len(resorts),
    )

    if not us_resorts:
        logger.warning("No US resorts found — skipping NWS ingest")
        return

    # Build slug → resort_id map
    resort_id_map: dict[str, int] = {}
    for r in us_resorts:
        slug = r["slug"]
        row = conn.execute("SELECT id FROM resorts WHERE slug = ?", (slug,)).fetchone()
        if row:
            resort_id_map[slug] = row["id"] if isinstance(row, sqlite3.Row) else row[0]

    # Load grid cache
    grid_cache = _load_grid_cache()
    run_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    total_rows = 0
    success = 0

    for i, resort in enumerate(us_resorts):
        slug = resort["slug"]
        rid = resort_id_map.get(slug)
        if rid is None:
            continue

        logger.info(
            "  [%d/%d] NWS forecast for %s",
            i + 1, len(us_resorts), slug,
        )

        # Step 1: Get grid coordinates
        grid = _get_grid_coords(resort["latitude"], resort["longitude"], grid_cache)
        if grid is None:
            logger.debug("  Could not resolve grid for %s — skipping", slug)
            continue

        # Step 2: Fetch grid forecast
        forecast_raw = _fetch_grid_forecast(grid)
        if forecast_raw is None:
            logger.debug("  No forecast data for %s — skipping", slug)
            continue

        # Step 3: Parse and insert
        parsed = _parse_grid_forecast(forecast_raw)
        if parsed:
            n = _insert_nws_forecasts(conn, rid, parsed, run_time)
            total_rows += n
            success += 1

        conn.commit()

        # NWS rate limit: be very polite (they recommend < 5 req/sec)
        if i < len(us_resorts) - 1:
            time.sleep(0.5)

    # Save updated grid cache
    _save_grid_cache(grid_cache)
    logger.info(
        "NWS ingest complete: %d resorts, %d forecast rows. Grid cache has %d entries.",
        success, total_rows, len(grid_cache),
    )


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from db_helper import get_db, init_schema

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    db = get_db()
    init_schema(db)
    run(db)
    db.close()
