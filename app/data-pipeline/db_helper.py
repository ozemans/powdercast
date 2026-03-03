"""
Shared database helper for the PowderCast data pipeline.
Uses sqlite3 for local development. Turso/libSQL integration can be added later.
"""

from __future__ import annotations

import sqlite3
import os
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "local.db")


def get_db() -> sqlite3.Connection:
    """Get a database connection. Uses local SQLite file."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_schema(conn: sqlite3.Connection) -> None:
    """Initialize database tables from schema.sql and run migrations."""
    schema_path = os.path.join(os.path.dirname(__file__), "db", "schema.sql")
    with open(schema_path, "r") as f:
        schema_sql = f.read()
    conn.executescript(schema_sql)
    conn.commit()

    # Phase 2 migrations: add new columns if missing
    _migrate_phase2(conn)
    # Phase 3 migrations: melt forecasting columns
    _migrate_phase3(conn)

    logger.info("Database schema initialized")


def _migrate_phase2(conn: sqlite3.Connection) -> None:
    """Add Phase 2 columns to processed_forecasts if they don't exist."""
    existing = {
        row[1]
        for row in conn.execute("PRAGMA table_info(processed_forecasts)").fetchall()
    }
    migrations = [
        ("snow_level_ft", "REAL"),
        ("downscaled_temp_f", "REAL"),
        ("slr", "REAL"),
    ]
    for col, typ in migrations:
        if col not in existing:
            conn.execute(f"ALTER TABLE processed_forecasts ADD COLUMN {col} {typ}")
            logger.info("Added column processed_forecasts.%s", col)
    conn.commit()


def _migrate_phase3(conn: sqlite3.Connection) -> None:
    """Add Phase 3 melt columns if they don't exist."""
    forecasts_cols = {
        row[1]
        for row in conn.execute("PRAGMA table_info(forecasts)").fetchall()
    }
    processed_cols = {
        row[1]
        for row in conn.execute("PRAGMA table_info(processed_forecasts)").fetchall()
    }
    for col, typ in [
        ("direct_radiation_wm2", "REAL"),
        ("shortwave_radiation_wm2", "REAL"),
        ("snow_depth_in", "REAL"),
    ]:
        if col not in forecasts_cols:
            conn.execute(f"ALTER TABLE forecasts ADD COLUMN {col} {typ}")
            logger.info("Added column forecasts.%s", col)
    for col, typ in [("melt_rate_in_hr", "REAL"), ("net_snow_change_in", "REAL")]:
        if col not in processed_cols:
            conn.execute(f"ALTER TABLE processed_forecasts ADD COLUMN {col} {typ}")
            logger.info("Added column processed_forecasts.%s", col)
    conn.commit()


def get_resort_id(conn: sqlite3.Connection, slug: str) -> Optional[int]:
    """Look up a resort's database ID by slug."""
    row = conn.execute(
        "SELECT id FROM resorts WHERE slug = ?", (slug,)
    ).fetchone()
    return row["id"] if row else None


def get_all_resorts(conn: sqlite3.Connection) -> List[Dict]:
    """Fetch all resorts from the database."""
    rows = conn.execute("SELECT * FROM resorts").fetchall()
    return [dict(r) for r in rows]
