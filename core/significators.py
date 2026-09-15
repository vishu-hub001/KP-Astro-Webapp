"""
core/significators.py

KP "4-level house significators" -- for every house (1-12), determines
which planets signify that house's matters, ranked by the four
traditional KP levels of strength. This is the calculation
api/routes_significators.py is stubbed to eventually call ("GET
/significators - 4-level house significators for a chart").

NOTE ON SCOPE: as with core/cusp_calculator.py, there is no separate
build spec for this file. The shape here follows standard KP method
(the "four significators" system as taught by K.S. Krishnamurti) and
reuses core.sub_lord_engine (for star lords) and core.cusp_calculator
(for house/sign ownership) rather than duplicating either.

The four levels, strongest to weakest, for a given house H:
  1. Planets in the star (nakshatra) of an occupant of H
     -- i.e. any planet whose star lord is itself posited in H.
  2. Occupants of H -- planets physically posited in that house.
  3. Owner of H -- the planet that rules the sign on H's cusp (the
     "cuspal sign lord", from core.cusp_calculator.get_sign_lord).
  4. Planets in the star of the owner of H -- i.e. any planet whose
     star lord is the same planet as level 3's house owner.

A planet can appear at more than one level for the same house (e.g. it
can be both an occupant AND in the star of the house owner); levels are
reported separately so callers can see the full reasoning, plus a
deduplicated "all" list in priority order for callers that just want a
ranked significator list.
"""

from __future__ import annotations

from typing import Any

from core.cusp_calculator import get_sign_lord
from core.sub_lord_engine import get_sublord_info


def _get_attr_or_key(obj: Any, name: str) -> Any:
    """
    Same duck-typing helper as core.sub_lord_engine._get_attr_or_key:
    fetch `name` from `obj` whether it's a dataclass attribute (e.g.
    PlanetPosition) or a dict key. Not imported from sub_lord_engine
    since that one is marked internal (leading underscore) to that
    module; duplicated here as a small, self-contained private helper
    rather than reaching into another module's private API.
    """
    if isinstance(obj, dict):
        return obj[name]
    return getattr(obj, name)


def _normalize_planets(planet_positions: list) -> list[dict]:
    """
    Internal helper: convert a list of PlanetPosition-like objects (or
    dicts) into a plain list of {"name": ..., "longitude": ...} dicts,
    so the rest of this module only has to deal with one shape
    regardless of what callers pass in.
    """
    return [
        {
            "name": _get_attr_or_key(p, "name"),
            "longitude": _get_attr_or_key(p, "longitude"),
        }
        for p in planet_positions
    ]


def get_house_of_longitude(longitude: float, cusps: dict[int, float]) -> int:
    """
    Determine which house (1-12) a given zodiacal longitude falls in,
    based on Placidus cusp boundaries.

    A house's span runs from its own cusp up to (but not including) the
    next house's cusp, wrapping from house 12 back to house 1 across
    360/0 -- the same convention used by
    core.cusp_calculator.compute_cusp_spans(), so a longitude sitting
    exactly on a cusp is counted as belonging to the house that starts
    there, not the one ending there.

    Args:
        longitude: Any float longitude in degrees (normalized here with
            `% 360`, so negative or >360 inputs are safe).
        cusps: Dict of house number (1-12) to cusp longitude in degrees,
            i.e. the `cusps` sub-dict from
            core.ephemeris.get_house_cusps().

    Returns:
        The house number (1-12) whose span contains `longitude`.

    Raises:
        ValueError: if no house matches (should be unreachable given 12
            cusps that fully partition the 360-degree circle, but
            guarded rather than returning None silently).
    """
    normalized = longitude % 360.0

    for house_num in range(1, 13):
        start = cusps[house_num] % 360.0
        next_house = house_num + 1 if house_num < 12 else 1
        end = cusps[next_house] % 360.0

        if start <= end:
            if start <= normalized < end:
                return house_num
        else:
            # This house's span wraps across 360/0 (e.g. cusp 12 at
            # 350deg, cusp 1 at 10deg) -- the house owns everything from
            # start to 360 AND everything from 0 up to end.
            if normalized >= start or normalized < end:
                return house_num

    raise ValueError(
        f"Longitude {normalized!r} did not fall into any house -- "
        "check that `cusps` contains all 12 house numbers and fully "
        "partitions the 360-degree circle."
    )


def get_house_occupants(
    cusps: dict[int, float], planet_positions: list
) -> dict[str, list[str]]:
    """
    Group planets by which house they occupy.

    Args:
        cusps: Dict of house number (1-12) to cusp longitude, as from
            core.ephemeris.get_house_cusps()["cusps"].
        planet_positions: List of PlanetPosition-like objects or dicts
            (each needs a "name" and "longitude").

    Returns:
        Dict of house number (as string) to the list of planet names
        occupying that house, e.g. {"1": ["Sun", "Mercury"], "2": [], ...}.
        Every house 1-12 is present as a key even if empty.
    """
    occupants: dict[str, list[str]] = {str(h): [] for h in range(1, 13)}

    for planet in _normalize_planets(planet_positions):
        house_num = get_house_of_longitude(planet["longitude"], cusps)
        occupants[str(house_num)].append(planet["name"])

    return occupants


def get_house_owners(cusps: dict[int, float]) -> dict[str, str]:
    """
    Determine the "owner" of each house -- the planet ruling the sign
    that house's cusp falls in.

    Reuses core.cusp_calculator.get_sign_lord() rather than
    reimplementing the sign-rulership table here, so there's a single
    source of truth for rasi lordships across the codebase.

    Args:
        cusps: Dict of house number (1-12) to cusp longitude.

    Returns:
        Dict of house number (as string) to owning planet name, e.g.
        {"1": "Mars", "2": "Venus", ..., "12": "Jupiter"}.
    """
    owners: dict[str, str] = {}
    for house_num in range(1, 13):
        sign = get_sublord_info(cusps[house_num])["sign"]
        owners[str(house_num)] = get_sign_lord(sign)
    return owners


def get_planet_star_lords(planet_positions: list) -> dict[str, str]:
    """
    Determine each planet's star lord (the ruler of the nakshatra the
    planet itself occupies) -- the relationship level 1 and level 4
    significators are both built from.

    Args:
        planet_positions: List of PlanetPosition-like objects or dicts.

    Returns:
        Dict of planet name to its star lord's name, e.g.
        {"Sun": "Venus", "Moon": "Mars", ...}.
    """
    star_lords: dict[str, str] = {}
    for planet in _normalize_planets(planet_positions):
        info = get_sublord_info(planet["longitude"])
        star_lords[planet["name"]] = info["star_lord"]
    return star_lords


def compute_significators(
    planet_positions: list, cusps: dict[int, float]
) -> dict[str, dict]:
    """
    Compute the full 4-level KP significators for every house (1-12).

    This is the central function of the module. For each house H:
      - level_1: planets whose star lord is an occupant of H
      - level_2: occupants of H
      - level_3: the owner of H (single-item list, for shape consistency
                 with the other levels)
      - level_4: planets whose star lord is the owner of H
      - all: levels 1-4 concatenated in priority order with duplicates
             removed (first occurrence kept), for callers that just want
             a single ranked list

    Args:
        planet_positions: List of PlanetPosition-like objects or dicts
            for all 9 KP grahas (Sun..Saturn, Rahu, Ketu).
        cusps: Dict of house number (1-12) to cusp longitude, as from
            core.ephemeris.get_house_cusps()["cusps"].

    Returns:
        {
            "1": {
                "level_1": [...],
                "level_2": [...],
                "level_3": ["Mars"],
                "level_4": [...],
                "all": [...],
            },
            "2": { ... },
            ...
            "12": { ... },
        }
    """
    occupants = get_house_occupants(cusps, planet_positions)
    owners = get_house_owners(cusps)
    star_lords = get_planet_star_lords(planet_positions)

    planet_names = [p["name"] for p in _normalize_planets(planet_positions)]

    result: dict[str, dict] = {}
    for house_num in range(1, 13):
        house_label = str(house_num)
        house_occupants = occupants[house_label]
        house_owner = owners[house_label]

        level_1 = [
            name for name in planet_names
            if star_lords[name] in house_occupants
        ]
        level_2 = list(house_occupants)
        level_3 = [house_owner]
        level_4 = [
            name for name in planet_names
            if star_lords[name] == house_owner
        ]

        all_significators: list[str] = []
        for level in (level_1, level_2, level_3, level_4):
            for name in level:
                if name not in all_significators:
                    all_significators.append(name)

        result[house_label] = {
            "level_1": level_1,
            "level_2": level_2,
            "level_3": level_3,
            "level_4": level_4,
            "all": all_significators,
        }

    return result


def get_significators_for_chart(chart_positions: Any, house_cusps: dict) -> dict:
    """
    Convenience wrapper: compute 4-level significators for a full chart
    directly from the objects core.ephemeris produces, without callers
    needing to unpack ChartPositions/planets themselves.

    Args:
        chart_positions: A core.ephemeris.ChartPositions object (or
            dict/duck-typed equivalent) with a `.planets` list.
        house_cusps: The dict shape returned by
            core.ephemeris.get_house_cusps(), i.e.
            {"julian_day_ut": ..., "ascendant": ..., "mc": ...,
             "cusps": {1: float, ..., 12: float}}.

    Returns:
        Same shape as compute_significators().
    """
    planets = _get_attr_or_key(chart_positions, "planets")
    cusps = house_cusps["cusps"]
    return compute_significators(planets, cusps)
