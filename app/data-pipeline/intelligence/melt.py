"""
Enhanced Temperature-Index (ETI) snow melt model.

Based on Pellicciotti et al. (2005), adapted for operational ski resort forecasting.

Formula:
    M (mm/hr) = max(0, TF * T_C + RM * I_absorbed)  when T_C > T_MELT
    M (mm/hr) = 0                                     when T_C <= T_MELT

    I_absorbed = I_direct * (1 - SNOW_ALBEDO)

    TF          = 0.05 mm/hr/°C    temperature melt factor
    RM          = 0.01 mm/hr/W/m²  radiation melt factor (applied to absorbed radiation)
    SNOW_ALBEDO = 0.75             typical ski resort snow reflectivity
    T_MELT      = 1.0 °C          melt threshold (slightly above 0 to absorb model bias)
    I_direct    = direct solar radiation (W/m²) from Open-Meteo

Snow reflects ~75% of incoming solar radiation, so only 25% is absorbed and
contributes to melt. Applying this correction brings model rates into the
physically realistic range of 0.02–0.12 in/hr for warm, sunny conditions.
"""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)

# ETI model constants (Pellicciotti 2005, albedo-adjusted for Open-Meteo inputs)
TF = 0.05           # mm/hr/°C  — temperature melt factor
RM = 0.01           # mm/hr/W/m² — radiation melt factor (applied to absorbed radiation)
SNOW_ALBEDO = 0.75  # fraction of solar radiation reflected by snow
T_MELT = 1.0        # °C — melt threshold

MM_TO_IN = 0.03937  # millimeters → inches conversion


def _f_to_c(temp_f: float) -> float:
    """Convert Fahrenheit to Celsius."""
    return (temp_f - 32) * 5 / 9


def compute_melt_rate(
    temp_f: float | None,
    direct_radiation_wm2: float | None = None,
) -> float:
    """
    Compute hourly snow melt rate in inches/hr using the ETI model.

    Args:
        temp_f: Air temperature in Fahrenheit
        direct_radiation_wm2: Direct solar radiation in W/m² (0 at night or overcast)

    Returns:
        Melt rate in inches/hr (0 if below melt threshold or no snowpack)
    """
    if temp_f is None:
        return 0.0

    temp_c = _f_to_c(temp_f)
    radiation = max(0.0, direct_radiation_wm2 or 0.0)
    absorbed_radiation = radiation * (1.0 - SNOW_ALBEDO)

    if temp_c <= T_MELT:
        return 0.0

    melt_mm = max(0.0, TF * temp_c + RM * absorbed_radiation)
    return round(melt_mm * MM_TO_IN, 4)


def compute_net_snow_change(
    snowfall_in: float | None,
    melt_rate_in_hr: float,
) -> float:
    """
    Compute net hourly snow change = snowfall - melt.

    Positive = snowpack growing (more snow falling than melting).
    Negative = snowpack shrinking.

    Args:
        snowfall_in: Hourly snowfall in inches
        melt_rate_in_hr: Hourly melt rate in inches/hr from compute_melt_rate()

    Returns:
        Net snow change in inches for this hour
    """
    snow = snowfall_in or 0.0
    return round(snow - melt_rate_in_hr, 4)


def compute_depletion_days(
    snow_depth_in: float,
    daily_net_changes: list[float],
) -> int | None:
    """
    Compute how many days until the snowpack depletes to zero.

    Args:
        snow_depth_in: Current snowpack depth in inches
        daily_net_changes: List of daily net snow changes (inches/day).
                           Negative = net loss, positive = net gain.

    Returns:
        Number of days until depletion, or None if snowpack holds through
        the entire forecast window.
    """
    if snow_depth_in <= 0:
        return 0

    snowpack = snow_depth_in
    for day_num, net in enumerate(daily_net_changes, start=1):
        snowpack += net
        if snowpack <= 0:
            return day_num

    return None  # Snowpack survives the forecast window
