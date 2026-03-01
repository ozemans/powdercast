"""
SNOTEL observation ingest agent.

For each western US resort, queries the Powderlines API to find the 3 closest
SNOTEL stations and ingests their observation data into the observations table.
Also generates per-resort observation JSON files for the frontend.
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

# States with SNOTEL coverage (western US)
SNOTEL_STATES = {"CO", "UT", "CA", "WA", "OR", "MT", "WY", "ID", "NM", "NV", "AZ"}

POWDERLINES_URL = "https://api.powderlin.es/closest_stations"


def _fetch_stations(lat: float, lon: float) -> list[dict] | None:
    """
    Fetch the 3 nearest SNOTEL stations for a given lat/lon.
    Returns parsed station data or None on failure.
    """
    params = {
        "lat": lat,
        "lng": lon,
        "data": "true",
        "days": 7,
        "count": 3,
    }

    for attempt in range(3):
        try:
            resp = requests.get(POWDERLINES_URL, params=params, timeout=15)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            wait = 2 ** attempt
            logger.warning(
                "Powderlines request failed (attempt %d/3): %s — retrying in %ds",
                attempt + 1, e, wait,
            )
            time.sleep(wait)

    logger.error("All retries exhausted for SNOTEL query at %.4f, %.4f", lat, lon)
    return None


def _parse_station_data(station: dict) -> dict | None:
    """
    Parse a single station response from Powderlines into a normalized dict.
    Station data varies — handle missing fields gracefully.
    """
    try:
        triplet = station.get("triplet", "")
        name = station.get("station_name", station.get("name", "Unknown"))
        elevation = station.get("elevation", 0)
        distance = station.get("distance", 0)

        # The 'data' field contains daily observations
        data_points = station.get("data", [])
        if not data_points:
            return None

        return {
            "name": name,
            "triplet": triplet,
            "elevation_ft": int(elevation) if elevation else 0,
            "distance_mi": round(float(distance), 1) if distance else 0,
            "data": data_points,
        }
    except (TypeError, ValueError) as e:
        logger.debug("Failed to parse station: %s", e)
        return None


def _insert_observations(
    conn: sqlite3.Connection,
    resort_id: int,
    station: dict,
) -> int:
    """
    Insert observation rows for one station. Returns the number of rows inserted.
    """
    rows = []
    for obs in station["data"]:
        # Powderlines uses 'Date' as the timestamp key
        timestamp = obs.get("Date", obs.get("date", ""))
        if not timestamp:
            continue

        rows.append((
            resort_id,
            station["name"],
            station["triplet"],
            station["elevation_ft"],
            timestamp,
            _safe_float(obs.get("Snow Depth (in)", obs.get("snow_depth"))),
            _safe_float(obs.get("Snow Water Equivalent (in)", obs.get("swe"))),
            _safe_float(obs.get("Observed Air Temperature (degrees farenheit)",
                        obs.get("air_temperature"))),
            _safe_float(obs.get("Precipitation Accumulation (in)",
                        obs.get("precip_accumulation"))),
        ))

    if not rows:
        return 0

    conn.executemany(
        """
        INSERT INTO observations (
            resort_id, station_name, station_triplet, station_elevation_ft,
            timestamp, snow_depth_in, swe_in, temperature_f, precip_accum_in
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    return len(rows)


def _safe_float(val) -> float | None:
    """Convert a value to float, returning None if not possible."""
    if val is None:
        return None
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def _build_json_output(
    conn: sqlite3.Connection,
    resorts: list[dict],
    resort_id_map: dict[str, int],
) -> None:
    """
    Build per-resort observation JSON files for the frontend.
    Output goes to public/data/observations/{slug}.json.
    """
    output_dir = os.path.join(
        os.path.dirname(__file__), "..", "..", "public", "data", "observations"
    )
    os.makedirs(output_dir, exist_ok=True)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    count = 0

    for resort in resorts:
        slug = resort["slug"]
        rid = resort_id_map.get(slug)
        if rid is None:
            continue

        rows = conn.execute(
            """
            SELECT station_name, station_triplet, station_elevation_ft,
                   timestamp, snow_depth_in, swe_in, temperature_f, precip_accum_in
            FROM observations
            WHERE resort_id = ?
            ORDER BY station_triplet, timestamp
            """,
            (rid,),
        ).fetchall()

        if not rows:
            continue

        # Group by station
        stations_map: dict[str, dict] = {}
        for r in rows:
            triplet = r["station_triplet"] or "unknown"
            if triplet not in stations_map:
                stations_map[triplet] = {
                    "name": r["station_name"],
                    "triplet": triplet,
                    "elevation_ft": r["station_elevation_ft"],
                    "distance_mi": 0,  # not stored in DB, but available in API response
                    "latest": None,
                    "history_7d": [],
                }

            entry = {
                "date": r["timestamp"],
                "snow_depth_in": r["snow_depth_in"],
                "swe_in": r["swe_in"],
            }
            stations_map[triplet]["history_7d"].append(entry)

            # Track latest observation
            current_latest = stations_map[triplet]["latest"]
            if current_latest is None or r["timestamp"] > current_latest["date"]:
                stations_map[triplet]["latest"] = {
                    "date": r["timestamp"],
                    "snow_depth_in": r["snow_depth_in"],
                    "swe_in": r["swe_in"],
                    "temp_f": r["temperature_f"],
                    "precip_accum_in": r["precip_accum_in"],
                }

        obs_obj = {
            "slug": slug,
            "last_updated": now,
            "snotel_stations": list(stations_map.values()),
        }

        filepath = os.path.join(output_dir, f"{slug}.json")
        with open(filepath, "w") as f:
            json.dump(obs_obj, f, separators=(",", ":"))
        count += 1

    logger.info("Wrote %d observation files to %s", count, output_dir)


def run(conn: sqlite3.Connection, resorts: list[dict] | None = None) -> None:
    """
    Main entry point. Fetch SNOTEL observations for all eligible resorts
    and write JSON output files.
    """
    if resorts is None:
        rows = conn.execute("SELECT * FROM resorts").fetchall()
        resorts = [dict(r) for r in rows]

    # Filter to western US states with SNOTEL coverage
    eligible = [r for r in resorts if r.get("state_province") in SNOTEL_STATES]
    logger.info(
        "SNOTEL ingest: %d eligible resorts out of %d total",
        len(eligible), len(resorts),
    )

    if not eligible:
        logger.warning("No SNOTEL-eligible resorts found — skipping")
        return

    # Build slug → resort_id map
    resort_id_map: dict[str, int] = {}
    for r in resorts:
        slug = r["slug"]
        row = conn.execute("SELECT id FROM resorts WHERE slug = ?", (slug,)).fetchone()
        if row:
            resort_id_map[slug] = row["id"] if isinstance(row, sqlite3.Row) else row[0]

    # Clear previous observation data
    conn.execute("DELETE FROM observations")
    conn.commit()

    total_obs = 0
    for i, resort in enumerate(eligible):
        slug = resort["slug"]
        rid = resort_id_map.get(slug)
        if rid is None:
            continue

        logger.info(
            "  [%d/%d] Fetching SNOTEL for %s",
            i + 1, len(eligible), slug,
        )

        stations = _fetch_stations(resort["latitude"], resort["longitude"])
        if stations is None:
            continue

        for station_raw in stations:
            station = _parse_station_data(station_raw)
            if station is None:
                continue
            n = _insert_observations(conn, rid, station)
            total_obs += n

        conn.commit()

        # Rate limit — be respectful to Powderlines API
        if i < len(eligible) - 1:
            time.sleep(0.3)

    logger.info("Inserted %d total observation rows", total_obs)

    # Generate JSON output for frontend
    logger.info("Generating observation JSON files...")
    _build_json_output(conn, resorts, resort_id_map)


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from db_helper import get_db, init_schema

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    db = get_db()
    init_schema(db)
    run(db)
    db.close()
