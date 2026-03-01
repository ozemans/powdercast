"""
Elevation downscaling and snow level calculation.

Corrects model temperatures for the difference between the model grid
elevation and the actual resort elevation using atmospheric lapse rates.
Computes snow level from freezing level height.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Lapse rates in °F per 1000 ft
MOIST_LAPSE_RATE = 3.5   # Used when humidity >= 50%
DRY_LAPSE_RATE = 5.4     # Used when humidity < 50%


def downscale_temperature(
    model_temp_f: float | None,
    model_elevation_ft: float,
    target_elevation_ft: float,
    humidity_pct: float | None = None,
) -> float | None:
    """
    Apply atmospheric lapse rate to correct temperature for elevation difference.

    Args:
        model_temp_f: Temperature at model grid elevation (°F)
        model_elevation_ft: Elevation of the model grid point (ft)
        target_elevation_ft: Actual resort elevation (ft)
        humidity_pct: Relative humidity (0-100). If >= 50, use moist lapse rate.
    """
    if model_temp_f is None:
        return None

    elevation_diff = target_elevation_ft - model_elevation_ft
    lapse = MOIST_LAPSE_RATE if (humidity_pct is None or humidity_pct >= 50) else DRY_LAPSE_RATE
    correction = -(elevation_diff / 1000) * lapse

    return round(model_temp_f + correction, 1)


def compute_snow_level(
    freezing_level_ft: float | None,
    precip_rate_in_per_hr: float | None,
) -> float | None:
    """
    Compute snow level (rain/snow transition) from freezing level.

    Snow level is typically 500-1500 ft below the freezing level due to
    evaporative cooling of falling snow. Heavier precipitation lowers the
    snow level more.
    """
    if freezing_level_ft is None:
        return None

    rate = precip_rate_in_per_hr or 0

    if rate > 0.1:      # Heavy precipitation
        offset = 1500
    elif rate > 0.03:   # Moderate
        offset = 1000
    else:                # Light or none
        offset = 500

    return max(0, round(freezing_level_ft - offset))


def apply_elevation_corrections(
    hourly_data: list[dict],
    model_elevation_ft: float,
    resort_summit_ft: float,
    resort_base_ft: float,
    resort_mid_ft: float,
) -> list[dict]:
    """
    Apply elevation corrections to a list of hourly forecast dicts.
    Modifies dicts in-place and returns the list.

    Each dict should have: temperature_f, freezing_level_ft, humidity_pct,
    precip_liquid_in (optional).
    """
    for hour in hourly_data:
        # Downscale temperature to resort mid-mountain elevation
        hour["downscaled_temp_f"] = downscale_temperature(
            hour.get("temperature_f"),
            model_elevation_ft,
            resort_mid_ft,
            hour.get("humidity_pct"),
        )

        # Compute snow level
        hour["snow_level_ft"] = compute_snow_level(
            hour.get("freezing_level_ft"),
            hour.get("precip_liquid_in"),
        )

    return hourly_data
