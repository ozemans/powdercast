"""
SNOTEL observation ingest agent.

For each western US resort, queries the NRCS AWDB REST API to find the 3 closest
SNOTEL stations and ingests their observation data into the observations table.
Also generates per-resort observation JSON files for the frontend.

Uses: https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1
No authentication required.
"""

from __future__ import annotations

import json
import logging
import math
import os
import sqlite3
import time
from datetime import datetime, timezone, timedelta

import requests

logger = logging.getLogger(__name__)

# States with SNOTEL coverage (western US)
SNOTEL_STATES = {"CO", "UT", "CA", "WA", "OR", "MT", "WY", "ID", "NM", "NV", "AZ"}

AWDB_BASE = "https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1"
STATIONS_URL = f"{AWDB_BASE}/stations"
DATA_URL = f"{AWDB_BASE}/data"

# Elements to fetch
ELEMENTS = "SNWD,WTEQ,TOBS,PREC"

# Max stations to batch in one data request
DATA_BATCH_SIZE = 20


def _haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Compute great-circle distance in miles between two points."""
    R = 3959  # Earth radius in miles
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return R * 2 * math.asin(math.sqrt(a))


def _fetch_all_snotel_stations() -> list[dict]:
    """
    Fetch metadata for all active SNOTEL stations nationally.
    Returns list of station dicts with lat, lon, elevation, triplet, name.
    """
    for attempt in range(3):
        try:
            resp = requests.get(
                STATIONS_URL,
                params={"stationTriplets": "*:*:SNTL", "activeOnly": "true"},
                timeout=30,
            )
            resp.raise_for_status()
            stations = resp.json()
            logger.info("Fetched %d SNOTEL stations from NRCS AWDB", len(stations))
            return stations
        except requests.RequestException as e:
            wait = 2 ** attempt
            logger.warning(
                "AWDB stations request failed (attempt %d/3): %s — retrying in %ds",
                attempt + 1, e, wait,
            )
            time.sleep(wait)

    logger.error("All retries exhausted fetching SNOTEL station list")
    return []


def _find_nearest_stations(
    lat: float,
    lon: float,
    all_stations: list[dict],
    count: int = 3,
    max_miles: float = 50.0,
) -> list[dict]:
    """Find the nearest SNOTEL stations to a given lat/lon."""
    distances = []
    for s in all_stations:
        slat = s.get("latitude")
        slon = s.get("longitude")
        if slat is None or slon is None:
            continue
        d = _haversine_miles(lat, lon, slat, slon)
        if d <= max_miles:
            distances.append((d, s))

    distances.sort(key=lambda x: x[0])
    return [
        {**s, "_distance_mi": round(d, 1)}
        for d, s in distances[:count]
    ]


def _fetch_station_data(triplets: list[str], begin_date: str, end_date: str) -> list[dict]:
    """
    Fetch daily observation data for a batch of stations.
    Returns the parsed JSON response (list of station data objects).
    """
    params = {
        "stationTriplets": ",".join(triplets),
        "elements": ELEMENTS,
        "duration": "DAILY",
        "beginDate": begin_date,
        "endDate": end_date,
    }

    for attempt in range(3):
        try:
            resp = requests.get(DATA_URL, params=params, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            wait = 2 ** attempt
            logger.warning(
                "AWDB data request failed (attempt %d/3): %s — retrying in %ds",
                attempt + 1, e, wait,
            )
            time.sleep(wait)

    logger.error("All retries exhausted fetching SNOTEL data for %d stations", len(triplets))
    return []


def _parse_awdb_response(station_data: dict, station_meta: dict) -> dict | None:
    """
    Parse AWDB data response for one station into normalized format.
    station_data: one entry from the /data response array
    station_meta: the nearby station metadata (includes _distance_mi)
    """
    data_entries = station_data.get("data", [])
    if not data_entries:
        return None

    triplet = station_data.get("stationTriplet", station_meta.get("stationTriplet", ""))
    name = station_meta.get("name", "Unknown")
    elevation = station_meta.get("elevation", 0)
    distance = station_meta.get("_distance_mi", 0)

    # Build a date-keyed dict of observations from all elements
    by_date: dict[str, dict] = {}
    for element_block in data_entries:
        el_info = element_block.get("stationElement", {})
        code = el_info.get("elementCode", "")
        values = element_block.get("values", [])

        for v in values:
            date = v.get("date", "")
            val = v.get("value")
            if not date:
                continue
            if date not in by_date:
                by_date[date] = {}
            by_date[date][code] = val

    if not by_date:
        return None

    # Convert to list of observation dicts
    observations = []
    for date in sorted(by_date.keys()):
        obs = by_date[date]
        observations.append({
            "date": date,
            "snow_depth_in": obs.get("SNWD"),
            "swe_in": obs.get("WTEQ"),
            "temperature_f": obs.get("TOBS"),
            "precip_accum_in": obs.get("PREC"),
        })

    return {
        "name": name,
        "triplet": triplet,
        "elevation_ft": int(elevation) if elevation else 0,
        "distance_mi": distance,
        "data": observations,
    }


def _insert_observations(
    conn: sqlite3.Connection,
    resort_id: int,
    station: dict,
) -> int:
    """Insert observation rows for one station. Returns the number of rows inserted."""
    rows = []
    for obs in station["data"]:
        timestamp = obs.get("date", "")
        if not timestamp:
            continue

        rows.append((
            resort_id,
            station["name"],
            station["triplet"],
            station["elevation_ft"],
            timestamp,
            _safe_float(obs.get("snow_depth_in")),
            _safe_float(obs.get("swe_in")),
            _safe_float(obs.get("temperature_f")),
            _safe_float(obs.get("precip_accum_in")),
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
                    "distance_mi": 0,
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

    # Fetch all SNOTEL stations nationally (one API call)
    all_stations = _fetch_all_snotel_stations()
    if not all_stations:
        logger.error("Could not fetch SNOTEL station list — aborting SNOTEL ingest")
        return

    # Date range: last 7 days
    end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    begin_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")

    # For each resort, find nearest stations and collect triplets
    resort_stations: dict[str, list[dict]] = {}  # slug -> list of station meta
    all_triplets_needed: set[str] = set()

    for resort in eligible:
        nearest = _find_nearest_stations(
            resort["latitude"], resort["longitude"], all_stations, count=3
        )
        if nearest:
            resort_stations[resort["slug"]] = nearest
            for s in nearest:
                all_triplets_needed.add(s["stationTriplet"])

    logger.info(
        "Found %d unique SNOTEL stations for %d resorts",
        len(all_triplets_needed), len(resort_stations),
    )

    # Fetch data for all needed stations in batches
    triplet_list = sorted(all_triplets_needed)
    station_data_map: dict[str, dict] = {}  # triplet -> raw data response

    for i in range(0, len(triplet_list), DATA_BATCH_SIZE):
        batch = triplet_list[i : i + DATA_BATCH_SIZE]
        logger.info(
            "  Fetching SNOTEL data batch %d/%d (%d stations)",
            i // DATA_BATCH_SIZE + 1,
            (len(triplet_list) + DATA_BATCH_SIZE - 1) // DATA_BATCH_SIZE,
            len(batch),
        )

        data_resp = _fetch_station_data(batch, begin_date, end_date)
        for entry in data_resp:
            triplet = entry.get("stationTriplet", "")
            if triplet:
                station_data_map[triplet] = entry

        # Rate limit
        if i + DATA_BATCH_SIZE < len(triplet_list):
            time.sleep(0.5)

    logger.info("Fetched data for %d stations", len(station_data_map))

    # Clear previous observation data
    conn.execute("DELETE FROM observations")
    conn.commit()

    # Insert observations per resort
    total_obs = 0
    for resort in eligible:
        slug = resort["slug"]
        rid = resort_id_map.get(slug)
        if rid is None:
            continue

        nearby = resort_stations.get(slug, [])
        for station_meta in nearby:
            triplet = station_meta["stationTriplet"]
            raw_data = station_data_map.get(triplet)
            if raw_data is None:
                continue

            parsed = _parse_awdb_response(raw_data, station_meta)
            if parsed is None:
                continue

            n = _insert_observations(conn, rid, parsed)
            total_obs += n

        conn.commit()

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
