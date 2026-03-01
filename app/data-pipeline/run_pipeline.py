#!/usr/bin/env python3
"""
PowderCast Data Pipeline Orchestrator.

Runs all ingest agents in sequence:
  1. Seed resorts (from JSON → DB)
  2. Open-Meteo forecasts (4 models → blended → JSON)
  3. SNOTEL observations (western US → JSON)
  4. NWS forecasts (US resorts → DB)

Generates static JSON output in public/data/ for the Next.js frontend.

Usage:
    python run_pipeline.py              # Run full pipeline
    python run_pipeline.py --seed-only  # Only seed resorts
    python run_pipeline.py --skip-nws   # Skip NWS (it's slow)
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone

# Ensure the data-pipeline directory is on the path
sys.path.insert(0, os.path.dirname(__file__))

from db_helper import get_db, init_schema, get_all_resorts
from agents import seed_resorts, open_meteo_ingest, snotel_ingest, nws_ingest

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PROJECT_ROOT = os.path.join(os.path.dirname(__file__), "..")
DATA_DIR = os.path.join(PROJECT_ROOT, "src", "data")
PUBLIC_DATA_DIR = os.path.join(PROJECT_ROOT, "public", "data")

RESORT_FILES = [
    os.path.join(DATA_DIR, "resorts_us.json"),
    os.path.join(DATA_DIR, "resorts_ca.json"),
]

logger = logging.getLogger("powdercast.pipeline")


def _setup_logging(verbose: bool = False) -> None:
    """Configure logging for the pipeline."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s %(levelname)-8s %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    # Quiet down noisy libraries
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("requests").setLevel(logging.WARNING)


def _load_resort_data() -> list[dict]:
    """Load resort data from source JSON files."""
    resorts = []
    for filepath in RESORT_FILES:
        if not os.path.exists(filepath):
            logger.warning("Resort file not found: %s", filepath)
            continue
        with open(filepath, "r") as f:
            data = json.load(f)
        resorts.extend(data)
        logger.info("Loaded %d resorts from %s", len(data), os.path.basename(filepath))
    return resorts


def _ensure_output_dirs() -> None:
    """Create output directories if they don't exist."""
    for subdir in ["forecasts", "observations"]:
        path = os.path.join(PUBLIC_DATA_DIR, subdir)
        os.makedirs(path, exist_ok=True)
    logger.debug("Output directories ready: %s", PUBLIC_DATA_DIR)


def _timed(label: str):
    """Simple context-manager-like timer using a closure."""
    class Timer:
        def __init__(self):
            self.start = None
        def __enter__(self):
            self.start = time.time()
            logger.info("--- %s: started ---", label)
            return self
        def __exit__(self, *args):
            elapsed = time.time() - self.start
            logger.info("--- %s: completed in %.1fs ---", label, elapsed)
    return Timer()


def main() -> None:
    parser = argparse.ArgumentParser(description="PowderCast Data Pipeline")
    parser.add_argument("--seed-only", action="store_true", help="Only seed resorts, skip forecasts")
    parser.add_argument("--skip-nws", action="store_true", help="Skip NWS ingest (it's slow)")
    parser.add_argument("--skip-snotel", action="store_true", help="Skip SNOTEL ingest")
    parser.add_argument("--verbose", "-v", action="store_true", help="Enable debug logging")
    args = parser.parse_args()

    _setup_logging(args.verbose)

    pipeline_start = time.time()
    logger.info("=" * 60)
    logger.info("PowderCast Data Pipeline")
    logger.info("Started at %s", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"))
    logger.info("=" * 60)

    # Verify resort data exists
    resort_data = _load_resort_data()
    if not resort_data:
        logger.error(
            "No resort data found! Expected files at:\n  %s",
            "\n  ".join(RESORT_FILES),
        )
        sys.exit(1)

    logger.info("Total resorts loaded: %d", len(resort_data))

    # Initialize database
    conn = get_db()
    init_schema(conn)
    logger.info("Database initialized at %s", os.path.abspath(conn.execute("PRAGMA database_list").fetchone()[2]))

    # Ensure output directories exist
    _ensure_output_dirs()

    # Step 1: Seed resorts
    with _timed("Seed Resorts"):
        seed_resorts.run(conn)

    if args.seed_only:
        logger.info("--seed-only flag set, stopping after seed")
        conn.close()
        return

    # Reload resorts from DB (now they have IDs)
    db_resorts = get_all_resorts(conn)
    logger.info("Resorts in database: %d", len(db_resorts))

    # Step 2: Open-Meteo forecasts (the core data source)
    with _timed("Open-Meteo Forecast Ingest"):
        try:
            open_meteo_ingest.run(conn, db_resorts)
        except Exception:
            logger.exception("Open-Meteo ingest failed")

    # Step 3: SNOTEL observations
    if not args.skip_snotel:
        with _timed("SNOTEL Observation Ingest"):
            try:
                snotel_ingest.run(conn, db_resorts)
            except Exception:
                logger.exception("SNOTEL ingest failed")
    else:
        logger.info("Skipping SNOTEL ingest (--skip-snotel)")

    # Step 4: NWS forecasts (supplementary, can be slow)
    if not args.skip_nws:
        with _timed("NWS Forecast Ingest"):
            try:
                nws_ingest.run(conn, db_resorts)
            except Exception:
                logger.exception("NWS ingest failed")
    else:
        logger.info("Skipping NWS ingest (--skip-nws)")

    # Summary
    forecast_count = conn.execute("SELECT COUNT(*) FROM forecasts").fetchone()[0]
    processed_count = conn.execute("SELECT COUNT(*) FROM processed_forecasts").fetchone()[0]
    obs_count = conn.execute("SELECT COUNT(*) FROM observations").fetchone()[0]

    conn.close()

    elapsed = time.time() - pipeline_start
    logger.info("=" * 60)
    logger.info("Pipeline complete in %.1fs", elapsed)
    logger.info("  Forecasts:           %d rows", forecast_count)
    logger.info("  Processed forecasts: %d rows", processed_count)
    logger.info("  Observations:        %d rows", obs_count)
    logger.info("  JSON output:         %s", os.path.abspath(PUBLIC_DATA_DIR))
    logger.info("=" * 60)


if __name__ == "__main__":
    main()
