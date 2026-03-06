"""
Recent snow conditions from SNOTEL observations.

Computes observed snow metrics (past 48h and 7d) from SNOTEL station data,
including new snowfall estimates, melt, depth changes, and trend analysis.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def compute_recent_conditions(observations: dict) -> dict | None:
    """Compute recent snow conditions by averaging across SNOTEL stations.

    Args:
        observations: Parsed observations JSON with ``snotel_stations`` list.

    Returns:
        Dict with recent condition metrics or ``None`` if insufficient data.
    """
    stations = observations.get("snotel_stations", [])
    if not stations:
        return None

    # Collect history_7d from all stations that have enough data
    valid_histories: list[list[dict]] = []
    for station in stations:
        hist = station.get("history_7d", [])
        if len(hist) >= 2:
            valid_histories.append(hist)

    if not valid_histories:
        return None

    # Average across stations for each time slot
    n_days = min(len(h) for h in valid_histories)
    avg_depths = []
    avg_swes = []
    for i in range(n_days):
        depths = [h[i]["snow_depth_in"] for h in valid_histories if h[i]["snow_depth_in"] is not None]
        swes = [h[i]["swe_in"] for h in valid_histories if h[i]["swe_in"] is not None]
        avg_depths.append(sum(depths) / len(depths) if depths else 0)
        avg_swes.append(sum(swes) / len(swes) if swes else 0)

    if len(avg_depths) < 2:
        return None

    current_depth = avg_depths[-1]

    # 48h ago = 2 days back (index -3 in 7-day history)
    idx_48h = max(0, len(avg_depths) - 3)
    depth_48h_ago = avg_depths[idx_48h]
    swe_48h_ago = avg_swes[idx_48h]

    # 7d ago = first entry
    depth_7d_ago = avg_depths[0]
    swe_7d_ago = avg_swes[0]

    current_swe = avg_swes[-1]

    # Snow depth changes
    depth_change_48h = current_depth - depth_48h_ago
    depth_change_7d = current_depth - depth_7d_ago

    # New snow estimates from SWE changes (positive SWE change = new snow)
    swe_change_48h = current_swe - swe_48h_ago
    swe_change_7d = current_swe - swe_7d_ago

    # Estimate new snowfall using average SLR of 12:1
    # (We don't have hourly temps for observed data)
    default_slr = 12.0
    new_snow_48h = max(0, swe_change_48h * default_slr)
    new_snow_7d = max(0, swe_change_7d * default_slr)

    # Melt estimate
    settling_factor = 0.85  # new snow settles ~15%
    if new_snow_48h > 0:
        expected_gain = new_snow_48h * settling_factor
        melt_48h = max(0, expected_gain - depth_change_48h)
    else:
        melt_48h = max(0, -depth_change_48h)

    # Trend
    if depth_change_7d > 3:
        trend = "gaining"
    elif depth_change_7d < -3:
        trend = "losing"
    else:
        trend = "stable"

    narrative = _build_narrative(
        current_depth, depth_change_48h, depth_change_7d,
        new_snow_48h, new_snow_7d, melt_48h, trend,
    )

    return {
        "current_depth_in": round(current_depth, 1),
        "depth_change_48h_in": round(depth_change_48h, 1),
        "depth_change_7d_in": round(depth_change_7d, 1),
        "new_snow_48h_in": round(new_snow_48h, 1),
        "new_snow_7d_in": round(new_snow_7d, 1),
        "melt_48h_in": round(melt_48h, 1),
        "trend": trend,
        "narrative": narrative,
    }


def _build_narrative(
    current_depth: float,
    depth_change_48h: float,
    depth_change_7d: float,
    new_snow_48h: float,
    new_snow_7d: float,
    melt_48h: float,
    trend: str,
) -> str:
    """Build a 1-2 sentence human-readable conditions summary."""
    parts = []

    # Recent snowfall
    if new_snow_48h >= 1:
        parts.append(f'{new_snow_48h:.1f}" of new snow in the past 48 hours')
    elif new_snow_7d >= 1:
        parts.append(f'{new_snow_7d:.1f}" of new snow over the past week')
    else:
        parts.append("No new snow in the past 48 hours")

    # Trend context
    if trend == "gaining":
        parts.append(f"Snowpack is building \u2014 up {abs(depth_change_7d):.0f}\" over the past week")
    elif trend == "losing":
        parts.append(f"Base has been melting \u2014 down {abs(depth_change_7d):.0f}\" over the past week")
    else:
        parts.append("Snowpack is holding steady")

    # Current depth
    parts.append(f"Current depth: {current_depth:.0f}\"")

    return ". ".join(parts) + "."
