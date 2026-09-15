"""
core/sub_lord_engine.py

KP (Krishnamurti Paddhati) sub-lord lookup engine.

This module is the foundational conversion layer between raw ecliptic
longitudes (as produced by `core.ephemeris`) and KP's actual predictive
unit: the sub-lord. Every downstream KP calculation -- house
significators, ruling planets, horary charts, cuspal interlinks -- starts
by asking "which sub-lord governs this degree?", so this module is meant
to be small, fast, and correct rather than clever.

The lookup table itself (`data/nakshatra_sublord_table.json`) is
pre-built elsewhere and is treated here as read-only reference data: 243
rows, sorted ascending by `start_deg`, covering 0-360 degrees with no
gaps. We never regenerate it, only read and cache it.
"""

from __future__ import annotations

import bisect
import json
from typing import Any

import config

# Module-level cache for the loaded table. Kept as a private module
# global (rather than e.g. a class attribute) so that a simple
# `from core.sub_lord_engine import get_sublord_info` just works without
# callers needing to know an engine object exists. Populated lazily on
# first use -- see load_sublord_table().
_SUBLORD_TABLE: list[dict] | None = None

# Parallel list of each row's start_deg, kept in sync with
# _SUBLORD_TABLE and used as the search key for bisect. We precompute
# this once at load time so every lookup afterwards is a pure binary
# search with no per-call list comprehension.
_START_DEGREES: list[float] | None = None

# Each nakshatra spans exactly 360/27 degrees (13 deg 20'). Used to
# compute "how far into this nakshatra is this longitude", which is a
# separate question from "which sub-lord sub-division is it in" (the
# 243 rows are sub-lord divisions, not nakshatra divisions, and sub-lord
# widths are unequal since they're proportional to vimshottari dasha
# periods).
_NAKSHATRA_SPAN_DEG = 360.0 / 27.0


def load_sublord_table() -> list[dict]:
    """
    Load the 243-row nakshatra/sub-lord table from disk and cache it.

    The table is read from `config.NAKSHATRA_SUBLORD_TABLE` exactly once
    per process; subsequent calls return the cached in-memory list. This
    matters because this function sits in the hot path of every chart
    calculation (called indirectly by every lookup below), and re-parsing
    a 243-row JSON file on every one of the ~23 lookups per chart would be
    wasteful for no benefit, since the table is static reference data
    that never changes at runtime.

    Returns:
        The full list of 243 row dicts, sorted ascending by `start_deg`.
    """
    global _SUBLORD_TABLE, _START_DEGREES

    if _SUBLORD_TABLE is None:
        with open(config.NAKSHATRA_SUBLORD_TABLE, "r", encoding="utf-8") as f:
            table = json.load(f)

        # Defensive: the table is documented as pre-sorted, but a binary
        # search over an unsorted list fails silently (wrong answers, not
        # an exception), which would be a nasty bug to track down deep in
        # a predictive astrology app. Cheap enough to verify once at load
        # time.
        starts = [row["start_deg"] for row in table]
        if starts != sorted(starts):
            raise ValueError(
                "nakshatra_sublord_table.json is not sorted ascending by "
                "start_deg; sub_lord_engine requires a sorted table for "
                "binary search lookups."
            )

        _SUBLORD_TABLE = table
        _START_DEGREES = starts

    return _SUBLORD_TABLE


def _find_row(longitude: float) -> dict:
    """
    Internal helper: binary-search the cached table for the row whose
    [start_deg, end_deg) range contains `longitude`.

    Uses `bisect.bisect_right` on the precomputed start-degree list
    rather than a linear scan, since this runs ~23 times per chart and a
    binary search over 243 rows is materially cheaper than scanning them
    all every time.

    Longitude is assumed to already be normalized to [0, 360) by the
    caller, except for the special case of exactly 360.0, which is
    treated as equivalent to 0.0 (the zodiac wraps).
    """
    table = load_sublord_table()
    starts = _START_DEGREES
    assert starts is not None  # load_sublord_table() guarantees this

    # Special-case exact 360.0: it belongs to the same row as 0.0 (the
    # last row's end_deg is 360.0 treated as inclusive specifically for
    # this wraparound case).
    if longitude == 360.0:
        longitude = 0.0

    # bisect_right gives us the index of the first start_deg strictly
    # greater than `longitude`; the row we want is the one just before
    # that, since rows are [start_deg, end_deg).
    idx = bisect.bisect_right(starts, longitude) - 1

    if idx < 0 or idx >= len(table):
        raise ValueError(
            f"No sub-lord table row found for longitude {longitude!r}. "
            "This should be impossible given a complete 0-360 degree "
            "table with no gaps -- check that "
            "data/nakshatra_sublord_table.json is intact and sorted."
        )

    row = table[idx]

    # Belt-and-suspenders: confirm the longitude actually falls within
    # this row's range (guards against a corrupted/gapped table rather
    # than trusting bisect's index math blindly).
    end_deg = row["end_deg"]
    is_last_row = idx == len(table) - 1
    in_range = (row["start_deg"] <= longitude < end_deg) or (
        is_last_row and longitude == end_deg
    )
    if not in_range:
        raise ValueError(
            f"No sub-lord table row found for longitude {longitude!r} "
            f"(nearest candidate row id {row.get('id')} covers "
            f"[{row['start_deg']}, {end_deg})). Table may have a gap."
        )

    return row


def get_sublord_info(longitude: float) -> dict:
    """
    Look up the sign, nakshatra, star lord, and sub-lord governing a
    given zodiacal longitude.

    This is THE core lookup of the entire module -- every other public
    function here is a thin convenience wrapper around this one. The
    input is normalized with `% 360` first so callers don't need to
    worry about negative longitudes or values that have drifted past 360
    (both of which happen naturally with raw ephemeris math).

    Args:
        longitude: Zodiacal longitude in degrees. Any float is accepted;
            it will be normalized into [0, 360).

    Returns:
        A dict shaped like:
        {
            "longitude": 45.1234,
            "sign": "Taurus",
            "nakshatra": "Rohini",
            "nakshatra_index": 4,
            "star_lord": "Moon",
            "sub_lord": "Mars",
            "degree_in_nakshatra": {"deg": 1, "min": 12, "sec": 30.5},
            "table_row_id": 27,
        }

    Raises:
        ValueError: if no table row matches (should be unreachable given
            an intact, gapless table, but guarded explicitly rather than
            letting a lookup fail silently into a None/KeyError deep in
            a predictive calculation).
    """
    normalized = longitude % 360.0
    # `% 360` maps an input of exactly 360.0 (or 720.0, etc.) to 0.0,
    # which is correct and consistent with treating 360.0 == 0.0 on the
    # wheel.

    row = _find_row(normalized)

    degree_in_nakshatra = normalized % _NAKSHATRA_SPAN_DEG
    deg = int(degree_in_nakshatra)
    min_float = (degree_in_nakshatra - deg) * 60
    minute = int(min_float)
    sec = (min_float - minute) * 60

    return {
        "longitude": normalized,
        "sign": row["sign"],
        "nakshatra": row["nakshatra"],
        "nakshatra_index": row["nakshatra_index"],
        "star_lord": row["star_lord"],
        "sub_lord": row["sub_lord"],
        "degree_in_nakshatra": {"deg": deg, "min": minute, "sec": sec},
        "table_row_id": row["id"],
    }


def get_sublord_for_planet(planet_position: Any) -> dict:
    """
    Convenience wrapper around get_sublord_info() for a single planet.

    Accepts a `core.ephemeris.PlanetPosition` object, but is deliberately
    duck-typed rather than type-checked against that class: it also
    accepts any object with a `.longitude` attribute, or any dict-like
    object with a `["longitude"]` key. This keeps the function usable
    from tests, mocks, or plain dicts built by callers without forcing an
    import of `core.ephemeris` just to construct a compatible object.

    Args:
        planet_position: An object or dict exposing both a longitude
            (via `.longitude` or `["longitude"]`) and a name (via
            `.name` or `["name"]`).

    Returns:
        The same dict shape as get_sublord_info(), with an added
        "planet" key holding the planet's name, e.g.:
        {
            "planet": "Mars",
            "longitude": 45.1234,
            "sign": "Taurus",
            ...
        }
    """
    longitude = _get_attr_or_key(planet_position, "longitude")
    name = _get_attr_or_key(planet_position, "name")

    info = get_sublord_info(longitude)
    return {"planet": name, **info}


def get_sublord_for_chart(chart_positions: Any) -> dict:
    """
    Batch convenience wrapper: compute sub-lord info for every planet in
    a chart, plus the Ascendant and MC.

    Accepts a `core.ephemeris.ChartPositions` object. This is the
    function most API endpoints will actually call, since a full KP
    chart analysis needs the sub-lord of every planet and angle at once
    rather than one at a time.

    Args:
        chart_positions: A ChartPositions object with `.ascendant`,
            `.mc`, and `.planets` (a list of PlanetPosition-like
            objects).

    Returns:
        {
            "ascendant": { ... get_sublord_info() shape ... },
            "mc": { ... get_sublord_info() shape ... },
            "planets": {
                "Sun": { ... },
                "Moon": { ... },
                ...
            },
        }
    """
    ascendant_lon = _get_attr_or_key(chart_positions, "ascendant")
    mc_lon = _get_attr_or_key(chart_positions, "mc")
    planets = _get_attr_or_key(chart_positions, "planets")

    planets_result = {}
    for planet in planets:
        planet_info = get_sublord_for_planet(planet)
        planets_result[planet_info["planet"]] = planet_info

    return {
        "ascendant": get_sublord_info(ascendant_lon),
        "mc": get_sublord_info(mc_lon),
        "planets": planets_result,
    }


def get_sublord_for_cusps(cusps_dict: dict) -> dict:
    """
    Convenience wrapper: compute sub-lord info for all 12 house cusps.

    Accepts the `cusps` dict shape produced by
    `core.ephemeris.get_house_cusps()`, i.e. `{1: float, ..., 12: float}`
    with integer house-number keys.

    Args:
        cusps_dict: Mapping of house number (1-12) to cusp longitude in
            degrees.

    Returns:
        A dict with STRING keys "1" through "12" (not int keys), since
        this is ultimately serialized to JSON by FastAPI and JSON object
        keys must be strings:
        {
            "1": { ... get_sublord_info() shape ... },
            "2": { ... },
            ...
            "12": { ... },
        }
    """
    return {
        str(house_num): get_sublord_info(cusp_lon)
        for house_num, cusp_lon in cusps_dict.items()
    }


def _get_attr_or_key(obj: Any, name: str) -> Any:
    """
    Internal helper: fetch `name` from `obj` whether it's a plain
    attribute (e.g. a dataclass like PlanetPosition/ChartPositions) or a
    dict-style key. Exists so get_sublord_for_planet/_chart can be
    "defensive" per spec -- accepting real ephemeris objects, plain
    dicts, or simple mocks/test doubles -- without duplicating this
    branch in every wrapper function.
    """
    if isinstance(obj, dict):
        return obj[name]
    return getattr(obj, name)
