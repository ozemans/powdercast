"""
Dynamic Snow-to-Liquid Ratio (SLR) model.

Replaces the fixed ~10:1 ratio used by Open-Meteo with a temperature-dependent
SLR based on Roebber et al. (2003) simplified approach. Includes wind
compaction adjustment.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# Temperature-based SLR lookup (Roebber 2003 simplified)
# Returns the snow-to-liquid ratio for a given temperature
SLR_TABLE = [
    (34, 0),     # >= 34°F → rain, no snow
    (32, 5),     # 32-34°F → wet snow
    (28, 8),     # 28-32°F → damp snow
    (24, 10),    # 24-28°F → average snow
    (18, 13),    # 18-24°F → light snow
    (10, 16),    # 10-18°F → fluffy snow
    (0, 20),     # 0-10°F → very fluffy
    (-999, 25),  # < 0°F → extreme cold smoke
]


def compute_slr(
    temp_f: float | None,
    wind_speed_mph: float | None = None,
) -> float:
    """
    Compute snow-to-liquid ratio from temperature and wind speed.

    Args:
        temp_f: Surface temperature in Fahrenheit
        wind_speed_mph: Wind speed in mph (higher wind compacts snow)

    Returns:
        SLR ratio (0 means rain, not snow)
    """
    if temp_f is None:
        return 10.0  # Default when no temp available

    # Base SLR from temperature lookup
    base_slr = 25.0  # Default for extreme cold
    for threshold, ratio in SLR_TABLE:
        if temp_f >= threshold:
            base_slr = ratio
            break

    if base_slr == 0:
        return 0.0  # Rain

    # Wind compaction: reduce SLR by 1% per mph above 20, floor at 50%
    wind = wind_speed_mph or 0
    if wind > 20:
        wind_factor = max(0.5, 1.0 - (wind - 20) * 0.01)
        return round(base_slr * wind_factor, 1)

    return base_slr


def compute_snowfall(
    precip_liquid_in: float | None,
    temp_f: float | None,
    wind_speed_mph: float | None = None,
) -> tuple[float, float]:
    """
    Compute snowfall from liquid precipitation using dynamic SLR.

    Returns:
        (snowfall_in, slr) tuple
    """
    if precip_liquid_in is None or precip_liquid_in <= 0:
        return 0.0, compute_slr(temp_f, wind_speed_mph)

    slr = compute_slr(temp_f, wind_speed_mph)
    snowfall = round(precip_liquid_in * slr, 2)
    return snowfall, slr


def get_slr_description(slr: float) -> str:
    """Human-readable SLR description for narratives."""
    if slr == 0:
        return "rain"
    elif slr <= 6:
        return "wet, heavy snow"
    elif slr <= 10:
        return "moderate-density snow"
    elif slr <= 15:
        return "light, fluffy snow"
    elif slr <= 20:
        return "dry powder"
    else:
        return "ultra-dry cold smoke"
