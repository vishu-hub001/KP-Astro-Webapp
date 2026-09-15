"""
horary/horary_rules.py

Judgment rules layered on top of horary/horary_chart.py's raw horary
number lookup and chart casting:

  1. validate_horary_number_against_ruling_planets() -- the standard KP
     sanity check that the querent's chosen number is "genuine": the
     horary number's own sign lord, star lord, and sub lord should
     overlap with the Ruling Planets of the moment of judgment
     (core.ruling_planets). If there's no overlap at all, KP practice
     treats the query as not yet ripe for judgment (the querent is
     often asked to pick again).
  2. judge_horary_number() -- the same house-signification judgment
     technique as kp_analysis.cuspal_interlink.judge_house(), applied to
     the horary number's sub lord instead of a cuspal sub lord: does the
     sub lord's own significations support or deny the matter, given
     caller-supplied favorable/unfavorable houses for that matter.

NOTE ON SCOPE: as with kp_analysis.cuspal_interlink and
kp_analysis.event_timing, this module does NOT hardcode which houses
matter for which query type -- callers supply favorable_houses /
unfavorable_houses, so the same house-grouping rules used for interlink
judgment and event timing can be reused here for consistency.
"""

from __future__ import annotations

from core.cusp_calculator import get_sign_lord
from dasha.dasha_significator_link import get_planet_significations


def validate_horary_number_against_ruling_planets(
    horary_point: dict, ruling_planets: dict
) -> dict:
    """
    Check whether a chosen horary number's own lords (sign lord, star
    lord, sub lord) overlap with the Ruling Planets of the moment of
    judgment -- the standard KP "is this a genuine query" sanity check.

    Args:
        horary_point: As returned by
            horary.horary_chart.get_horary_number_info().
        ruling_planets: As returned by
            core.ruling_planets.get_ruling_planets() /
            get_ruling_planets_for_chart() -- must have an "all" key
            (the deduplicated list of every ruling planet).

    Returns:
        {
            "sign_lord": "Mercury",
            "star_lord": "Rahu",
            "sub_lord": "Jupiter",
            "matched_lords": ["Mercury", "Jupiter"],
            "is_valid": True,
        }
        "matched_lords" lists which of the horary number's three lords
        (sign/star/sub, deduplicated, in that order) appear in the
        Ruling Planets' "all" list. "is_valid" is True iff at least one
        of them matches -- callers wanting a stricter bar (e.g. requiring
        2 or more matches) can inspect "matched_lords" directly rather
        than relying on this default threshold.
    """
    sign_lord = get_sign_lord(horary_point["sign"])
    star_lord = horary_point["star_lord"]
    sub_lord = horary_point["sub_lord"]

    rp_set = set(ruling_planets["all"])

    matched_lords: list[str] = []
    for lord in (sign_lord, star_lord, sub_lord):
        if lord in rp_set and lord not in matched_lords:
            matched_lords.append(lord)

    return {
        "sign_lord": sign_lord,
        "star_lord": star_lord,
        "sub_lord": sub_lord,
        "matched_lords": matched_lords,
        "is_valid": len(matched_lords) > 0,
    }


def judge_horary_number(
    horary_point: dict,
    significators: dict[str, dict],
    favorable_houses: list[int],
    unfavorable_houses: list[int],
) -> dict:
    """
    Judge a horary number's promise using the same house-signification
    technique as kp_analysis.cuspal_interlink.judge_house(): does the
    horary number's SUB LORD signify the houses that support the
    matter, the houses that deny it, both, or neither.

    Args:
        horary_point: As returned by
            horary.horary_chart.get_horary_number_info().
        significators: As returned by
            core.significators.compute_significators() for the chart
            cast at the moment of judgment (see
            horary.horary_chart.cast_horary_chart()).
        favorable_houses: House numbers supporting the matter
            (caller-supplied -- see module docstring).
        unfavorable_houses: House numbers denying the matter
            (caller-supplied).

    Returns:
        {
            "horary_number": 137,
            "sub_lord": "Jupiter",
            "signifies_houses": [...],
            "favorable_matches": [...],
            "unfavorable_matches": [...],
            "verdict": "strongly_favorable",  # same 4-way vocabulary as
                                                # kp_analysis.cuspal_interlink
        }
    """
    sub_lord = horary_point["sub_lord"]
    signifies = get_planet_significations(sub_lord, significators)
    signified_houses = set(signifies["all"])

    favorable_set = {str(h) for h in favorable_houses}
    unfavorable_set = {str(h) for h in unfavorable_houses}

    favorable_matches = sorted(signified_houses & favorable_set, key=int)
    unfavorable_matches = sorted(signified_houses & unfavorable_set, key=int)

    if favorable_matches and unfavorable_matches:
        verdict = "mixed"
    elif favorable_matches:
        verdict = "strongly_favorable"
    elif unfavorable_matches:
        verdict = "strongly_unfavorable"
    else:
        verdict = "inconclusive"

    return {
        "horary_number": horary_point["horary_number"],
        "sub_lord": sub_lord,
        "signifies_houses": signifies["all"],
        "favorable_matches": favorable_matches,
        "unfavorable_matches": unfavorable_matches,
        "verdict": verdict,
    }
