"""
Seed resorts table from JSON data files.
Reads src/data/resorts_us.json and src/data/resorts_ca.json and upserts into the resorts table.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3

logger = logging.getLogger(__name__)

# Path from data-pipeline/agents/ up to project root, then into src/data/
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "src", "data")

RESORT_FILES = ["resorts_us.json", "resorts_ca.json"]


def _load_resorts() -> list[dict]:
    """Load resort data from all JSON source files."""
    resorts = []
    for filename in RESORT_FILES:
        filepath = os.path.join(DATA_DIR, filename)
        if not os.path.exists(filepath):
            logger.warning("Resort file not found: %s — skipping", filepath)
            continue
        with open(filepath, "r") as f:
            data = json.load(f)
        resorts.extend(data)
        logger.info("Loaded %d resorts from %s", len(data), filename)
    return resorts


def _upsert_resort(conn: sqlite3.Connection, resort: dict) -> None:
    """Insert or update a single resort record."""
    conn.execute(
        """
        INSERT INTO resorts (
            name, slug, state_province, country, region,
            latitude, longitude,
            elevation_base_ft, elevation_mid_ft, elevation_summit_ft,
            vertical_drop_ft, acreage, trail_count, lift_count,
            pass_affiliation, snowmaking_pct, avg_annual_snowfall_in,
            website, snow_report_url, webcam_url, timezone, operating_season
        ) VALUES (
            :name, :slug, :state_province, :country, :region,
            :latitude, :longitude,
            :elevation_base_ft, :elevation_mid_ft, :elevation_summit_ft,
            :vertical_drop_ft, :acreage, :trail_count, :lift_count,
            :pass_affiliation, :snowmaking_pct, :avg_annual_snowfall_in,
            :website, :snow_report_url, :webcam_url, :timezone, :operating_season
        )
        ON CONFLICT(slug) DO UPDATE SET
            name = excluded.name,
            state_province = excluded.state_province,
            country = excluded.country,
            region = excluded.region,
            latitude = excluded.latitude,
            longitude = excluded.longitude,
            elevation_base_ft = excluded.elevation_base_ft,
            elevation_mid_ft = excluded.elevation_mid_ft,
            elevation_summit_ft = excluded.elevation_summit_ft,
            vertical_drop_ft = excluded.vertical_drop_ft,
            acreage = excluded.acreage,
            trail_count = excluded.trail_count,
            lift_count = excluded.lift_count,
            pass_affiliation = excluded.pass_affiliation,
            snowmaking_pct = excluded.snowmaking_pct,
            avg_annual_snowfall_in = excluded.avg_annual_snowfall_in,
            website = excluded.website,
            snow_report_url = excluded.snow_report_url,
            webcam_url = excluded.webcam_url,
            timezone = excluded.timezone,
            operating_season = excluded.operating_season
        """,
        {
            "name": resort["name"],
            "slug": resort["slug"],
            "state_province": resort["state_province"],
            "country": resort["country"],
            "region": resort.get("region", ""),
            "latitude": resort["latitude"],
            "longitude": resort["longitude"],
            "elevation_base_ft": resort.get("elevation_base_ft", 0),
            "elevation_mid_ft": resort.get("elevation_mid_ft", 0),
            "elevation_summit_ft": resort.get("elevation_summit_ft", 0),
            "vertical_drop_ft": resort.get("vertical_drop_ft", 0),
            "acreage": resort.get("acreage", 0),
            "trail_count": resort.get("trail_count", 0),
            "lift_count": resort.get("lift_count", 0),
            "pass_affiliation": resort.get("pass_affiliation", "None"),
            "snowmaking_pct": resort.get("snowmaking_pct", 0),
            "avg_annual_snowfall_in": resort.get("avg_annual_snowfall_in", 0),
            "website": resort.get("website", ""),
            "snow_report_url": resort.get("snow_report_url", ""),
            "webcam_url": resort.get("webcam_url"),
            "timezone": resort.get("timezone", "America/Denver"),
            "operating_season": resort.get("operating_season", "Nov-Apr"),
        },
    )


def run(conn: sqlite3.Connection) -> None:
    """Seed all resorts into the database."""
    resorts = _load_resorts()
    if not resorts:
        logger.error("No resort data found — cannot seed database")
        return

    count = 0
    for resort in resorts:
        try:
            _upsert_resort(conn, resort)
            count += 1
        except Exception:
            logger.exception("Failed to upsert resort: %s", resort.get("slug", "?"))
    conn.commit()
    logger.info("Seeded %d / %d resorts", count, len(resorts))


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from db_helper import get_db, init_schema

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    conn = get_db()
    init_schema(conn)
    run(conn)
    conn.close()
