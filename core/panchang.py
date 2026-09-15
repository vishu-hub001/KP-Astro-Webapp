"""
core/panchang.py

Vedic Panchang -- the "five limbs" (pancha anga) of a lunisolar calendar
day, derived from the Sun and Moon's sidereal longitudes at a given
moment:

  1. Tithi     -- lunar day (1-30), based on the Moon-minus-Sun angle
  2. Vara      -- weekday and its planetary lord
  3. Nakshatra -- the Moon's lunar mansion (reuses core.sub_lord_engine,
                  which already computes this for any longitude)
  4. Yoga      -- based on the Sun-plus-Moon angle (27 named yogas)
  5. Karana    -- half-tithi (60 per lunar month; 4 fixed + a repeating
                  cycle of 7 movable karanas)

NOTE ON SCOPE: no separate build spec exists for this file. All five
calculations are standard, well-documented lunisolar calendar formulas;
however, the karana numbering/naming scheme in particular has several
easy-to-transpose conventions in different panchang software, so its
output here should be spot-checked against a trusted reference panchang
before being relied on for anything time-critical (muhurta selection,
festival dates, etc.) -- the mechanism is correct, but a single
off-by-one in a lookup table is easy to introduce silently in this kind
of calendar arithmetic.

The Sun/Moon longitudes used throughout are expected to already be
sidereal (ayanamsa-applied), matching core.ephemeris's convention -- see
that module's PlanetPosition.longitude docstring. Tithi and karana (both
based on the Moon-minus-Sun difference) are ayanamsa-independent by
construction, since a constant ayanamsa offset cancels out of a
difference; yoga (based on the Moon-plus-Sun sum) is NOT
ayanamsa-independent, but traditional panchang practice computes it from
sidereal (nirayana) longitudes anyway, which is exactly what's passed in
here.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from core.ruling_planets import get_day_lord
from core.sub_lord_engine import get_sublord_info

_TITHI_SPAN_DEG = 12.0          # 360 / 30
_YOGA_SPAN_DEG = 360.0 / 27.0
_KARANA_SPAN_DEG = 6.0          # 360 / 60 (half a tithi)

# First 14 tithi names are shared by both halves (paksha) of the lunar
# month; the 15th differs (Purnima = full moon in Shukla paksha,
# Amavasya = new moon in Krishna paksha) -- handled specially in
# get_tithi() rather than folded into this list.
_TITHI_NAMES = [
    "Pratipada", "Dwitiya", "Tritiya", "Chaturthi", "Panchami",
    "Shashthi", "Saptami", "Ashtami", "Navami", "Dashami",
    "Ekadashi", "Dwadashi", "Trayodashi", "Chaturdashi",
]

_YOGA_NAMES = [
    "Vishkambha", "Priti", "Ayushman", "Saubhagya", "Shobhana",
    "Atiganda", "Sukarma", "Dhriti", "Shula", "Ganda",
    "Vriddhi", "Dhruva", "Vyaghata", "Harshana", "Vajra",
    "Siddhi", "Vyatipata", "Variyana", "Parigha", "Shiva",
    "Siddha", "Sadhya", "Shubha", "Shukla", "Brahma",
    "Indra", "Vaidhriti",
]

# The 7 "movable" karanas repeat 8 times (56 slots) to cover karana
# numbers 2-57; karana 1 and karanas 58-60 are each a single "fixed"
# karana that occurs exactly once per lunar month.
_MOVABLE_KARANAS = ["Bava", "Balava", "Kaulava", "Taitila", "Gara", "Vanija", "Vishti"]
_FIXED_KARANAS = {1: "Kimstughna", 58: "Shakuni", 59: "Chatushpada", 60: "Naga"}


def _get_attr_or_key(obj: Any, name: str) -> Any:
    """Same duck-typing helper used across core/ modules."""
    if isinstance(obj, dict):
        return obj[name]
    return getattr(obj, name)


def get_tithi(sun_longitude: float, moon_longitude: float) -> dict:
    """
    Compute the lunar day (tithi) from the Sun and Moon's longitudes.

    A tithi is 12 degrees of Moon-minus-Sun angular separation; there
    are 30 per lunar month, split into two 15-tithi halves (paksha):
    Shukla (waxing, Moon pulling away from Sun) and Krishna (waning).

    Args:
        sun_longitude: Sun's sidereal longitude in degrees.
        moon_longitude: Moon's sidereal longitude in degrees.

    Returns:
        {
            "number": 17,               # 1-30, overall tithi count
            "name": "Dwitiya",
            "paksha": "Krishna",        # "Shukla" or "Krishna"
            "degrees_elapsed": 4.32,    # progress through this tithi's 12deg span
        }
    """
    diff = (moon_longitude - sun_longitude) % 360.0
    number = int(diff // _TITHI_SPAN_DEG) + 1  # 1-30
    degrees_elapsed = diff % _TITHI_SPAN_DEG

    if number <= 15:
        paksha = "Shukla"
        index_in_paksha = number
    else:
        paksha = "Krishna"
        index_in_paksha = number - 15

    if index_in_paksha == 15:
        name = "Purnima" if paksha == "Shukla" else "Amavasya"
    else:
        name = _TITHI_NAMES[index_in_paksha - 1]

    return {
        "number": number,
        "name": name,
        "paksha": paksha,
        "degrees_elapsed": degrees_elapsed,
    }


def get_vara(dt_local: datetime) -> dict:
    """
    Compute the vara (weekday) and its planetary lord for a given local
    datetime.

    Reuses core.ruling_planets.get_day_lord() rather than duplicating
    the weekday-to-lord table, so there's one source of truth for that
    mapping across the codebase.

    Args:
        dt_local: Local civil datetime; only its weekday is used.

    Returns:
        {"name": "Monday", "lord": "Moon"}
    """
    return {"name": dt_local.strftime("%A"), "lord": get_day_lord(dt_local)}


def get_panchang_nakshatra(moon_longitude: float) -> dict:
    """
    Compute the Moon's nakshatra (lunar mansion) for the panchang --
    thin wrapper around core.sub_lord_engine.get_sublord_info(), reusing
    the same 243-row table rather than a separate 27-row nakshatra-only
    lookup, so nakshatra boundaries are guaranteed consistent with the
    rest of the app's KP calculations.

    Args:
        moon_longitude: Moon's sidereal longitude in degrees.

    Returns:
        {"name": "Rohini", "index": 4, "lord": "Moon"}
        ("lord" here is the nakshatra's star lord, i.e. what
        get_sublord_info() calls "star_lord".)
    """
    info = get_sublord_info(moon_longitude)
    return {
        "name": info["nakshatra"],
        "index": info["nakshatra_index"],
        "lord": info["star_lord"],
    }


def get_yoga(sun_longitude: float, moon_longitude: float) -> dict:
    """
    Compute the yoga -- one of 27 named divisions of the combined
    Sun-plus-Moon longitude.

    Args:
        sun_longitude: Sun's sidereal longitude in degrees.
        moon_longitude: Moon's sidereal longitude in degrees.

    Returns:
        {"number": 9, "name": "Shula"}
    """
    total = (sun_longitude + moon_longitude) % 360.0
    number = int(total // _YOGA_SPAN_DEG) + 1  # 1-27
    return {"number": number, "name": _YOGA_NAMES[number - 1]}


def get_karana(sun_longitude: float, moon_longitude: float) -> dict:
    """
    Compute the karana -- half of a tithi (60 per lunar month: 4 fixed,
    single-occurrence karanas plus a 7-karana cycle repeated 8 times).

    See the module docstring's caution about this specific calculation:
    the fixed/movable numbering convention used here (karana 1 =
    Kimstughna; 2-57 cycle through the 7 movable karanas; 58-60 =
    Shakuni, Chatushpada, Naga) is the standard scheme, but should be
    verified against a trusted panchang if used for anything
    time-critical.

    Args:
        sun_longitude: Sun's sidereal longitude in degrees.
        moon_longitude: Moon's sidereal longitude in degrees.

    Returns:
        {"number": 23, "name": "Taitila"}
    """
    diff = (moon_longitude - sun_longitude) % 360.0
    number = int(diff // _KARANA_SPAN_DEG) + 1  # 1-60

    if number in _FIXED_KARANAS:
        name = _FIXED_KARANAS[number]
    else:
        name = _MOVABLE_KARANAS[(number - 2) % 7]

    return {"number": number, "name": name}


def compute_panchang(
    dt_local: datetime, sun_longitude: float, moon_longitude: float
) -> dict:
    """
    Compute all five panchang limbs at once for a given moment.

    Args:
        dt_local: Local civil datetime (used for the vara/weekday).
        sun_longitude: Sun's sidereal longitude in degrees.
        moon_longitude: Moon's sidereal longitude in degrees.

    Returns:
        {
            "tithi": { ... get_tithi() shape ... },
            "vara": { ... get_vara() shape ... },
            "nakshatra": { ... get_panchang_nakshatra() shape ... },
            "yoga": { ... get_yoga() shape ... },
            "karana": { ... get_karana() shape ... },
        }
    """
    return {
        "tithi": get_tithi(sun_longitude, moon_longitude),
        "vara": get_vara(dt_local),
        "nakshatra": get_panchang_nakshatra(moon_longitude),
        "yoga": get_yoga(sun_longitude, moon_longitude),
        "karana": get_karana(sun_longitude, moon_longitude),
    }


def get_panchang_for_chart(chart_positions: Any, dt_local: datetime) -> dict:
    """
    Convenience wrapper: compute the panchang directly from a
    core.ephemeris.ChartPositions object, pulling the Sun and Moon
    longitudes out automatically.

    Args:
        chart_positions: A core.ephemeris.ChartPositions object (or
            dict/duck-typed equivalent) with a `.planets` list.
        dt_local: Local civil datetime for the vara calculation (passed
            separately for the same reason noted in
            core.ruling_planets.get_ruling_planets_for_chart --
            ChartPositions only stores the UT julian day, not the
            original local civil datetime).

    Returns:
        Same shape as compute_panchang().
    """
    planets = _get_attr_or_key(chart_positions, "planets")
    sun = next(p for p in planets if _get_attr_or_key(p, "name") == "Sun")
    moon = next(p for p in planets if _get_attr_or_key(p, "name") == "Moon")

    return compute_panchang(
        dt_local=dt_local,
        sun_longitude=_get_attr_or_key(sun, "longitude"),
        moon_longitude=_get_attr_or_key(moon, "longitude"),
    )
