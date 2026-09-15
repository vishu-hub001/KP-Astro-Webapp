"""
core/ruling_planets.py

KP "Ruling Planets" (RP) -- the small set of planets considered active
at the moment a chart is judged, traditionally used to time events and,
in horary (Prashna) practice, to help validate/select the correct
horary number. This is core building-block data that
horary/horary_chart.py and kp_analysis/event_timing.py will both need.

NOTE ON SCOPE: no separate build spec exists for this file (same
situation as core/cusp_calculator.py and core/significators.py). The
set computed here is the standard KP ruling-planets list:

  1. Day Lord       -- the planet ruling the current weekday
  2. Moon's sign lord, star lord, and sub lord
  3. Ascendant's sign lord, star lord, and sub lord

A well-known refinement exists where, if Rahu or Ketu occupies the sign
or star whose lord would normally be listed, that node is added
alongside (or in some traditions, in place of) the natural sign lord,
since KP treats Rahu/Ketu as acting as agents for whichever sign they
sit in. That refinement is NOT implemented here -- it depends on
editorial choices (add vs. replace) that vary by KP author -- but the
raw ingredients (each planet's occupied sign/star, from
core.sub_lord_engine) are all present in this module's output, so that
logic can be layered on top later without recomputing anything.
"""

from __future__ import annotations

from datetime import datetime

from core.cusp_calculator import get_sign_lord
from core.sub_lord_engine import get_sublord_info

# --- Day lords ---------------------------------------------------------
# Traditional planetary rulers of the seven weekdays. Python's
# datetime.weekday() returns 0=Monday..6=Sunday, so this is indexed to
# match that directly rather than requiring callers to remap it.
_WEEKDAY_LORDS = {
    0: "Moon",      # Monday
    1: "Mars",      # Tuesday
    2: "Mercury",   # Wednesday
    3: "Jupiter",   # Thursday
    4: "Venus",     # Friday
    5: "Saturn",    # Saturday
    6: "Sun",       # Sunday
}


def get_day_lord(dt_local: datetime) -> str:
    """
    Return the ruling planet of the weekday `dt_local` falls on.

    Uses the LOCAL calendar date as given -- callers computing a horary
    or birth chart's ruling planets should pass the same local datetime
    used for the rest of the chart (the weekday lord is a civil-calendar
    concept, not something that shifts with a UTC conversion the way
    sidereal longitudes do).

    Args:
        dt_local: Any datetime; only its weekday is used.

    Returns:
        The planet name ruling that day, e.g. "Sun" for Sunday.
    """
    return _WEEKDAY_LORDS[dt_local.weekday()]


def get_ruling_planets(
    dt_local: datetime, ascendant_longitude: float, moon_longitude: float
) -> dict:
    """
    Compute the standard KP Ruling Planets set for a chart.

    Args:
        dt_local: Local datetime of the moment being judged (birth time
            for a natal chart, or the moment of judgment for horary).
            Only used to determine the day lord -- see get_day_lord().
        ascendant_longitude: Ascendant's zodiacal longitude in degrees.
        moon_longitude: Moon's zodiacal longitude in degrees.

    Returns:
        {
            "day_lord": "Venus",
            "ascendant": {
                "sign_lord": "Mercury",
                "star_lord": "Sun",
                "sub_lord": "Venus",
            },
            "moon": {
                "sign_lord": "Moon",
                "star_lord": "Mars",
                "sub_lord": "Saturn",
            },
            "all": ["Venus", "Mercury", "Sun", "Moon", "Mars", "Saturn"],
        }

        "all" lists every distinct planet appearing above, in the
        priority order day lord -> Ascendant (sign, star, sub) -> Moon
        (sign, star, sub), with duplicates removed on first occurrence
        (the same planet commonly appears more than once, e.g. as both
        day lord and a sub lord).
    """
    day_lord = get_day_lord(dt_local)

    asc_info = get_sublord_info(ascendant_longitude)
    asc_sign_lord = get_sign_lord(asc_info["sign"])

    moon_info = get_sublord_info(moon_longitude)
    moon_sign_lord = get_sign_lord(moon_info["sign"])

    ascendant = {
        "sign_lord": asc_sign_lord,
        "star_lord": asc_info["star_lord"],
        "sub_lord": asc_info["sub_lord"],
    }
    moon = {
        "sign_lord": moon_sign_lord,
        "star_lord": moon_info["star_lord"],
        "sub_lord": moon_info["sub_lord"],
    }

    ordered_candidates = [
        day_lord,
        ascendant["sign_lord"],
        ascendant["star_lord"],
        ascendant["sub_lord"],
        moon["sign_lord"],
        moon["star_lord"],
        moon["sub_lord"],
    ]
    all_ruling_planets: list[str] = []
    for name in ordered_candidates:
        if name not in all_ruling_planets:
            all_ruling_planets.append(name)

    return {
        "day_lord": day_lord,
        "ascendant": ascendant,
        "moon": moon,
        "all": all_ruling_planets,
    }


def get_ruling_planets_for_chart(chart_positions) -> dict:
    """
    Convenience wrapper: compute Ruling Planets directly from a
    core.ephemeris.ChartPositions object, without the caller needing to
    pull out the Ascendant/Moon longitudes or the birth datetime
    themselves.

    NOTE: ChartPositions (see core/ephemeris.py) does not currently
    store the source dt_local/tz_offset_hours used to compute it, only
    julian_day_ut -- so the day lord here is derived from julian_day_ut
    converted back to a UTC calendar date, NOT the original local civil
    date. For a birth close to local midnight where the UTC date differs
    from the local calendar date, this can give a different weekday than
    intended. If that distinction matters for a given call site, compute
    the day lord separately with get_day_lord(dt_local) using the
    original local datetime and merge it into this result instead of
    relying on this wrapper's day_lord.

    Args:
        chart_positions: A core.ephemeris.ChartPositions object.

    Returns:
        Same shape as get_ruling_planets().
    """
    import swisseph as swe

    year, month, day, hour_decimal = swe.revjul(chart_positions.julian_day_ut)
    hour = int(hour_decimal)
    minute = int((hour_decimal - hour) * 60)
    dt_utc = datetime(year, month, day, hour, minute)

    moon = next(p for p in chart_positions.planets if p.name == "Moon")

    return get_ruling_planets(
        dt_local=dt_utc,
        ascendant_longitude=chart_positions.ascendant,
        moon_longitude=moon.longitude,
    )
