"""
Open-Meteo forecast ingest agent.

Pulls 14-day hourly forecasts from 6 weather models (GFS, ECMWF, ICON, GEM,
HRRR, NBM) for every resort, inserts raw data into the forecasts table, then
computes blended (multi-model average) forecasts into processed_forecasts.
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
import time
from datetime import datetime, timezone, timedelta
from collections import defaultdict

import requests

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model endpoints — Open-Meteo requires NO API key
# ---------------------------------------------------------------------------
MODELS = {
    "gfs": "https://api.open-meteo.com/v1/gfs",
    "ecmwf": "https://api.open-meteo.com/v1/ecmwf",
    "icon": "https://api.open-meteo.com/v1/dwd-icon",
    "gem": "https://api.open-meteo.com/v1/gem",
    "hrrr": "https://api.open-meteo.com/v1/gfs",
    "nbm": "https://api.open-meteo.com/v1/gfs",
}

MODEL_PARAMS = {
    "hrrr": {"models": "ncep_hrrr_conus", "forecast_days": 2},
    "nbm": {"models": "ncep_nbm_conus", "forecast_days": 7},
    "icon": {"forecast_days": 7},  # ICON API max is ~7 days
}

HOURLY_VARS = (
    "temperature_2m,snowfall,precipitation,snow_depth,"
    "freezing_level_height,wind_speed_10m,wind_direction_10m,"
    "cloud_cover,relative_humidity_2m,weather_code,"
    "direct_radiation,shortwave_radiation"
)

BATCH_SIZE = 50  # Open-Meteo multi-location limit

# WMO weather code → human-readable conditions
WMO_CONDITIONS = {
    0: "Clear", 1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
    45: "Fog", 48: "Rime Fog",
    51: "Light Drizzle", 53: "Drizzle", 55: "Heavy Drizzle",
    56: "Light Freezing Drizzle", 57: "Freezing Drizzle",
    61: "Light Rain", 63: "Rain", 65: "Heavy Rain",
    66: "Light Freezing Rain", 67: "Freezing Rain",
    71: "Light Snow", 73: "Snow", 75: "Heavy Snow", 77: "Snow Grains",
    80: "Light Rain Showers", 81: "Rain Showers", 82: "Heavy Rain Showers",
    85: "Light Snow Showers", 86: "Heavy Snow Showers",
    95: "Thunderstorm", 96: "Thunderstorm + Hail", 99: "Thunderstorm + Heavy Hail",
}


def _batch_resorts(resorts: list[dict], size: int) -> list[list[dict]]:
    """Split resorts into batches of `size`."""
    return [resorts[i : i + size] for i in range(0, len(resorts), size)]


def _fetch_model(model_name: str, url: str, resorts: list[dict]) -> dict | None:
    """
    Fetch forecasts for a batch of resorts from one model endpoint.
    Returns the parsed JSON response or None on failure.
    """
    lats = ",".join(str(r["latitude"]) for r in resorts)
    lons = ",".join(str(r["longitude"]) for r in resorts)

    params = {
        "latitude": lats,
        "longitude": lons,
        "hourly": HOURLY_VARS,
        "temperature_unit": "fahrenheit",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "forecast_days": 14,
        "timezone": "UTC",
    }
    params.update(MODEL_PARAMS.get(model_name, {}))

    for attempt in range(3):
        try:
            resp = requests.get(url, params=params, timeout=30)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as e:
            wait = 2 ** attempt
            logger.warning(
                "%s request failed (attempt %d/3): %s — retrying in %ds",
                model_name, attempt + 1, e, wait,
            )
            time.sleep(wait)

    logger.error("All retries exhausted for %s batch", model_name)
    return None


def _insert_forecasts(
    conn: sqlite3.Connection,
    resort_id: int,
    model_name: str,
    hourly: dict,
    run_time: str,
) -> None:
    """Insert hourly forecast rows for one resort + model."""
    times = hourly.get("time", [])
    if not times:
        return

    rows = []
    for i, t in enumerate(times):
        snow_depth_m = _safe_get(hourly, "snow_depth", i)
        snow_depth_in = round(snow_depth_m * 39.37, 1) if snow_depth_m is not None else None
        rows.append((
            resort_id,
            model_name,
            run_time,
            t,
            _safe_get(hourly, "temperature_2m", i),
            _safe_get(hourly, "wind_speed_10m", i),
            _safe_get(hourly, "wind_direction_10m", i),
            _safe_get(hourly, "precipitation", i),
            _safe_get(hourly, "snowfall", i),
            None,  # snow_level_ft — not directly available
            _safe_get(hourly, "freezing_level_height", i),
            _safe_get(hourly, "relative_humidity_2m", i),
            _safe_get(hourly, "cloud_cover", i),
            _safe_get(hourly, "weather_code", i),
            _safe_get(hourly, "direct_radiation", i),
            _safe_get(hourly, "shortwave_radiation", i),
            snow_depth_in,
        ))

    conn.executemany(
        """
        INSERT INTO forecasts (
            resort_id, model_name, run_time, valid_time,
            temperature_f, wind_speed_mph, wind_direction,
            precip_liquid_in, snowfall_in, snow_level_ft, freezing_level_ft,
            humidity_pct, cloud_cover_pct, weather_code,
            direct_radiation_wm2, shortwave_radiation_wm2, snow_depth_in
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )


def _safe_get(hourly: dict, key: str, idx: int):
    """Safely get a value from hourly arrays, returning None if missing."""
    arr = hourly.get(key)
    if arr is None or idx >= len(arr):
        return None
    return arr[idx]


def _ingest_model(
    conn: sqlite3.Connection,
    model_name: str,
    url: str,
    resorts: list[dict],
    resort_id_map: dict[str, int],
) -> int:
    """
    Ingest forecasts for all resorts from one model.
    Returns the number of resorts successfully ingested.
    """
    # HRRR and NBM are US-only models
    if model_name in ("hrrr", "nbm"):
        resorts = [r for r in resorts if r.get("country", "US") != "CA"]
        if not resorts:
            logger.info("  %s: no US resorts to ingest, skipping", model_name)
            return 0

    run_time = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    batches = _batch_resorts(resorts, BATCH_SIZE)
    total_ingested = 0

    for batch_idx, batch in enumerate(batches):
        logger.info(
            "  %s — batch %d/%d (%d resorts)",
            model_name, batch_idx + 1, len(batches), len(batch),
        )
        data = _fetch_model(model_name, url, batch)
        if data is None:
            continue

        # Open-Meteo returns a list when multiple locations are requested,
        # or a single object for one location.
        if isinstance(data, list):
            forecasts_list = data
        elif isinstance(data, dict) and "hourly" in data:
            forecasts_list = [data]
        else:
            logger.warning("Unexpected response shape from %s", model_name)
            continue

        for resort, forecast in zip(batch, forecasts_list):
            slug = resort["slug"]
            rid = resort_id_map.get(slug)
            if rid is None:
                continue
            hourly = forecast.get("hourly")
            if not hourly:
                logger.debug("No hourly data for %s from %s", slug, model_name)
                continue
            _insert_forecasts(conn, rid, model_name, hourly, run_time)
            total_ingested += 1

        # Be polite — delay between batches (longer for rate-limited models)
        if batch_idx < len(batches) - 1:
            delay = 2.0 if model_name == "icon" else 1.0
            time.sleep(delay)

    conn.commit()
    return total_ingested


def _compute_blended(conn: sqlite3.Connection, resorts: list[dict], resort_id_map: dict[str, int]) -> None:
    """
    Compute blended (multi-model) forecasts from the latest raw forecasts
    and insert into processed_forecasts.

    Blending logic:
      - snowfall = average of all models
      - snowfall_low = min across models
      - snowfall_high = max across models
      - confidence: spread < 2" = high, 2-5" = medium, > 5" = low
    """
    # Clear old processed forecasts
    conn.execute("DELETE FROM processed_forecasts")

    for resort in resorts:
        rid = resort_id_map.get(resort["slug"])
        if rid is None:
            continue

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
        latest_run = max(r["latest"] for r in latest_runs)

        # Gather all model data from each model's latest run
        rows = []
        for lr in latest_runs:
            model_rows = conn.execute(
                """
                SELECT valid_time, model_name,
                       snowfall_in, temperature_f, wind_speed_mph, weather_code
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
            snows = [m["snowfall_in"] for m in models if m["snowfall_in"] is not None]
            temps = [m["temperature_f"] for m in models if m["temperature_f"] is not None]
            winds = [m["wind_speed_mph"] for m in models if m["wind_speed_mph"] is not None]
            codes = [m["weather_code"] for m in models if m["weather_code"] is not None]

            snow_avg = sum(snows) / len(snows) if snows else 0
            snow_low = min(snows) if snows else 0
            snow_high = max(snows) if snows else 0
            temp_avg = sum(temps) / len(temps) if temps else None
            wind_avg = sum(winds) / len(winds) if winds else None
            wind_max = max(winds) if winds else None
            code = max(set(codes), key=codes.count) if codes else None  # mode

            spread = snow_high - snow_low
            if spread < 2:
                confidence = "high"
            elif spread <= 5:
                confidence = "medium"
            else:
                confidence = "low"

            blended_rows.append((
                rid, vt,
                round(snow_avg, 2), round(snow_low, 2), round(snow_high, 2),
                round(temp_avg, 1) if temp_avg is not None else None,
                round(wind_avg, 1) if wind_avg is not None else None,
                round(wind_max, 1) if wind_max is not None else None,
                None,  # snow_quality — future enhancement
                confidence,
                code,
            ))

        if blended_rows:
            conn.executemany(
                """
                INSERT INTO processed_forecasts (
                    resort_id, valid_time,
                    snowfall_in, snowfall_low, snowfall_high,
                    temperature_f, wind_speed_mph, wind_gust_mph,
                    snow_quality, confidence, weather_code
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                blended_rows,
            )

    conn.commit()
    logger.info("Blended forecasts computed for %d resorts", len(resorts))


def _build_json_output(conn: sqlite3.Connection, resorts: list[dict], resort_id_map: dict[str, int]) -> None:
    """
    Build per-resort forecast JSON files and the master resorts.json for the frontend.
    Output goes to public/data/forecasts/{slug}.json and public/data/resorts.json.
    """
    output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "public", "data")
    forecast_dir = os.path.join(output_dir, "forecasts")
    os.makedirs(forecast_dir, exist_ok=True)

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    master_list = []

    for resort in resorts:
        slug = resort["slug"]
        rid = resort_id_map.get(slug)
        if rid is None:
            continue

        # --- Build per-model hourly data ---
        models_data = {}
        for model_name in MODELS:
            rows = conn.execute(
                """
                SELECT valid_time, temperature_f, snowfall_in, precip_liquid_in,
                       freezing_level_ft, wind_speed_mph, wind_direction,
                       cloud_cover_pct, weather_code
                FROM forecasts
                WHERE resort_id = ? AND model_name = ?
                ORDER BY valid_time
                """,
                (rid, model_name),
            ).fetchall()

            if not rows:
                continue

            hourly = {
                "time": [],
                "temperature_2m": [],
                "snowfall": [],
                "precipitation": [],
                "snow_depth": [],
                "freezing_level_height": [],
                "wind_speed_10m": [],
                "wind_direction_10m": [],
                "cloud_cover": [],
                "weather_code": [],
            }
            for r in rows:
                hourly["time"].append(r["valid_time"])
                hourly["temperature_2m"].append(r["temperature_f"])
                hourly["snowfall"].append(r["snowfall_in"])
                hourly["precipitation"].append(r["precip_liquid_in"])
                hourly["snow_depth"].append(None)  # not stored per-hour
                hourly["freezing_level_height"].append(r["freezing_level_ft"])
                hourly["wind_speed_10m"].append(r["wind_speed_mph"])
                hourly["wind_direction_10m"].append(r["wind_direction"])
                hourly["cloud_cover"].append(r["cloud_cover_pct"])
                hourly["weather_code"].append(r["weather_code"])

            models_data[model_name] = {"hourly": hourly}

        # --- Build blended data ---
        blended_rows = conn.execute(
            """
            SELECT valid_time, snowfall_in, snowfall_low, snowfall_high,
                   temperature_f, wind_speed_mph, wind_gust_mph,
                   confidence, weather_code,
                   snow_level_ft, downscaled_temp_f, slr, snow_quality,
                   melt_rate_in_hr, net_snow_change_in,
                   base_temp_f, summit_temp_f,
                   humidity_pct, wind_direction, precip_liquid_in
            FROM processed_forecasts
            WHERE resort_id = ?
            ORDER BY valid_time
            """,
            (rid,),
        ).fetchall()

        # Current snowpack depth (first non-null value from latest forecasts)
        depth_row = conn.execute(
            """
            SELECT snow_depth_in FROM forecasts
            WHERE resort_id = ? AND snow_depth_in IS NOT NULL
            ORDER BY valid_time LIMIT 1
            """,
            (rid,),
        ).fetchone()
        starting_snow_depth = depth_row["snow_depth_in"] if depth_row else None

        blended_hourly = {
            "time": [],
            "snowfall": [],
            "temperature_2m": [],
            "base_temp": [],
            "summit_temp": [],
            "wind_speed": [],
            "wind_gust": [],
            "wind_direction": [],
            "precipitation": [],
            "humidity": [],
            "weather_code": [],
            "confidence": [],
            "snow_level": [],
        }
        for r in blended_rows:
            blended_hourly["time"].append(r["valid_time"])
            blended_hourly["snowfall"].append(r["snowfall_in"])
            blended_hourly["temperature_2m"].append(r["temperature_f"])
            blended_hourly["base_temp"].append(r["base_temp_f"])
            blended_hourly["summit_temp"].append(r["summit_temp_f"])
            blended_hourly["wind_speed"].append(r["wind_speed_mph"])
            blended_hourly["wind_gust"].append(r["wind_gust_mph"])
            blended_hourly["wind_direction"].append(r["wind_direction"])
            blended_hourly["precipitation"].append(r["precip_liquid_in"])
            blended_hourly["humidity"].append(r["humidity_pct"])
            blended_hourly["weather_code"].append(r["weather_code"])
            blended_hourly["confidence"].append(r["confidence"])
            blended_hourly["snow_level"].append(r["snow_level_ft"])

        # --- Build daily summaries ---
        daily_summary = _compute_daily_summary(blended_rows, starting_snow_depth)

        # --- Generate narrative ---
        narrative = ""
        snow_quality_label = ""
        try:
            from intelligence.narrative import generate_narrative, predict_snow_quality
            snow_24h_tmp, snow_48h_tmp, snow_14d_tmp = _compute_snowfall_totals(blended_rows)
            avg_temp = None
            avg_wind = None
            avg_gust = None
            avg_snow_level = None
            avg_slr = None
            if daily_summary:
                day0 = daily_summary[0]
                avg_temp = day0.get("temp_high")
                avg_wind = day0.get("wind_avg")
                avg_gust = day0.get("wind_gust")
            # Get average snow level and SLR from first 48h
            snow_levels = [r["snow_level_ft"] for r in blended_rows[:48] if r["snow_level_ft"] is not None]
            slr_vals = [r["slr"] for r in blended_rows[:48] if r["slr"] is not None]
            if snow_levels:
                avg_snow_level = sum(snow_levels) / len(snow_levels)
            if slr_vals:
                avg_slr = sum(slr_vals) / len(slr_vals)

            narrative = generate_narrative(
                resort["name"], snow_48h_tmp, snow_14d_tmp,
                avg_temp, daily_summary[0].get("temp_low") if daily_summary else None,
                avg_wind, avg_gust, avg_snow_level, avg_slr,
                daily_summary[0].get("confidence", "medium") if daily_summary else "medium",
            )
            from datetime import datetime as dt
            snow_quality_label = predict_snow_quality(
                snow_48h_tmp, avg_temp, avg_wind, dt.now().month,
            )
        except Exception as e:
            logger.debug("Narrative generation skipped: %s", e)

        forecast_obj = {
            "slug": slug,
            "last_updated": now,
            "models": models_data,
            "blended": {
                "narrative": narrative,
                "snow_quality": snow_quality_label,
                "hourly": blended_hourly,
                "daily_summary": daily_summary,
            },
        }

        filepath = os.path.join(forecast_dir, f"{slug}.json")
        with open(filepath, "w") as f:
            json.dump(forecast_obj, f, separators=(",", ":"))

        # --- Accumulate master list entry ---
        snow_24h, snow_48h, snow_14d = _compute_snowfall_totals(blended_rows)
        current_temp = blended_rows[0]["temperature_f"] if blended_rows else None
        conditions = _get_current_conditions(blended_rows)

        master_list.append({
            "slug": slug,
            "name": resort["name"],
            "state_province": resort["state_province"],
            "country": resort.get("country", "US"),
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
            "pass_affiliation": resort.get("pass_affiliation", ""),
            "snowmaking_pct": resort.get("snowmaking_pct", 0),
            "avg_annual_snowfall_in": resort.get("avg_annual_snowfall_in", 0),
            "website": resort.get("website", ""),
            "snow_report_url": resort.get("snow_report_url", ""),
            "webcam_url": resort.get("webcam_url"),
            "timezone": resort.get("timezone", ""),
            "operating_season": resort.get("operating_season", ""),
            "snow_24h": snow_24h,
            "snow_48h": snow_48h,
            "snow_14d": snow_14d,
            "current_temp": current_temp,
            "conditions": conditions,
        })

    # Write master resorts.json
    master_path = os.path.join(output_dir, "resorts.json")
    with open(master_path, "w") as f:
        json.dump(master_list, f, indent=2)

    logger.info(
        "Wrote %d forecast files and master resorts.json to %s",
        len(master_list), output_dir,
    )


def _compute_daily_summary(blended_rows: list, starting_snow_depth_in: float | None = None) -> list[dict]:
    """Aggregate hourly blended forecasts into daily summaries."""
    if not blended_rows:
        return []

    by_date: dict[str, list] = defaultdict(list)
    for r in blended_rows:
        vt = r["valid_time"]
        date_str = vt[:10] if isinstance(vt, str) else vt
        by_date[date_str].append(r)

    summaries = []
    for date_str in sorted(by_date.keys()):
        hours = by_date[date_str]
        snows = [h["snowfall_in"] or 0 for h in hours]
        snow_lows = [h["snowfall_low"] or 0 for h in hours]
        snow_highs = [h["snowfall_high"] or 0 for h in hours]
        temps = [h["temperature_f"] for h in hours if h["temperature_f"] is not None]
        winds = [h["wind_speed_mph"] for h in hours if h["wind_speed_mph"] is not None]
        gusts = [h["wind_gust_mph"] for h in hours if h["wind_gust_mph"] is not None]
        codes = [h["weather_code"] for h in hours if h["weather_code"] is not None]
        confs = [h["confidence"] for h in hours if h["confidence"] is not None]
        melts = [h["melt_rate_in_hr"] or 0 for h in hours]
        nets = [h["net_snow_change_in"] or 0 for h in hours]
        base_temps = [h["base_temp_f"] for h in hours if h["base_temp_f"] is not None]
        summit_temps = [h["summit_temp_f"] for h in hours if h["summit_temp_f"] is not None]

        daily_snow = round(sum(snows), 1)
        daily_snow_low = round(sum(snow_lows), 1)
        daily_snow_high = round(sum(snow_highs), 1)
        daily_melt = round(sum(melts), 2)
        daily_net = round(sum(nets), 2)

        # Daily confidence = worst confidence of the day
        if "low" in confs:
            day_conf = "low"
        elif "medium" in confs:
            day_conf = "medium"
        else:
            day_conf = "high"

        # Dominant weather condition: pick the most impactful code
        dominant_code = max(codes) if codes else 0
        conditions = WMO_CONDITIONS.get(dominant_code, "Unknown")

        # Phase 2: snow level and quality
        snow_levels = [h["snow_level_ft"] for h in hours if h["snow_level_ft"] is not None]
        avg_snow_level = round(sum(snow_levels) / len(snow_levels)) if snow_levels else None
        # Compute daily snow quality from daily aggregates
        day_quality = None
        try:
            from intelligence.narrative import predict_snow_quality
            from datetime import datetime as dt
            day_temp_high = round(max(temps)) if temps else None
            day_wind_avg = round(sum(winds) / len(winds)) if winds else None
            day_quality = predict_snow_quality(daily_snow, day_temp_high, day_wind_avg, dt.now().month)
        except Exception:
            pass

        summaries.append({
            "date": date_str,
            "snowfall_total": daily_snow,
            "snowfall_low": daily_snow_low,
            "snowfall_high": daily_snow_high,
            "temp_high": round(max(temps)) if temps else None,
            "temp_low": round(min(temps)) if temps else None,
            "wind_avg": round(sum(winds) / len(winds)) if winds else None,
            "wind_gust": round(max(gusts)) if gusts else None,
            "conditions": conditions,
            "confidence": day_conf,
            "snow_level_ft": avg_snow_level,
            "snow_quality": day_quality,
            "melt_total": daily_melt,
            "net_snow_change": daily_net,
            "base_temp_high": round(max(base_temps)) if base_temps else None,
            "base_temp_low": round(min(base_temps)) if base_temps else None,
            "summit_temp_high": round(max(summit_temps)) if summit_temps else None,
            "summit_temp_low": round(min(summit_temps)) if summit_temps else None,
        })

    # Generate per-day narratives
    try:
        from intelligence.narrative import generate_daily_narrative
        for i, day in enumerate(summaries):
            day["narrative"] = generate_daily_narrative(i, day)
    except Exception:
        for day in summaries:
            day.setdefault("narrative", "")

    # Compute days_until_depleted using cumulative net snow change
    if starting_snow_depth_in is not None and starting_snow_depth_in > 0:
        snowpack = starting_snow_depth_in
        days_until_depleted = None
        for i, day in enumerate(summaries):
            snowpack += day["net_snow_change"]
            if snowpack <= 0:
                days_until_depleted = i + 1
                break
        for day in summaries:
            day["days_until_depleted"] = days_until_depleted
    else:
        for day in summaries:
            day["days_until_depleted"] = None

    return summaries


def _compute_snowfall_totals(blended_rows: list) -> tuple[float, float, float]:
    """Compute 24h, 48h, and 14d snowfall totals from blended hourly data."""
    if not blended_rows:
        return 0.0, 0.0, 0.0

    now = datetime.now(timezone.utc)
    snow_24 = 0.0
    snow_48 = 0.0
    snow_14d = 0.0

    for r in blended_rows:
        vt_str = r["valid_time"]
        try:
            vt = datetime.fromisoformat(vt_str.replace("Z", "+00:00"))
            # Ensure timezone-aware for comparison
            if vt.tzinfo is None:
                vt = vt.replace(tzinfo=timezone.utc)
        except (ValueError, TypeError):
            continue
        snow = r["snowfall_in"] or 0
        delta = vt - now
        hours_ahead = delta.total_seconds() / 3600

        if 0 <= hours_ahead <= 24:
            snow_24 += snow
        if 0 <= hours_ahead <= 48:
            snow_48 += snow
        if 0 <= hours_ahead <= 336:
            snow_14d += snow

    return round(snow_24, 1), round(snow_48, 1), round(snow_14d, 1)


def _get_current_conditions(blended_rows: list) -> str:
    """Get the weather conditions string for the nearest forecast hour."""
    if not blended_rows:
        return "Unknown"
    code = blended_rows[0]["weather_code"]
    return WMO_CONDITIONS.get(code or 0, "Unknown")


def _build_resort_id_map(conn: sqlite3.Connection, resorts: list[dict]) -> dict[str, int]:
    """Build slug → resort_id mapping."""
    resort_id_map: dict[str, int] = {}
    for r in resorts:
        slug = r["slug"]
        row = conn.execute("SELECT id FROM resorts WHERE slug = ?", (slug,)).fetchone()
        if row:
            resort_id_map[slug] = row["id"] if isinstance(row, sqlite3.Row) else row[0]
    return resort_id_map


def run_ingest_only(conn: sqlite3.Connection, resorts: list[dict] | None = None) -> dict[str, int]:
    """
    Ingest raw forecasts from all models. Does NOT blend or generate JSON.
    Returns the resort_id_map for use by downstream steps.
    """
    if resorts is None:
        rows = conn.execute("SELECT * FROM resorts").fetchall()
        resorts = [dict(r) for r in rows]

    if not resorts:
        logger.warning("No resorts found — skipping Open-Meteo ingest")
        return {}

    resort_id_map = _build_resort_id_map(conn, resorts)
    if not resort_id_map:
        logger.error("No resort IDs found in database — run seed_resorts first")
        return {}

    # Clear previous forecast data for a fresh ingest
    conn.execute("DELETE FROM forecasts")
    conn.commit()

    # Ingest each model
    for model_name, url in MODELS.items():
        logger.info("Ingesting model: %s", model_name)
        count = _ingest_model(conn, model_name, url, resorts, resort_id_map)
        logger.info("  %s: ingested %d resorts", model_name, count)

    return resort_id_map


def run_json_output(conn: sqlite3.Connection, resorts: list[dict], resort_id_map: dict[str, int]) -> None:
    """Generate JSON output files from processed_forecasts (called after intelligence step)."""
    logger.info("Generating JSON output files...")
    _build_json_output(conn, resorts, resort_id_map)


def run(conn: sqlite3.Connection, resorts: list[dict] | None = None) -> None:
    """
    Legacy entry point. Runs full pipeline: ingest + blend + JSON output.
    Phase 2 pipeline uses run_ingest_only() + intelligence + run_json_output() instead.
    """
    if resorts is None:
        rows = conn.execute("SELECT * FROM resorts").fetchall()
        resorts = [dict(r) for r in rows]

    resort_id_map = run_ingest_only(conn, resorts)
    if not resort_id_map:
        return

    # Compute blended forecasts (Phase 1 simple average — kept as fallback)
    logger.info("Computing blended forecasts...")
    _compute_blended(conn, resorts, resort_id_map)

    # Generate JSON output for frontend
    run_json_output(conn, resorts, resort_id_map)


if __name__ == "__main__":
    import sys
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
    from db_helper import get_db, init_schema

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    db = get_db()
    init_schema(db)
    run(db)
    db.close()
