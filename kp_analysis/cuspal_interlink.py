"""
kp_analysis/cuspal_interlink.py

Cuspal Interlink -- a core KP judgment technique: a house cusp's
matters are read through what its CUSPAL SUB LORD signifies, not the
house's own occupants/owner alone. Concretely, for house H:

  1. Find H's cuspal sub lord (core.cusp_calculator.enrich_cusp).
  2. Find every house that sub lord itself signifies
     (dasha.dasha_significator_link.get_planet_significations).
  3. Those houses are what H is "interlinked" with -- H's promise, in
     KP theory, depends on whether that linked set overlaps with the
     houses that support vs. deny the matter being judged (e.g. for
     marriage: houses 2, 7, 11 support; 1, 6, 10, 12 deny).

NOTE ON SCOPE: no separate build spec exists for this file. This module
deliberately does NOT hardcode which houses are "favorable" or
"unfavorable" for any given life matter (marriage, career, litigation,
etc.) -- those house groupings are matter-specific interpretive
judgments that vary somewhat between KP authors, and belong in
horary/horary_rules.py or a future matter-specific ruleset, not baked
into the general interlink mechanism here. Instead, judge_house() below
takes the favorable/unfavorable house lists as parameters, so this
module supplies the reusable MECHANISM and callers supply the
MATTER-SPECIFIC RULES.
"""

from __future__ import annotations

from typing import Any

from core.cusp_calculator import enrich_cusp
from dasha.dasha_significator_link import get_planet_significations


def get_cuspal_sub_lord(house_num: int, cusps: dict[int, float]) -> str:
    """
    Get the cuspal sub lord of a given house -- the single planet whose
    sub-lord division the house's cusp longitude falls in. This is the
    planet the rest of this module's analysis revolves around.

    Args:
        house_num: House number, 1-12.
        cusps: Dict of house number (1-12) to cusp longitude, as from
            core.ephemeris.get_house_cusps()["cusps"].

    Returns:
        The sub lord's planet name, e.g. "Mercury".
    """
    return enrich_cusp(str(house_num), cusps[house_num])["sub_lord"]


def get_cuspal_interlink(
    house_num: int, cusps: dict[int, float], significators: dict[str, dict]
) -> dict:
    """
    Compute the full interlink data for a single house: its cuspal sub
    lord, and every house that sub lord itself signifies (the set H is
    "linked" to).

    Args:
        house_num: House number, 1-12.
        cusps: Dict of house number (1-12) to cusp longitude.
        significators: As returned by core.significators.compute_significators().

    Returns:
        {
            "house": "7",
            "sub_lord": "Mercury",
            "signifies_houses": {
                "level_1": [...], "level_2": [...],
                "level_3": [...], "level_4": [...],
                "all": ["2", "7", "9", "11"],
            },
        }
    """
    sub_lord = get_cuspal_sub_lord(house_num, cusps)
    signifies = get_planet_significations(sub_lord, significators)

    return {
        "house": str(house_num),
        "sub_lord": sub_lord,
        "signifies_houses": signifies,
    }


def build_cuspal_interlink_map(
    cusps: dict[int, float], significators: dict[str, dict]
) -> dict[str, dict]:
    """
    Compute get_cuspal_interlink() for every house 1-12 at once -- the
    full interlink picture of a chart.

    Args:
        cusps: Dict of house number (1-12) to cusp longitude.
        significators: As returned by core.significators.compute_significators().

    Returns:
        {"1": {...get_cuspal_interlink() shape...}, "2": {...}, ..., "12": {...}}
    """
    return {
        str(h): get_cuspal_interlink(h, cusps, significators)
        for h in range(1, 13)
    }


def find_mutual_interlinks(interlink_map: dict[str, dict]) -> list[dict]:
    """
    Find pairs of houses that are RECIPROCALLY interlinked -- house A's
    cuspal sub lord signifies house B, AND house B's cuspal sub lord
    signifies house A. This mutual/reciprocal connection is treated in
    KP practice as a stronger indicator than a one-way link (e.g. for
    marriage timing, a mutual interlink between the 1st and 7th cusps'
    sub lords is considered notably supportive).

    Args:
        interlink_map: As returned by build_cuspal_interlink_map().

    Returns:
        List of {"houses": ["1", "7"]} dicts, one per mutually-linked
        pair, each pair listed once (house numbers ascending within the
        pair, pairs ordered by first house number). A house's link to
        itself (its own cuspal sub lord happening to signify its own
        house) is not reported as a "pair".
    """
    house_labels = list(interlink_map.keys())
    mutual_pairs: list[dict] = []

    for i, house_a in enumerate(house_labels):
        signifies_a = set(interlink_map[house_a]["signifies_houses"]["all"])
        for house_b in house_labels[i + 1:]:
            if house_b == house_a:
                continue
            signifies_b = set(interlink_map[house_b]["signifies_houses"]["all"])
            if house_b in signifies_a and house_a in signifies_b:
                mutual_pairs.append({"houses": sorted([house_a, house_b], key=int)})

    return mutual_pairs


def judge_house(
    house_num: int,
    cusps: dict[int, float],
    significators: dict[str, dict],
    favorable_houses: list[int],
    unfavorable_houses: list[int],
) -> dict:
    """
    Judge whether a house's cuspal sub lord supports or denies a matter,
    given the caller's own favorable/unfavorable house groupings for
    that matter (see module docstring for why those groupings aren't
    hardcoded here).

    The verdict logic follows the standard KP heuristic: what matters is
    whether the cuspal sub lord's OWN significations overlap with the
    favorable houses, the unfavorable houses, both, or neither --

        "strongly_favorable" -- overlaps favorable houses only
        "strongly_unfavorable" -- overlaps unfavorable houses only
        "mixed" -- overlaps both (a real KP outcome -- classically read
                   as the matter being delayed, partial, or contested
                   rather than a clean yes/no)
        "inconclusive" -- overlaps neither (the sub lord's significations
                   say nothing about this matter either way)

    Args:
        house_num: The house being judged, 1-12.
        cusps: Dict of house number (1-12) to cusp longitude.
        significators: As returned by core.significators.compute_significators().
        favorable_houses: House numbers whose significance supports the
            matter (caller-supplied, e.g. [2, 7, 11] for marriage).
        unfavorable_houses: House numbers whose significance denies the
            matter (caller-supplied, e.g. [1, 6, 10, 12] for marriage).

    Returns:
        {
            "house": "7",
            "sub_lord": "Mercury",
            "signifies_houses": [...],
            "favorable_matches": ["2", "11"],
            "unfavorable_matches": [],
            "verdict": "strongly_favorable",
        }
    """
    interlink = get_cuspal_interlink(house_num, cusps, significators)
    signified = set(interlink["signifies_houses"]["all"])

    favorable_set = {str(h) for h in favorable_houses}
    unfavorable_set = {str(h) for h in unfavorable_houses}

    favorable_matches = sorted(signified & favorable_set, key=int)
    unfavorable_matches = sorted(signified & unfavorable_set, key=int)

    if favorable_matches and unfavorable_matches:
        verdict = "mixed"
    elif favorable_matches:
        verdict = "strongly_favorable"
    elif unfavorable_matches:
        verdict = "strongly_unfavorable"
    else:
        verdict = "inconclusive"

    return {
        "house": interlink["house"],
        "sub_lord": interlink["sub_lord"],
        "signifies_houses": interlink["signifies_houses"]["all"],
        "favorable_matches": favorable_matches,
        "unfavorable_matches": unfavorable_matches,
        "verdict": verdict,
    }


def get_cuspal_interlink_for_chart(
    chart_positions: Any, house_cusps: dict
) -> dict[str, dict]:
    """
    Convenience wrapper: compute the full cuspal interlink map directly
    from the objects core.ephemeris produces, without the caller needing
    to compute significators separately first.

    Args:
        chart_positions: A core.ephemeris.ChartPositions object (or
            dict/duck-typed equivalent) with a `.planets` list.
        house_cusps: The dict shape returned by
            core.ephemeris.get_house_cusps().

    Returns:
        Same shape as build_cuspal_interlink_map().
    """
    # Imported here rather than at module top level to avoid a hard
    # dependency on core.significators for callers of this module who
    # already have their own precomputed `significators` dict and only
    # want the lower-level per-house functions above.
    from core.significators import get_significators_for_chart

    significators = get_significators_for_chart(chart_positions, house_cusps)
    return build_cuspal_interlink_map(house_cusps["cusps"], significators)
