"""
Weighted multi-model forecast blend.

Replaces the Phase 1 simple average with lead-time-dependent and
region-aware model weights. ECMWF gets more weight at longer lead times,
GFS at shorter. GEM gets a boost for Canadian resorts.
"""

from __future__ import annotations

import logging
import sqlite3
from collections import defaultdict
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# Default model weights by lead-time bucket
# Structure: {lead_time_bucket: {model: weight}}
WEIGHT_TABLE = {
    "short": {"gfs": 0.35, "ecmwf": 0.20, "icon": 0.20, "gem": 0.25},   # 0-24h
    "medium": {"gfs": 0.25, "ecmwf": 0.30, "icon": 0.20, "gem": 0.25},  # 24-120h
    "long": {"gfs": 0.15, "ecmwf": 0.35, "icon": 0.20, "gem": 0.30},    # 120h+
}

# Canadian resorts get a GEM boost
CANADA_GEM_BOOST = 0.10


def _get_lead_time_bucket(valid_time_str: str, run_time_str: str) -> str:
    """Determine lead-time bucket from valid_time and run_time."""
    try:
        vt = datetime.fromisoformat(valid_time_str.replace("Z", "+00:00"))
        rt = datetime.fromisoformat(run_time_str.replace("Z", "+00:00"))
        if vt.tzinfo is None:
            vt = vt.replace(tzinfo=timezone.utc)
        if rt.tzinfo is None:
            rt = rt.replace(tzinfo=timezone.utc)
        hours = (vt - rt).total_seconds() / 3600
    except (ValueError, TypeError):
        return "medium"

    if hours <= 24:
        return "short"
    elif hours <= 120:
        return "medium"
    else:
        return "long"


def _get_weights(lead_bucket: str, is_canadian: bool, available_models: set[str]) -> dict[str, float]:
    """Get normalized weights for available models."""
    base = dict(WEIGHT_TABLE.get(lead_bucket, WEIGHT_TABLE["medium"]))

    # Apply Canadian GEM boost
    if is_canadian and "gem" in base:
        boost = CANADA_GEM_BOOST
        base["gem"] += boost
        # Redistribute from others proportionally
        others = [m for m in base if m != "gem"]
        per_other = boost / len(others) if others else 0
        for m in others:
            base[m] = max(0.05, base[m] - per_other)

    # Filter to available models and renormalize
    filtered = {m: w for m, w in base.items() if m in available_models}
    if not filtered:
        # Fallback: equal weights
        return {m: 1.0 / len(available_models) for m in available_models}

    total = sum(filtered.values())
    return {m: w / total for m, w in filtered.items()}


def compute_weighted_blend(
    conn: sqlite3.Connection,
    resorts: list[dict],
    resort_id_map: dict[str, int],
) -> None:
    """
    Compute weighted multi-model blend forecasts and insert into processed_forecasts.

    This replaces the Phase 1 simple-average _compute_blended() function.
    """
    from .elevation import downscale_temperature, compute_snow_level
    from .slr import compute_snowfall

    # Clear old processed forecasts
    conn.execute("DELETE FROM processed_forecasts")

    total_processed = 0

    for resort in resorts:
        slug = resort["slug"]
        rid = resort_id_map.get(slug)
        if rid is None:
            continue

        is_canadian = resort.get("country", "US") == "CA"
        resort_mid_ft = resort.get("elevation_mid_ft", 0)

        # Get latest run_time per model (each model may have a different fetch timestamp)
        latest_runs = conn.execute(
            """
            SELECT model_name, MAX(run_time) as latest
            FROM forecasts WHERE resort_id = ?
            GROUP BY model_name
            """,
            (rid,),
        ).fetchall()
        if not latest_runs:
            continue
        latest_run = max(r["latest"] for r in latest_runs)  # for lead-time calc

        # Fetch each model's data from its own latest run
        rows = []
        for lr in latest_runs:
            model_rows = conn.execute(
                """
                SELECT valid_time, model_name,
                       temperature_f, snowfall_in, precip_liquid_in,
                       wind_speed_mph, wind_direction, freezing_level_ft,
                       humidity_pct, cloud_cover_pct, weather_code
                FROM forecasts
                WHERE resort_id = ? AND model_name = ? AND run_time = ?
                ORDER BY valid_time
                """,
                (rid, lr["model_name"], lr["latest"]),
            ).fetchall()
            rows.extend(model_rows)

        # Group by valid_time
        by_time: dict[str, list[dict]] = defaultdict(list)
        for r in rows:
            by_time[r["valid_time"]].append(dict(r))

        blended_rows = []
        for vt in sorted(by_time.keys()):
            models = by_time[vt]
            available = {m["model_name"] for m in models}
            lead_bucket = _get_lead_time_bucket(vt, latest_run)
            weights = _get_weights(lead_bucket, is_canadian, available)

            # Weighted averages
            temp_sum = 0.0
            temp_weight = 0.0
            precip_sum = 0.0
            precip_weight = 0.0
            wind_sum = 0.0
            wind_weight = 0.0
            wind_max = 0.0
            freezing_levels = []
            humidities = []
            codes = []

            for m in models:
                mn = m["model_name"]
                w = weights.get(mn, 0)
                if w <= 0:
                    continue

                if m["temperature_f"] is not None:
                    temp_sum += m["temperature_f"] * w
                    temp_weight += w
                if m["precip_liquid_in"] is not None:
                    precip_sum += m["precip_liquid_in"] * w
                    precip_weight += w
                if m["wind_speed_mph"] is not None:
                    wind_sum += m["wind_speed_mph"] * w
                    wind_weight += w
                    wind_max = max(wind_max, m["wind_speed_mph"])
                if m["freezing_level_ft"] is not None:
                    freezing_levels.append(m["freezing_level_ft"])
                if m["humidity_pct"] is not None:
                    humidities.append(m["humidity_pct"])
                if m["weather_code"] is not None:
                    codes.append(m["weather_code"])

            temp_avg = (temp_sum / temp_weight) if temp_weight > 0 else None
            precip_avg = (precip_sum / precip_weight) if precip_weight > 0 else 0
            wind_avg = (wind_sum / wind_weight) if wind_weight > 0 else None
            freezing_avg = sum(freezing_levels) / len(freezing_levels) if freezing_levels else None
            humidity_avg = sum(humidities) / len(humidities) if humidities else None
            code = max(set(codes), key=codes.count) if codes else None

            # Apply elevation downscaling to temperature
            # Use model grid elevation from Open-Meteo (stored as resort elevation for now)
            # TODO: store actual model grid elevation during ingest
            model_elev = resort.get("elevation_mid_ft", 0)  # approximate
            downscaled_temp = temp_avg  # Will be corrected with real model elev

            # Compute dynamic SLR-based snowfall
            snowfall, slr = compute_snowfall(precip_avg, temp_avg, wind_avg)

            # Compute snow level
            snow_level = compute_snow_level(freezing_avg, precip_avg)

            # Compute snowfall spread from individual model snowfalls
            model_snows = []
            for m in models:
                if m["precip_liquid_in"] is not None and m["temperature_f"] is not None:
                    sf, _ = compute_snowfall(m["precip_liquid_in"], m["temperature_f"], m.get("wind_speed_mph"))
                    model_snows.append(sf)

            snow_low = min(model_snows) if model_snows else 0
            snow_high = max(model_snows) if model_snows else 0

            spread = snow_high - snow_low
            if spread < 2:
                confidence = "high"
            elif spread <= 5:
                confidence = "medium"
            else:
                confidence = "low"

            blended_rows.append((
                rid, vt,
                round(snowfall, 2), round(snow_low, 2), round(snow_high, 2),
                round(temp_avg, 1) if temp_avg is not None else None,
                round(wind_avg, 1) if wind_avg is not None else None,
                round(wind_max, 1) if wind_max > 0 else None,
                None,  # snow_quality — filled later
                confidence,
                code,
                round(snow_level) if snow_level is not None else None,
                round(downscaled_temp, 1) if downscaled_temp is not None else None,
                round(slr, 1),
            ))

        if blended_rows:
            conn.executemany(
                """
                INSERT INTO processed_forecasts (
                    resort_id, valid_time,
                    snowfall_in, snowfall_low, snowfall_high,
                    temperature_f, wind_speed_mph, wind_gust_mph,
                    snow_quality, confidence, weather_code,
                    snow_level_ft, downscaled_temp_f, slr
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                blended_rows,
            )
            total_processed += 1

    conn.commit()
    logger.info("Weighted blend computed for %d resorts", total_processed)
