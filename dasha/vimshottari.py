"""
dasha/vimshottari.py

Vimshottari Dasha -- the primary predictive timing system in Vedic/KP
astrology. Computes the nested Mahadasha (Dasha) -> Antardasha (Bhukti)
-> Pratyantardasha (Antara) -> Sookshma Dasha -> Prana Dasha period tree
from a natal Moon position, per api/routes_dasha.py's stated scope
("Vimshottari Dasha down to Prana Dasha").

NOTE ON SCOPE: no separate build spec exists for this file. The
mechanics implemented here are standard Vimshottari:

- A fixed 9-planet lord sequence, each with a fixed number of years,
  totaling a 120-year cycle:
      Ketu(7) - Venus(20) - Sun(6) - Moon(10) - Mars(7) - Rahu(18) -
      Jupiter(16) - Saturn(19) - Mercury(17)
  (Same order/years used by scripts/generate_sublord_table.py to build
  the nakshatra sub-lord table -- Vimshottari years are literally what
  the sub-lord divisions are proportional to.)
- The Mahadasha lord running at birth is the star lord (nakshatra lord)
  of the natal Moon; the BALANCE of that first Mahadasha remaining at
  birth is proportional to how much of that nakshatra's arc the Moon has
  already crossed.
- Every level of sub-period (Bhukti within a Mahadasha, Antara within a
  Bhukti) follows the same rule: the sub-period sequence starts from the
  parent period's own lord and cycles through the fixed 9-lord order,
  with each sub-period's duration proportional to
  (parent_duration * sub_lord_years / 120).

Calendar arithmetic uses a fixed 365.25-day year (the standard
approximation used across most Vimshottari software/panchang tools) --
this is a deliberate simplification, not a precise solar-year
measurement; flagged here since it's the one place this module departs
from exact astronomical calculation.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from core.sub_lord_engine import get_sublord_info

# Same fixed order and year-lengths as scripts/generate_sublord_table.py
# -- kept as a small local copy here (rather than importing from a
# scripts/ file, which isn't meant to be a reusable library module) so
# this module has no dependency on the generation script.
PLANET_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
DASHA_YEARS = {
    "Ketu": 7, "Venus": 20, "Sun": 6, "Moon": 10, "Mars": 7,
    "Rahu": 18, "Jupiter": 16, "Saturn": 19, "Mercury": 17,
}
TOTAL_CYCLE_YEARS = sum(DASHA_YEARS.values())  # 120

# Days per Vimshottari "year" -- see module docstring.
YEAR_DAYS = 365.25

_NAKSHATRA_SPAN_DEG = 360.0 / 27.0


def _get_attr_or_key(obj: Any, name: str) -> Any:
    """Same duck-typing helper used across core/ and dasha/ modules."""
    if isinstance(obj, dict):
        return obj[name]
    return getattr(obj, name)


def get_dasha_balance_at_birth(moon_longitude: float) -> dict:
    """
    Determine the Mahadasha lord running at birth and how many years of
    that Mahadasha remain (the "balance") as of the birth moment.

    The starting lord is simply the Moon's star lord (nakshatra lord).
    The balance is the FRACTION OF THE NAKSHATRA REMAINING (not yet
    traversed by the Moon) multiplied by that lord's total Vimshottari
    years -- e.g. if the Moon is exactly halfway through a nakshatra
    ruled by Venus (20 years), the balance is 10 years.

    Args:
        moon_longitude: Natal Moon's zodiacal longitude in degrees.

    Returns:
        {"lord": "Venus", "balance_years": 10.0}
    """
    info = get_sublord_info(moon_longitude)
    lord = info["star_lord"]

    dms = info["degree_in_nakshatra"]
    elapsed_deg = dms["deg"] + dms["min"] / 60.0 + dms["sec"] / 3600.0
    elapsed_fraction = elapsed_deg / _NAKSHATRA_SPAN_DEG
    remaining_fraction = 1.0 - elapsed_fraction

    balance_years = remaining_fraction * DASHA_YEARS[lord]

    return {"lord": lord, "balance_years": balance_years}


def _generate_sub_periods(
    parent_lord: str, parent_start: datetime, parent_duration_years: float
) -> list[dict]:
    """
    Internal helper: generate the 9 sub-periods of a period, per the
    rule described in the module docstring -- the sequence starts from
    the parent period's own lord and cycles through the fixed 9-lord
    order, each sub-period's duration proportional to
    (parent_duration * sub_lord_years / 120).

    This single helper implements both "Bhuktis within a Mahadasha" and
    "Antaras within a Bhukti" (and would work for a 4th level too, if
    ever needed) since the rule is identical at every level -- only the
    key names in the returned dicts differ by caller.

    Args:
        parent_lord: The lord the sub-period sequence starts from.
        parent_start: Start datetime of the parent period.
        parent_duration_years: Total duration of the parent period, in
            Vimshottari years.

    Returns:
        List of 9 dicts: {"lord": str, "start_date": datetime,
        "end_date": datetime, "duration_years": float}, in chronological
        order, exactly spanning parent_start to
        parent_start + parent_duration_years.
    """
    start_idx = PLANET_ORDER.index(parent_lord)
    sub_periods: list[dict] = []
    current_start = parent_start

    for i in range(9):
        lord = PLANET_ORDER[(start_idx + i) % 9]
        duration_years = parent_duration_years * DASHA_YEARS[lord] / TOTAL_CYCLE_YEARS
        current_end = current_start + timedelta(days=duration_years * YEAR_DAYS)

        sub_periods.append({
            "lord": lord,
            "start_date": current_start,
            "end_date": current_end,
            "duration_years": duration_years,
        })
        current_start = current_end

    return sub_periods


def _generate_sub_periods_from_balance(
    parent_lord: str,
    parent_start: datetime,
    full_duration_years: float,
    elapsed_years: float,
) -> tuple[list[dict], float, float]:
    """
    Generate the REMAINING sub-periods of a period that is only PARTIALLY
    left to run at `parent_start` -- i.e. the first Mahadasha (whose
    balance is what's left of a Mahadasha that started before birth), or
    recursively the first Bhukti of that first Mahadasha, etc.

    Bug this fixes: naively calling `_generate_sub_periods(parent_lord,
    parent_start, balance_years)` -- i.e. dividing only the *remaining*
    balance into 9 sub-periods -- squeezes all 9 sub-periods into the
    balance window. That's wrong: only the FIRST sub-period (the one
    actually running at `parent_start`) is partial; every sub-period
    after it must run its full, undivided natural length, exactly as if
    the whole 9-part cycle had been laid out from the true (pre-birth)
    start of the parent period.

    Args:
        parent_lord: Lord the full 9-part sub-period sequence starts from.
        parent_start: The moment sub-periods should start being reported
            from (e.g. birth datetime) -- NOT the true start of the
            parent period.
        full_duration_years: The parent period's TRUE, undivided length
            (e.g. 20 years for a Venus Mahadasha), even though only part
            of it remains at `parent_start`.
        elapsed_years: How much of `full_duration_years` had already
            passed before `parent_start` (so `full_duration_years -
            elapsed_years` is the balance actually remaining).

    Returns:
        (sub_periods, first_full_duration_years, first_elapsed_years) --
        sub_periods is the list of {"lord","start_date","end_date",
        "duration_years"} dicts from the currently-running sub-period
        (partial) through the last of the 9, in chronological order,
        spanning parent_start to parent_start + (full_duration_years -
        elapsed_years). The other two return values are the FULL
        duration and elapsed time of that first (partial) sub-period,
        so a caller can recurse into ITS sub-periods (e.g. Antaras of
        the currently-running Bhukti) with this same balance-aware rule.
    """
    start_idx = PLANET_ORDER.index(parent_lord)

    # Full-length (undivided) duration of each of the 9 sub-periods, as
    # if the parent period ran its complete natural length.
    full_subs = [
        {
            "lord": PLANET_ORDER[(start_idx + i) % 9],
            "duration_years": full_duration_years * DASHA_YEARS[PLANET_ORDER[(start_idx + i) % 9]] / TOTAL_CYCLE_YEARS,
        }
        for i in range(9)
    ]

    # Find which of the 9 full sub-periods `elapsed_years` falls into --
    # that's the one currently running at parent_start.
    cum = 0.0
    entry_idx = 8
    elapsed_in_entry = elapsed_years
    for i, sp in enumerate(full_subs):
        if elapsed_years < cum + sp["duration_years"] or i == 8:
            entry_idx = i
            elapsed_in_entry = elapsed_years - cum
            break
        cum += sp["duration_years"]

    sub_periods: list[dict] = []
    current_start = parent_start
    first_full_duration = full_subs[entry_idx]["duration_years"]
    first_elapsed = max(0.0, elapsed_in_entry)

    for offset, i in enumerate(range(entry_idx, 9)):
        sp = full_subs[i]
        duration_years = sp["duration_years"] - first_elapsed if offset == 0 else sp["duration_years"]
        current_end = current_start + timedelta(days=duration_years * YEAR_DAYS)

        sub_periods.append({
            "lord": sp["lord"],
            "start_date": current_start,
            "end_date": current_end,
            "duration_years": duration_years,
        })
        current_start = current_end

    return sub_periods, first_full_duration, first_elapsed


# Nested-key name used at each depth below Mahadasha, in order:
# level 2 = Antardasha (stored under "bhuktis"), level 3 = Pratyantardasha
# ("antaras"), level 4 = Sookshma Dasha ("sookshmas"), level 5 = Prana
# Dasha ("pranas"). CHILD_KEYS[levels-2] is the key added at `levels`.
CHILD_KEYS = ["bhuktis", "antaras", "sookshmas", "pranas"]


def _expand_full_subtree(period: dict, remaining_keys: list[str]) -> None:
    """
    Recursively attach full (non-balance-partial) sub-periods to
    `period` in place, one nested key per entry in `remaining_keys`, in
    order -- e.g. remaining_keys=["antaras","sookshmas"] adds
    period["antaras"], and to each of THOSE adds an "sookshmas" list.

    Used for every branch of the tree except the single "currently
    running at birth" chain (which instead uses
    _expand_balance_subtree below), since only that one chain has a
    partial first period at each level.
    """
    if not remaining_keys:
        return
    key, *rest = remaining_keys
    children = _generate_sub_periods(period["lord"], period["start_date"], period["duration_years"])
    period[key] = children
    for child in children:
        _expand_full_subtree(child, rest)


def _expand_balance_subtree(
    period: dict,
    remaining_keys: list[str],
    full_duration_years: float,
    elapsed_years: float,
) -> None:
    """
    Recursively attach sub-periods to `period` in place, one nested key
    per entry in `remaining_keys`, where `period` itself is a PARTIAL
    period (only part of `full_duration_years` remains, `elapsed_years`
    of it already passed before `period["start_date"]`) -- i.e. this is
    the chain of "currently running since before birth" periods:
    Mahadasha -> its first Bhukti -> that Bhukti's first Antara -> etc.

    Only the FIRST child at each level inherits this same
    balance-partial treatment (it's the one actually running); every
    other child runs its full natural length via _expand_full_subtree.
    """
    if not remaining_keys:
        return
    key, *rest = remaining_keys
    children, child_full, child_elapsed = _generate_sub_periods_from_balance(
        period["lord"], period["start_date"], full_duration_years, elapsed_years
    )
    period[key] = children
    for idx, child in enumerate(children):
        if idx == 0:
            _expand_balance_subtree(child, rest, child_full, child_elapsed)
        else:
            _expand_full_subtree(child, rest)


def generate_mahadasha_sequence(
    start_lord: str,
    start_date: datetime,
    balance_years: float,
    num_cycles: int = 1,
) -> list[dict]:
    """
    Generate the sequence of Mahadashas (main dasha periods) starting
    from birth.

    The first Mahadasha in the returned list is a PARTIAL period (only
    `balance_years` long -- the balance remaining at birth); every
    subsequent Mahadasha in the same 120-year cycle runs its full
    natural length. If `num_cycles` > 1, the 9-lord sequence repeats for
    additional full 120-year cycles after the first (partial) one.

    Args:
        start_lord: The Mahadasha lord running at birth (from
            get_dasha_balance_at_birth()["lord"]).
        start_date: Birth datetime (local civil time is fine -- this is
            calendar arithmetic, not a sidereal calculation).
        balance_years: Years remaining in the first Mahadasha at birth
            (from get_dasha_balance_at_birth()["balance_years"]).
        num_cycles: How many full 9-lord/120-year cycles to generate
            after the initial partial period. Defaults to 1, which
            covers roughly a human lifetime (a partial first Mahadasha
            plus the remaining 8 full ones, i.e. up to just under 120
            years from birth).

    Returns:
        List of Mahadasha dicts, each shaped like:
        {"lord": "Venus", "start_date": ..., "end_date": ...,
         "duration_years": 10.0}
    """
    start_idx = PLANET_ORDER.index(start_lord)
    total_periods = 9 * num_cycles

    mahadashas: list[dict] = []
    current_start = start_date

    for i in range(total_periods):
        lord = PLANET_ORDER[(start_idx + i) % 9]
        duration_years = balance_years if i == 0 else float(DASHA_YEARS[lord])
        current_end = current_start + timedelta(days=duration_years * YEAR_DAYS)

        mahadashas.append({
            "lord": lord,
            "start_date": current_start,
            "end_date": current_end,
            "duration_years": duration_years,
        })
        current_start = current_end

    return mahadashas


def compute_vimshottari_dasha(
    moon_longitude: float,
    birth_datetime: datetime,
    num_cycles: int = 1,
    levels: int = 3,
) -> list[dict]:
    """
    Compute the full nested Vimshottari Dasha tree for a chart.

    Args:
        moon_longitude: Natal Moon's zodiacal longitude in degrees.
        birth_datetime: Birth datetime (local civil time).
        num_cycles: See generate_mahadasha_sequence(). Defaults to 1
            (covers roughly a lifetime).
        levels: How many levels deep to expand:
            1 = Mahadasha only
            2 = + Antardasha (Bhukti)
            3 = + Pratyantardasha (Antara)
            4 = + Sookshma Dasha
            5 = + Prana Dasha [deepest supported]
            Deeper levels cost more to compute (9x per level: 9
            Mahadashas -> 81 Bhuktis -> 729 Antaras -> 6,561 Sookshmas ->
            59,049 Pranas at levels=5), so callers that only need
            top-level dasha timing should pass a smaller `levels` to
            skip the rest.

    Returns:
        List of Mahadasha dicts. Each includes "bhuktis" (a list of the
        same shape, nested) when levels >= 2; each bhukti includes
        "antaras" when levels >= 3; each antara includes "sookshmas"
        when levels >= 4; each sookshma includes "pranas" when
        levels >= 5:
        [
            {
                "lord": "Venus", "start_date": ..., "end_date": ...,
                "duration_years": 10.0,
                "bhuktis": [
                    {
                        "lord": "Venus", "start_date": ..., "end_date": ...,
                        "duration_years": 1.667,
                        "antaras": [
                            {
                                "lord": ..., "start_date": ..., "end_date": ...,
                                "duration_years": ...,
                                "sookshmas": [
                                    {
                                        "lord": ..., "start_date": ..., "end_date": ...,
                                        "duration_years": ...,
                                        "pranas": [ {...}, ... 9 items ... ],
                                    },
                                    ... 9 items ...
                                ],
                            },
                            ... 9 items ...
                        ],
                    },
                    ... 9 items ...
                ],
            },
            ... 9 (or 9*num_cycles) items ...
        ]
    """
    balance = get_dasha_balance_at_birth(moon_longitude)
    mahadashas = generate_mahadasha_sequence(
        start_lord=balance["lord"],
        start_date=birth_datetime,
        balance_years=balance["balance_years"],
        num_cycles=num_cycles,
    )

    # Which nested keys to add below Mahadasha, in order -- e.g.
    # levels=3 means CHILD_KEYS[:2] == ["bhuktis", "antaras"].
    keys = CHILD_KEYS[: max(0, levels - 1)]

    if keys:
        for idx, md in enumerate(mahadashas):
            if idx == 0:
                # This Mahadasha is only a BALANCE (it started running
                # before birth), so every level below it must be
                # expanded with the same balance-aware rule, down to
                # whatever depth was requested.
                full_years = float(DASHA_YEARS[md["lord"]])
                elapsed_years = full_years - md["duration_years"]
                _expand_balance_subtree(md, keys, full_years, elapsed_years)
            else:
                # Every later Mahadasha in the sequence hasn't started
                # yet, so it (and everything below it) runs its full
                # natural length.
                _expand_full_subtree(md, keys)

    return mahadashas


def get_vimshottari_dasha_for_chart(
    chart_positions: Any,
    birth_datetime: datetime,
    num_cycles: int = 1,
    levels: int = 3,
) -> list[dict]:
    """
    Convenience wrapper: compute the Vimshottari Dasha tree directly
    from a core.ephemeris.ChartPositions object, pulling the Moon's
    longitude out automatically.

    Args:
        chart_positions: A core.ephemeris.ChartPositions object (or
            dict/duck-typed equivalent) with a `.planets` list.
        birth_datetime: Birth datetime (local civil time). Note this is
            passed separately rather than derived from
            chart_positions.julian_day_ut, since (as in
            core.ruling_planets.get_ruling_planets_for_chart)
            ChartPositions only stores the UT julian day, and dasha
            start timing is conventionally reckoned from local civil
            birth time.
        num_cycles: See generate_mahadasha_sequence().
        levels: See compute_vimshottari_dasha().

    Returns:
        Same shape as compute_vimshottari_dasha().
    """
    planets = _get_attr_or_key(chart_positions, "planets")
    moon = next(p for p in planets if _get_attr_or_key(p, "name") == "Moon")
    moon_longitude = _get_attr_or_key(moon, "longitude")

    return compute_vimshottari_dasha(
        moon_longitude=moon_longitude,
        birth_datetime=birth_datetime,
        num_cycles=num_cycles,
        levels=levels,
    )


def find_current_period(dasha_tree: list[dict], at_datetime: datetime) -> dict | None:
    """
    Walk a computed Vimshottari Dasha tree and find the most specific
    period (Mahadasha down through Prana Dasha, however deep the tree
    was computed) active at a given moment -- e.g. "what dasha is
    running today?".

    Args:
        dasha_tree: The list returned by compute_vimshottari_dasha() (or
            get_vimshottari_dasha_for_chart()). The deeper the tree was
            computed (`levels`), the more specific a result this can
            return; with fewer levels, the deeper keys below simply
            won't exist and are skipped.
        at_datetime: The moment to look up. Must fall within the span
            covered by `dasha_tree` (i.e. within birth_datetime and
            birth_datetime + ~120*num_cycles years) or no match is found.

    Returns:
        {
            "mahadasha": "Venus",
            "antardasha": "Sun",        # only present if the tree has bhuktis
            "pratyantardasha": "Rahu",  # only present if it has antaras
            "sookshma": "Jupiter",      # only present if it has sookshmas
            "prana": "Saturn",          # only present if it has pranas
            "start_date": ...,          # of the most specific period found
            "end_date": ...,
        }
        or None if at_datetime falls outside every period in the tree.
    """
    # (level result key, nested list key) pairs, from Antardasha down to
    # Prana Dasha -- mirrors CHILD_KEYS in dasha/vimshottari.py.
    NESTED = [
        ("antardasha", "bhuktis"),
        ("pratyantardasha", "antaras"),
        ("sookshma", "sookshmas"),
        ("prana", "pranas"),
    ]

    for md in dasha_tree:
        if not (md["start_date"] <= at_datetime < md["end_date"]):
            continue

        result = {
            "mahadasha": md["lord"],
            "start_date": md["start_date"],
            "end_date": md["end_date"],
        }

        current = md
        for result_key, list_key in NESTED:
            children = current.get(list_key)
            if not children:
                break
            match = next((c for c in children if c["start_date"] <= at_datetime < c["end_date"]), None)
            if not match:
                break
            result[result_key] = match["lord"]
            result["start_date"] = match["start_date"]
            result["end_date"] = match["end_date"]
            current = match

        return result

    return None
