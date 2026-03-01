"""
Bias correction using SNOTEL observations.

Compares recent forecasts to SNOTEL observations and computes additive
(temperature) and multiplicative (precipitation) corrections.

NOTE: Requires accumulated pipeline history (≥3 days) to be meaningful.
For now this module computes and stores correction factors but only
applies them when sufficient history exists.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3

logger = logging.getLogger(__name__)

CACHE_PATH = os.path.join(os.path.dirname(__file__), "..", "bias_cache.json")
MIN_HISTORY_DAYS = 3


def compute_bias_factors(conn: sqlite3.Connection) -> dict[str, dict]:
    """
    Compute per-resort bias correction factors from forecast vs observation comparison.

    Returns dict of {slug: {"temp_bias": float, "precip_ratio": float, "days": int}}
    """
    # Count distinct dates in observations to check if we have enough history
    date_count = conn.execute(
        "SELECT COUNT(DISTINCT date(timestamp)) FROM observations"
    ).fetchone()[0]

    if date_count < MIN_HISTORY_DAYS:
        logger.info(
            "Only %d days of observation history (need %d) — skipping bias correction",
            date_count, MIN_HISTORY_DAYS,
        )
        return {}

    # For each resort with SNOTEL data, compare forecast temp to observed temp
    results: dict[str, dict] = {}

    resorts_with_obs = conn.execute(
        """
        SELECT DISTINCT r.slug, r.id
        FROM resorts r
        JOIN observations o ON o.resort_id = r.id
        """
    ).fetchall()

    for row in resorts_with_obs:
        slug = row["slug"]
        rid = row["id"]

        # Get average observed temperature
        obs_temp = conn.execute(
            "SELECT AVG(temperature_f) FROM observations WHERE resort_id = ? AND temperature_f IS NOT NULL",
            (rid,),
        ).fetchone()[0]

        # Get average forecast temperature for same period
        fcst_temp = conn.execute(
            """
            SELECT AVG(temperature_f)
            FROM processed_forecasts
            WHERE resort_id = ? AND temperature_f IS NOT NULL
            """,
            (rid,),
        ).fetchone()[0]

        temp_bias = 0.0
        if obs_temp is not None and fcst_temp is not None:
            temp_bias = round(fcst_temp - obs_temp, 1)

        results[slug] = {
            "temp_bias": temp_bias,
            "precip_ratio": 1.0,  # Need more history for precip correction
            "days": date_count,
        }

    return results


def save_bias_cache(factors: dict[str, dict]) -> None:
    """Save bias correction factors to disk."""
    with open(CACHE_PATH, "w") as f:
        json.dump(factors, f, indent=2)
    logger.info("Saved bias factors for %d resorts to %s", len(factors), CACHE_PATH)


def load_bias_cache() -> dict[str, dict]:
    """Load bias correction factors from disk."""
    if not os.path.exists(CACHE_PATH):
        return {}
    with open(CACHE_PATH) as f:
        return json.load(f)


def run(conn: sqlite3.Connection) -> dict[str, dict]:
    """
    Compute and cache bias correction factors. Returns the factors dict.
    """
    factors = compute_bias_factors(conn)
    if factors:
        save_bias_cache(factors)
    return factors
