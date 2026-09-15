"""
core/conjunctions.py

Planetary conjunctions -- which planets are considered "together" in a
chart, used across KP interpretation (e.g. a planet conjunct a
significator can borrow/lend its significations; a heavily conjunct
planet is judged differently for strength).

NOTE ON SCOPE: no separate build spec exists for this file. Vedic/KP
practice actually uses TWO distinct notions of "conjunction", which this
module implements as two separate functions rather than picking one:

  1. Same-sign (rashi) conjunction -- the traditional Vedic definition:
     two planets sharing the same zodiac sign are conjunct, regardless
     of how many degrees apart they are within that sign. This is what
     most classical yoga/combination rules (e.g. "Budh-Aditya Yoga" =
     Mercury conjunct Sun) actually mean.
  2. Close-degree (orb-based) conjunction -- a Western-astrology-style
     tighter definition: two planets are conjunct only if within a
     specified orb (default 10 degrees) of exact same longitude,
     regardless of sign boundaries. Some KP practitioners also use this
     narrower sense when judging how strongly two planets blend.

Both are exposed so callers (core.significators, kp_analysis modules)
can pick whichever definition a given rule needs instead of this module
silently committing to one.
"""

from __future__ import annotations

from itertools import combinations
from typing import Any

from core.sub_lord_engine import get_sublord_info

DEFAULT_ORB_DEG = 10.0


def _get_attr_or_key(obj: Any, name: str) -> Any:
    """Same duck-typing helper used across core/ modules (see
    core.sub_lord_engine._get_attr_or_key / core.significators
    equivalent) -- fetch `name` from a dataclass attribute or dict key.
    """
    if isinstance(obj, dict):
        return obj[name]
    return getattr(obj, name)


def _normalize_planets(planet_positions: list) -> list[dict]:
    """Convert PlanetPosition-like objects/dicts into plain
    {"name": ..., "longitude": ...} dicts, matching the same helper
    pattern used in core.significators.
    """
    return [
        {
            "name": _get_attr_or_key(p, "name"),
            "longitude": _get_attr_or_key(p, "longitude"),
        }
        for p in planet_positions
    ]


def angular_distance(lon1: float, lon2: float) -> float:
    """
    Shortest angular distance between two zodiacal longitudes, in
    degrees, always in [0, 180].

    Used instead of a naive `abs(lon1 - lon2)` because that breaks down
    across the 0/360 boundary (e.g. 2 degrees and 358 degrees are only 4
    degrees apart on the wheel, not 356).

    Args:
        lon1: First longitude in degrees.
        lon2: Second longitude in degrees.

    Returns:
        The shortest arc between the two points, 0-180 degrees.
    """
    diff = abs((lon1 % 360.0) - (lon2 % 360.0))
    return min(diff, 360.0 - diff)


def find_conjunctions(
    planet_positions: list, orb_deg: float = DEFAULT_ORB_DEG
) -> list[dict]:
    """
    Find every pair of planets within `orb_deg` degrees of each other
    (close-degree / orb-based conjunction -- see module docstring for
    how this differs from same-sign conjunction).

    Args:
        planet_positions: List of PlanetPosition-like objects or dicts.
        orb_deg: Maximum angular distance (degrees) for two planets to
            count as conjunct. Defaults to 10 degrees, a commonly used
            general-purpose orb; callers judging a specific yoga/rule
            with a tighter or looser traditional orb should pass their
            own value rather than relying on this default.

    Returns:
        List of conjunction dicts, one per qualifying pair, e.g.:
        [
            {"planets": ["Sun", "Mercury"], "orb": 4.32},
            {"planets": ["Moon", "Saturn"], "orb": 9.87},
        ]
        Ordered by increasing orb (tightest conjunctions first).
    """
    planets = _normalize_planets(planet_positions)
    results: list[dict] = []

    for a, b in combinations(planets, 2):
        dist = angular_distance(a["longitude"], b["longitude"])
        if dist <= orb_deg:
            results.append({"planets": [a["name"], b["name"]], "orb": dist})

    results.sort(key=lambda c: c["orb"])
    return results


def get_conjunctions_by_planet(
    planet_positions: list, orb_deg: float = DEFAULT_ORB_DEG
) -> dict[str, list[str]]:
    """
    Same orb-based conjunction data as find_conjunctions(), reshaped
    into a per-planet lookup -- convenient for callers asking "which
    planets is X conjunct with?" rather than scanning a pair list.

    Args:
        planet_positions: List of PlanetPosition-like objects or dicts.
        orb_deg: See find_conjunctions().

    Returns:
        Dict of planet name to the list of planet names it's conjunct
        with (order matches ascending orb from find_conjunctions()).
        Every input planet is present as a key, with an empty list if it
        has no conjunctions within the given orb.
    """
    planets = _normalize_planets(planet_positions)
    by_planet: dict[str, list[str]] = {p["name"]: [] for p in planets}

    for conj in find_conjunctions(planet_positions, orb_deg=orb_deg):
        p1, p2 = conj["planets"]
        by_planet[p1].append(p2)
        by_planet[p2].append(p1)

    return by_planet


def find_same_sign_conjunctions(planet_positions: list) -> list[dict]:
    """
    Find every pair of planets sharing the same zodiac sign (the
    traditional Vedic definition of conjunction -- see module docstring).

    Args:
        planet_positions: List of PlanetPosition-like objects or dicts.

    Returns:
        List of conjunction dicts grouped by sign, e.g.:
        [
            {"sign": "Leo", "planets": ["Sun", "Mercury", "Venus"]},
            {"sign": "Capricorn", "planets": ["Saturn", "Mars"]},
        ]
        Only signs occupied by 2 or more planets are included.
    """
    planets = _normalize_planets(planet_positions)

    by_sign: dict[str, list[str]] = {}
    for planet in planets:
        sign = get_sublord_info(planet["longitude"])["sign"]
        by_sign.setdefault(sign, []).append(planet["name"])

    return [
        {"sign": sign, "planets": names}
        for sign, names in by_sign.items()
        if len(names) >= 2
    ]
