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
    """Initialize database tables from schema.sql."""
    schema_path = os.path.join(os.path.dirname(__file__), "db", "schema.sql")
    with open(schema_path, "r") as f:
        schema_sql = f.read()
    conn.executescript(schema_sql)
    conn.commit()
    logger.info("Database schema initialized")


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
