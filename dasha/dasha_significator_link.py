"""
dasha/dasha_significator_link.py

Links Vimshottari Dasha periods (dasha/vimshottari.py) to house
significators (core/significators.py) -- the actual KP prediction
technique: a house's matters are expected to manifest during the dasha
(Mahadasha/Bhukti/Antara) of a planet that significates that house, and
predictions get sharper when the running Mahadasha lord, Antardasha
lord, and Pratyantardasha lord all point toward the same house(s)
("common significations").

NOTE ON SCOPE: no separate build spec exists for this file, same as the
other cross-cutting modules built so far. core.significators.compute_significators()
returns a HOUSE -> planets mapping (given a house, which planets signify
it); this module's central job is inverting that into a PLANET -> houses
mapping (given a planet -- specifically, a running dasha lord -- which
houses does it signify), then attaching that to a dasha tree.
"""

from __future__ import annotations

_LEVELS = ("level_1", "level_2", "level_3", "level_4")


def invert_significators(significators: dict[str, dict]) -> dict[str, dict]:
    """
    Invert a house-keyed significators dict (as returned by
    core.significators.compute_significators()) into a planet-keyed one:
    for each planet, which houses it signifies at each of the 4 KP
    levels.

    Args:
        significators: {"1": {"level_1": [...], ..., "all": [...]}, ...,
            "12": {...}}, i.e. compute_significators()'s return value.

    Returns:
        {
            "Sun": {
                "level_1": ["3", "7"],
                "level_2": ["3"],
                "level_3": [],
                "level_4": ["10"],
                "all": ["3", "7", "10"],
            },
            "Moon": { ... },
            ...
        }
        Every planet that appears anywhere in `significators` gets an
        entry; a planet with no significations at a given level simply
        has an empty list there. House numbers are listed in ascending
        house-number order at each level (not dasha or discovery order,
        since there's no natural such order here).
    """
    # Collect, per planet, the set of houses at which it appears at each
    # level -- using sets first since a planet can legitimately appear
    # at the same level for multiple houses, and insertion order across
    # houses isn't meaningful here (unlike core.significators' own "all"
    # list, which preserves level-priority order for a single house).
    by_planet: dict[str, dict[str, set]] = {}

    for house_label, levels in significators.items():
        for level in _LEVELS:
            for planet in levels.get(level, []):
                entry = by_planet.setdefault(
                    planet, {lvl: set() for lvl in _LEVELS}
                )
                entry[level].add(house_label)

    result: dict[str, dict] = {}
    for planet, level_sets in by_planet.items():
        sorted_levels = {
            level: sorted(houses, key=int) for level, houses in level_sets.items()
        }
        all_houses: list[str] = []
        for level in _LEVELS:
            for house in sorted_levels[level]:
                if house not in all_houses:
                    all_houses.append(house)
        all_houses.sort(key=int)

        result[planet] = {**sorted_levels, "all": all_houses}

    return result


def get_planet_significations(
    planet: str, significators: dict[str, dict]
) -> dict:
    """
    Convenience wrapper: get a single planet's house significations
    without building the full inverted map for every planet.

    Args:
        planet: Planet name, e.g. "Venus".
        significators: As returned by core.significators.compute_significators().

    Returns:
        {"level_1": [...], "level_2": [...], "level_3": [...],
         "level_4": [...], "all": [...]} for just this planet. If the
        planet signifies nothing at any level (shouldn't normally happen
        for one of the 9 KP grahas in a real chart, but guarded rather
        than raising), every list is empty.
    """
    inverted = invert_significators(significators)
    empty = {level: [] for level in _LEVELS}
    empty["all"] = []
    return inverted.get(planet, empty)


def get_common_significations(
    lords: list[str], significators: dict[str, dict]
) -> list[str]:
    """
    Find houses signified by ALL of the given lords -- the KP technique
    of narrowing predictions by looking for agreement across the running
    Mahadasha/Antardasha/Pratyantardasha lords (or any other set of
    planets a caller wants to intersect).

    Args:
        lords: List of planet names, e.g. the current
            [mahadasha_lord, antardasha_lord, pratyantardasha_lord].
        significators: As returned by core.significators.compute_significators().

    Returns:
        Sorted (by house number) list of house labels signified by every
        planet in `lords` (using each planet's "all" significations,
        i.e. across all 4 levels). Empty list if `lords` is empty or
        there's no common house.
    """
    if not lords:
        return []

    inverted = invert_significators(significators)
    house_sets = [
        set(inverted.get(lord, {"all": []})["all"]) for lord in lords
    ]

    common = house_sets[0]
    for s in house_sets[1:]:
        common &= s

    return sorted(common, key=int)


def annotate_dasha_period(period: dict, significators: dict[str, dict]) -> dict:
    """
    Attach house-signification data to a single dasha period dict (a
    Mahadasha, Bhukti, or Antara entry from dasha.vimshottari), based on
    that period's own lord. Mutates and returns the same dict (matching
    the in-place style dasha.vimshottari.compute_vimshottari_dasha()
    already uses when attaching "bhuktis"/"antaras").

    Args:
        period: A single period dict with at least a "lord" key (as
            produced by dasha.vimshottari's generators).
        significators: As returned by core.significators.compute_significators().

    Returns:
        The same `period` dict, with a "significations" key added:
        {"level_1": [...], ..., "all": [...]} for that period's lord.
    """
    period["significations"] = get_planet_significations(
        period["lord"], significators
    )
    return period


def annotate_dasha_tree(
    dasha_tree: list[dict], significators: dict[str, dict]
) -> list[dict]:
    """
    Walk a full Vimshottari Dasha tree (as returned by
    dasha.vimshottari.compute_vimshottari_dasha()) and attach house
    significations to every period at every level present (Mahadasha,
    and Bhukti/Antara if the tree was computed with levels >= 2/3), plus
    a "common_significations" list at the Bhukti and Antara levels
    showing houses agreed upon by that period's own lord chain (e.g. a
    Bhukti's common_significations = houses signified by BOTH the
    Mahadasha lord and this Bhukti's lord).

    Mutates the tree in place (same style as dasha.vimshottari) and
    returns it for convenience.

    Args:
        dasha_tree: List of Mahadasha dicts, as from
            dasha.vimshottari.compute_vimshottari_dasha().
        significators: As returned by core.significators.compute_significators().

    Returns:
        The same `dasha_tree`, annotated in place.
    """
    for md in dasha_tree:
        annotate_dasha_period(md, significators)

        bhuktis = md.get("bhuktis")
        if not bhuktis:
            continue

        for ad in bhuktis:
            annotate_dasha_period(ad, significators)
            ad["common_significations"] = get_common_significations(
                [md["lord"], ad["lord"]], significators
            )

            antaras = ad.get("antaras")
            if not antaras:
                continue

            for pd in antaras:
                annotate_dasha_period(pd, significators)
                pd["common_significations"] = get_common_significations(
                    [md["lord"], ad["lord"], pd["lord"]], significators
                )

    return dasha_tree
