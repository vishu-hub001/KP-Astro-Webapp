"""
kp_analysis/event_timing.py

Event timing -- the second half of KP prediction, after
kp_analysis.cuspal_interlink has established WHICH houses matter for a
given question: this module scans the Vimshottari Dasha tree
(dasha.vimshottari) to find WHEN those houses are likely to activate,
by checking which running periods' lords signify the relevant houses
(dasha.dasha_significator_link).

The standard KP timing rule: an event tied to a set of houses tends to
manifest during the dasha (Mahadasha/Bhukti/Antara) of a planet that
signifies those houses -- and most confidently when the Mahadasha,
Antardasha, AND Pratyantardasha lords all agree (their combined/common
significations hit the target houses).

NOTE ON SCOPE: no separate build spec exists for this file. As with
kp_analysis.cuspal_interlink, this module does not hardcode which
houses matter for which life event (marriage, career, litigation, etc.)
-- callers supply favorable_houses/unfavorable_houses, matching that
module's approach, so the same house-grouping rules can be reused
across both interlink judgment and event timing for a given question.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from dasha.dasha_significator_link import annotate_dasha_tree
from dasha.vimshottari import compute_vimshottari_dasha


def classify_period(
    period: dict, favorable_houses: list[int], unfavorable_houses: list[int]
) -> str:
    """
    Classify a single (already-annotated) dasha period against a set of
    favorable/unfavorable houses, using the same four-way verdict
    vocabulary as kp_analysis.cuspal_interlink.judge_house() for a
    consistent API across both modules:

        "strongly_favorable"   -- signifies favorable houses only
        "strongly_unfavorable" -- signifies unfavorable houses only
        "mixed"                -- signifies both
        "inconclusive"          -- signifies neither

    Uses the period's "common_significations" when present (i.e. this
    period agrees with its parent period's lord -- see
    dasha.dasha_significator_link.annotate_dasha_tree), since that's a
    stronger, more specific signal than the period's own lord considered
    in isolation. Falls back to the period's own "significations" (its
    lord's full signification list) when "common_significations" isn't
    present -- which is always the case for a top-level Mahadasha, since
    it has no parent to intersect against.

    Args:
        period: A single annotated period dict (Mahadasha, Bhukti, or
            Antara) from dasha.dasha_significator_link.annotate_dasha_tree().
        favorable_houses: House numbers supporting the matter.
        unfavorable_houses: House numbers denying the matter.

    Returns:
        One of the four verdict strings above.
    """
    if "common_significations" in period:
        houses_signified = set(period["common_significations"])
    else:
        houses_signified = set(period["significations"]["all"])

    favorable_set = {str(h) for h in favorable_houses}
    unfavorable_set = {str(h) for h in unfavorable_houses}

    has_favorable = bool(houses_signified & favorable_set)
    has_unfavorable = bool(houses_signified & unfavorable_set)

    if has_favorable and has_unfavorable:
        return "mixed"
    if has_favorable:
        return "strongly_favorable"
    if has_unfavorable:
        return "strongly_unfavorable"
    return "inconclusive"


def _iter_periods_at_level(dasha_tree: list[dict], level: str):
    """
    Internal helper: yield every period dict at a given nesting level of
    an annotated dasha tree, alongside its lineage (the lord names of
    its parent periods, for building a readable label).

    Args:
        dasha_tree: List of Mahadasha dicts (with "bhuktis"/"antaras" as
            produced by dasha.vimshottari + dasha.dasha_significator_link).
        level: "mahadasha", "antardasha", or "pratyantardasha".

    Yields:
        (period_dict, lineage) tuples, where lineage is a list of lord
        names from Mahadasha down to (but not including) `period_dict`
        itself.
    """
    for md in dasha_tree:
        if level == "mahadasha":
            yield md, []
            continue

        for ad in md.get("bhuktis", []):
            if level == "antardasha":
                yield ad, [md["lord"]]
                continue

            for pd in ad.get("antaras", []):
                if level == "pratyantardasha":
                    yield pd, [md["lord"], ad["lord"]]


def find_favorable_periods(
    dasha_tree: list[dict],
    favorable_houses: list[int],
    unfavorable_houses: list[int],
    level: str = "pratyantardasha",
    include_verdicts: tuple[str, ...] = ("strongly_favorable",),
) -> list[dict]:
    """
    Scan an annotated dasha tree for periods at a given level whose
    verdict (per classify_period()) matches one of `include_verdicts`,
    returning them in chronological order -- the actual "when will this
    happen" answer.

    Args:
        dasha_tree: List of Mahadasha dicts, annotated with
            dasha.dasha_significator_link.annotate_dasha_tree() (must
            have been computed with enough `levels` in
            dasha.vimshottari.compute_vimshottari_dasha() to reach
            `level` below -- e.g. level="pratyantardasha" needs the tree
            computed with levels=3).
        favorable_houses: House numbers supporting the matter.
        unfavorable_houses: House numbers denying the matter.
        level: Which nesting level to scan: "mahadasha", "antardasha",
            or "pratyantardasha" (default -- the finest-grained level
            usually gives the most useful timing precision).
        include_verdicts: Which classify_period() verdicts count as a
            match. Defaults to ("strongly_favorable",) only; a caller
            wanting to also see "mixed" periods (common in practice,
            since a clean strongly_favorable Pratyantardasha isn't
            always available) can pass
            ("strongly_favorable", "mixed").

    Returns:
        List of dicts, one per matching period, in chronological order:
        {
            "lineage": ["Venus", "Sun"],   # parent lords above this period
            "lord": "Rahu",
            "start_date": datetime(...),
            "end_date": datetime(...),
            "verdict": "strongly_favorable",
        }
        ("lineage" is empty for level="mahadasha", has one entry --
        the Mahadasha lord -- for level="antardasha", and two entries
        for level="pratyantardasha".)
    """
    matches: list[dict] = []

    for period, lineage in _iter_periods_at_level(dasha_tree, level):
        verdict = classify_period(period, favorable_houses, unfavorable_houses)
        if verdict in include_verdicts:
            matches.append({
                "lineage": lineage,
                "lord": period["lord"],
                "start_date": period["start_date"],
                "end_date": period["end_date"],
                "verdict": verdict,
            })

    matches.sort(key=lambda m: m["start_date"])
    return matches


def get_event_timing_windows(
    moon_longitude: float,
    birth_datetime: datetime,
    significators: dict[str, dict],
    favorable_houses: list[int],
    unfavorable_houses: list[int],
    level: str = "pratyantardasha",
    include_verdicts: tuple[str, ...] = ("strongly_favorable",),
    num_cycles: int = 1,
) -> list[dict]:
    """
    High-level convenience: build the Vimshottari Dasha tree, annotate
    it with house significations, and find the favorable timing windows
    for a matter, all in one call.

    Args:
        moon_longitude: Natal Moon's zodiacal longitude in degrees.
        birth_datetime: Birth datetime (local civil time).
        significators: As returned by core.significators.compute_significators().
        favorable_houses: House numbers supporting the matter.
        unfavorable_houses: House numbers denying the matter.
        level: See find_favorable_periods(). The dasha tree is computed
            with just enough depth to reach this level (levels=1 for
            "mahadasha", 2 for "antardasha", 3 for "pratyantardasha"),
            so no wasted computation at deeper levels than requested.
        include_verdicts: See find_favorable_periods().
        num_cycles: See dasha.vimshottari.generate_mahadasha_sequence().

    Returns:
        Same shape as find_favorable_periods().
    """
    depth_by_level = {"mahadasha": 1, "antardasha": 2, "pratyantardasha": 3}
    if level not in depth_by_level:
        raise ValueError(
            f"level must be one of {list(depth_by_level)}, got {level!r}"
        )

    dasha_tree = compute_vimshottari_dasha(
        moon_longitude=moon_longitude,
        birth_datetime=birth_datetime,
        num_cycles=num_cycles,
        levels=depth_by_level[level],
    )
    annotate_dasha_tree(dasha_tree, significators)

    return find_favorable_periods(
        dasha_tree,
        favorable_houses=favorable_houses,
        unfavorable_houses=unfavorable_houses,
        level=level,
        include_verdicts=include_verdicts,
    )


def get_event_timing_for_chart(
    chart_positions: Any,
    house_cusps: dict,
    birth_datetime: datetime,
    favorable_houses: list[int],
    unfavorable_houses: list[int],
    level: str = "pratyantardasha",
    include_verdicts: tuple[str, ...] = ("strongly_favorable",),
    num_cycles: int = 1,
) -> list[dict]:
    """
    Convenience wrapper: compute event timing windows directly from the
    objects core.ephemeris produces, without the caller needing to pull
    out the Moon's longitude or compute significators separately first.

    Args:
        chart_positions: A core.ephemeris.ChartPositions object (or
            dict/duck-typed equivalent) with a `.planets` list.
        house_cusps: The dict shape returned by
            core.ephemeris.get_house_cusps().
        birth_datetime: Birth datetime (local civil time) -- passed
            separately for the same reason noted in
            dasha.vimshottari.get_vimshottari_dasha_for_chart()
            (ChartPositions only stores the UT julian day).
        favorable_houses: House numbers supporting the matter.
        unfavorable_houses: House numbers denying the matter.
        level: See find_favorable_periods().
        include_verdicts: See find_favorable_periods().
        num_cycles: See dasha.vimshottari.generate_mahadasha_sequence().

    Returns:
        Same shape as find_favorable_periods().
    """
    # Imported here (mirroring kp_analysis.cuspal_interlink's pattern)
    # to avoid a hard dependency on core.significators for callers of
    # this module who already have a precomputed `significators` dict
    # and only want the lower-level functions above.
    from core.significators import get_significators_for_chart

    if isinstance(chart_positions, dict):
        planets = chart_positions["planets"]
    else:
        planets = chart_positions.planets

    moon = None
    for p in planets:
        name = p["name"] if isinstance(p, dict) else p.name
        if name == "Moon":
            moon = p
            break
    if moon is None:
        raise ValueError("No planet named 'Moon' found in chart_positions.planets")

    moon_longitude = moon["longitude"] if isinstance(moon, dict) else moon.longitude

    significators = get_significators_for_chart(chart_positions, house_cusps)

    return get_event_timing_windows(
        moon_longitude=moon_longitude,
        birth_datetime=birth_datetime,
        significators=significators,
        favorable_houses=favorable_houses,
        unfavorable_houses=unfavorable_houses,
        level=level,
        include_verdicts=include_verdicts,
        num_cycles=num_cycles,
    )
