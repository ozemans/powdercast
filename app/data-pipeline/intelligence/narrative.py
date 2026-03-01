"""
AI forecast narratives and snow quality prediction.

Template-based generation for $0 cost. Produces natural-language forecast
summaries and predicts surface snow conditions.
"""

from __future__ import annotations

import logging
from .slr import get_slr_description

logger = logging.getLogger(__name__)

# Snow quality categories
QUALITY_FRESH_POWDER = "Fresh Powder"
QUALITY_PACKED_POWDER = "Packed Powder"
QUALITY_SPRING = "Spring Conditions"
QUALITY_WIND_AFFECTED = "Wind Affected"
QUALITY_WET_HEAVY = "Wet/Heavy"
QUALITY_MIXED = "Variable"


def predict_snow_quality(
    snow_48h: float,
    temp_high: float | None,
    wind_avg: float | None,
    month: int = 1,
) -> str:
    """
    Predict surface snow quality from forecast conditions.

    Args:
        snow_48h: Snowfall in next 48 hours (inches)
        temp_high: High temperature today (°F)
        wind_avg: Average wind speed (mph)
        month: Current month (1-12)
    """
    temp = temp_high or 25
    wind = wind_avg or 0

    # Spring conditions: late season + warm
    if month >= 4 and temp > 38:
        return QUALITY_SPRING

    # Fresh powder: significant recent snowfall + cold
    if snow_48h >= 4 and temp < 30:
        if wind > 25:
            return QUALITY_WIND_AFFECTED
        return QUALITY_FRESH_POWDER

    # Wind-affected: high wind regardless of snow
    if wind > 30:
        return QUALITY_WIND_AFFECTED

    # Wet/heavy: warm temps with precipitation
    if temp >= 32 and snow_48h > 0:
        return QUALITY_WET_HEAVY

    # Light snow but cold: packed powder with some fresh
    if snow_48h >= 1 and temp < 28:
        return QUALITY_FRESH_POWDER

    # Warm and dry: spring-like
    if temp > 35 and snow_48h < 1:
        if month >= 3:
            return QUALITY_SPRING
        return QUALITY_PACKED_POWDER

    # Default: packed powder (groomed conditions)
    if snow_48h < 2:
        return QUALITY_PACKED_POWDER

    return QUALITY_MIXED


def generate_narrative(
    resort_name: str,
    snow_48h: float,
    snow_7d: float,
    temp_high: float | None,
    temp_low: float | None,
    wind_avg: float | None,
    wind_gust: float | None,
    snow_level_ft: float | None,
    slr: float | None,
    confidence: str = "medium",
) -> str:
    """
    Generate a natural-language forecast narrative.

    Returns a 2-3 sentence string describing the upcoming conditions.
    """
    # Intensity description
    if snow_48h >= 12:
        intensity = "a significant storm"
        snow_desc = f"{snow_48h:.0f} inches of snowfall"
    elif snow_48h >= 6:
        intensity = "a solid round of snow"
        snow_desc = f"{snow_48h:.0f} inches"
    elif snow_48h >= 2:
        intensity = "light snowfall"
        snow_desc = f"{snow_48h:.1f} inches"
    elif snow_48h >= 0.5:
        intensity = "flurries"
        snow_desc = "trace amounts"
    else:
        intensity = "dry conditions"
        snow_desc = "little to no accumulation"

    # Snow quality from SLR
    slr_val = slr or 10
    quality_desc = get_slr_description(slr_val)

    # Build first sentence
    if snow_48h >= 2:
        sentence1 = (
            f"{resort_name} is looking at {intensity} over the next 48 hours, "
            f"with {snow_desc} of {quality_desc} expected."
        )
    else:
        sentence1 = (
            f"{resort_name} is expecting {intensity} over the next 48 hours"
            f"{f' with {snow_desc}' if snow_48h > 0 else ''}."
        )

    # Snow level sentence
    sentence2 = ""
    if snow_level_ft is not None and snow_48h >= 0.5:
        sentence2 = f" Snow levels around {snow_level_ft:,.0f} ft."

    # 7-day outlook
    if snow_7d >= 12:
        outlook = f" Looking ahead, {snow_7d:.0f} inches possible over the next 7 days."
    elif snow_7d >= 6:
        outlook = f" The 7-day outlook shows {snow_7d:.0f} inches total."
    else:
        outlook = ""

    # Wind advisory
    wind_note = ""
    gust = wind_gust or 0
    avg = wind_avg or 0
    if gust > 40:
        wind_note = f" Strong winds with gusts to {gust:.0f} mph may cause lift holds."
    elif avg > 25:
        wind_note = f" Winds averaging {avg:.0f} mph will be noticeable on exposed terrain."

    # Temperature note
    temp_note = ""
    if temp_high is not None and temp_low is not None:
        if temp_high < 10:
            temp_note = f" Bundle up — highs only reaching {temp_high:.0f}°F."
        elif temp_high > 40 and snow_48h < 2:
            temp_note = f" Mild temps with highs near {temp_high:.0f}°F."

    # Confidence qualifier
    conf_note = ""
    if confidence == "low" and snow_48h >= 2:
        conf_note = " Models show significant disagreement — forecast uncertainty is high."

    narrative = f"{sentence1}{sentence2}{outlook}{wind_note}{temp_note}{conf_note}"
    return narrative.strip()
