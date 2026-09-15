"""
core/cusp_calculator.py

KP cuspal analysis: turns the raw house-cusp longitudes produced by
`core.ephemeris` into KP's actual predictive units for each house --
sign, sign lord (rasi lord), nakshatra, star lord, and sub lord -- via
`core.sub_lord_engine`.

NOTE ON SCOPE: there was no separate build spec for this module (unlike
core/sub_lord_engine.py, which had one). The design here follows the
conventions already established in this codebase (core/ephemeris.py's
docstrings, core/sub_lord_engine.py's function shapes) and standard KP
practice: cuspal sub-lord is what actually determines whether a house's
matters will materialize, so "enrich each cusp with its sub-lord" is the
central job. If a downstream module (core/significators.py,
kp_analysis/cuspal_interlink.py) needs a different shape, this can be
adjusted -- it's a self-contained module with no other files depending
on its exact return shape yet.

This module deliberately does NOT call Swiss Ephemeris itself. Cusp
*computation* stays in core.ephemeris (single responsibility, and
routes_chart.py already calls core.ephemeris.get_house_cusps() directly);
this module only *enriches* cusp longitudes that have already been
computed, either by taking a raw longitude or the dict shape that
core.ephemeris.get_house_cusps() returns.
"""

from __future__ import annotations

from typing import Any

from core.sub_lord_engine import get_sublord_info

# --- Sign (rasi) lordships -------------------------------------------
# Traditional Vedic/KP rulerships. KP does not use the outer planets
# (Uranus/Neptune/Pluto) as sign lords, and Rahu/Ketu are never rasi
# lords of any sign -- they only ever appear as star lords / sub lords
# via the nakshatra table. This mapping is intentionally the classical
# 7-planet dual-rulership scheme (Mercury/Venus/Mars/Jupiter/Saturn each
# rule two signs; Sun and Moon rule one each).
SIGN_LORDS: dict[str, str] = {
    "Aries": "Mars",
    "Taurus": "Venus",
    "Gemini": "Mercury",
    "Cancer": "Moon",
    "Leo": "Sun",
    "Virgo": "Mercury",
    "Libra": "Venus",
    "Scorpio": "Mars",
    "Sagittarius": "Jupiter",
    "Capricorn": "Saturn",
    "Aquarius": "Saturn",
    "Pisces": "Jupiter",
}


def get_sign_lord(sign: str) -> str:
    """
    Return the traditional rasi (sign) lord for a given zodiac sign name.

    Kept as its own small function (rather than inlined) so other
    modules -- e.g. core.significators, which will need "which planet
    rules the sign this house falls in" independently of cuspal
    sub-lords -- can reuse it without duplicating the table.

    Args:
        sign: Sign name exactly as it appears in the sub-lord table,
            e.g. "Aries", "Taurus" (see data/nakshatra_sublord_table.json).

    Raises:
        ValueError: if `sign` isn't one of the 12 recognized sign names
            (guards against a typo'd or mismatched sign string silently
            propagating into a chart result as a missing/garbage lord).
    """
    try:
        return SIGN_LORDS[sign]
    except KeyError:
        raise ValueError(
            f"Unrecognized sign {sign!r}; expected one of {list(SIGN_LORDS)}"
        )


def enrich_cusp(house_label: str, longitude: float) -> dict:
    """
    Compute the full KP cuspal profile for a single house cusp (or the
    Ascendant/MC, which are handled the same way as a cusp longitude).

    This is the core building block of the module -- analyze_cusps()
    below just calls this once per house/angle. Splitting it out lets
    callers enrich a single cusp on its own (e.g. for horary charts,
    which only care about one significant point) without needing the
    full 12-cusp dict.

    Args:
        house_label: A label identifying this point, e.g. "1".."12",
            "Ascendant", or "MC". Passed through unchanged into the
            result so callers can tell cusps apart after merging results
            from multiple enrich_cusp() calls.
        longitude: The cusp's zodiacal longitude in degrees (any float;
            normalization is handled by get_sublord_info()).

    Returns:
        {
            "house": "4",
            "longitude": 123.456,
            "sign": "Leo",
            "sign_lord": "Sun",
            "nakshatra": "Purva Phalguni",
            "nakshatra_index": 11,
            "star_lord": "Venus",
            "sub_lord": "Mercury",
            "degree_in_nakshatra": {"deg": 3, "min": 12, "sec": 8.4},
        }
    """
    sublord_info = get_sublord_info(longitude)

    return {
        "house": house_label,
        "longitude": sublord_info["longitude"],
        "sign": sublord_info["sign"],
        "sign_lord": get_sign_lord(sublord_info["sign"]),
        "nakshatra": sublord_info["nakshatra"],
        "nakshatra_index": sublord_info["nakshatra_index"],
        "star_lord": sublord_info["star_lord"],
        "sub_lord": sublord_info["sub_lord"],
        "degree_in_nakshatra": sublord_info["degree_in_nakshatra"],
    }


def compute_cusp_spans(cusps: dict[int, float]) -> dict[str, float]:
    """
    Compute the zodiacal arc length "owned" by each house cusp -- the
    gap between this cusp and the next one (house 12 wraps around to
    house 1 across 360/0).

    This matters in KP/Placidus practice because house spans are NOT
    equal (unlike equal-house systems): a house can be "small" or
    "large" depending on latitude and time of year, and unusually small
    spans (or a cusp very close to a sign boundary) are traditionally
    treated as noteworthy when judging a house's strength. This is
    exposed as its own function since it's a distinct calculation from
    sub-lord enrichment and some callers may want spans without the full
    per-cusp sub-lord lookup (or vice versa).

    Args:
        cusps: Dict of house number (1-12) to longitude in degrees, i.e.
            the `cusps` sub-dict from core.ephemeris.get_house_cusps().

    Returns:
        Dict of house number (as string, for the same JSON-serialization
        reason as get_sublord_for_cusps()) to span in degrees, e.g.
        {"1": 28.4, "2": 31.1, ..., "12": 26.7}.
    """
    spans: dict[str, float] = {}
    for house_num in range(1, 13):
        start = cusps[house_num] % 360.0
        next_house = house_num + 1 if house_num < 12 else 1
        end = cusps[next_house] % 360.0
        span = end - start
        if span <= 0:
            # Wraps past 360 (e.g. house 12's cusp is at 350deg and
            # house 1's is at 10deg) -- add a full circle back.
            span += 360.0
        spans[str(house_num)] = span

    return spans


def analyze_cusps(house_cusps: dict) -> dict:
    """
    Full KP cuspal analysis for a chart: enrich every house cusp plus
    the Ascendant and MC with sign/sign-lord/star-lord/sub-lord info,
    and attach each house's cusp span.

    Args:
        house_cusps: The dict shape returned by
            `core.ephemeris.get_house_cusps()`, i.e.:
            {
                "julian_day_ut": float,
                "ascendant": float,
                "mc": float,
                "cusps": {1: float, ..., 12: float},
            }
            Callers should pass that function's return value straight
            through -- this module never calls Swiss Ephemeris itself.

    Returns:
        {
            "ascendant": { ... enrich_cusp() shape ... },
            "mc": { ... enrich_cusp() shape ... },
            "cusps": {
                "1": { ... enrich_cusp() shape, plus "span_deg" ... },
                "2": { ... },
                ...
                "12": { ... },
            },
        }
    """
    cusps = house_cusps["cusps"]
    spans = compute_cusp_spans(cusps)

    cusps_result: dict[str, dict] = {}
    for house_num in range(1, 13):
        house_label = str(house_num)
        enriched = enrich_cusp(house_label, cusps[house_num])
        enriched["span_deg"] = spans[house_label]
        cusps_result[house_label] = enriched

    return {
        "ascendant": enrich_cusp("Ascendant", house_cusps["ascendant"]),
        "mc": enrich_cusp("MC", house_cusps["mc"]),
        "cusps": cusps_result,
    }


def get_cuspal_analysis(
    dt_local: Any,
    tz_offset_hours: float,
    latitude: float,
    longitude: float,
    house_system: str = None,
) -> dict:
    """
    High-level convenience wrapper: compute house cusps from birth
    details via core.ephemeris, then run the full KP cuspal analysis on
    them in one call.

    This mirrors the two-step pattern api/routes_chart.py already uses
    (call core.ephemeris, then process the result) but bundles it for
    callers -- e.g. a future core/significators.py or
    kp_analysis/cuspal_interlink.py -- that just want finished cuspal
    data without re-wiring the ephemeris call themselves each time.

    Args:
        dt_local: naive local birth datetime (see
            core.ephemeris.get_house_cusps for details).
        tz_offset_hours: offset from UTC in hours, e.g. 5.5 for IST.
        latitude: birthplace latitude in decimal degrees.
        longitude: birthplace longitude in decimal degrees.
        house_system: Swiss Ephemeris house system letter; defaults to
            config.HOUSE_SYSTEM ("P" = Placidus) inside get_house_cusps.

    Returns:
        The same shape as analyze_cusps().
    """
    # Imported here (rather than at module top level) to avoid importing
    # pyswisseph as a side effect of importing core.cusp_calculator --
    # some callers (e.g. analyze_cusps() used directly on already-computed
    # cusps) shouldn't need the Swiss Ephemeris dependency loaded at all.
    from core.ephemeris import get_house_cusps

    house_cusps = get_house_cusps(
        dt_local=dt_local,
        tz_offset_hours=tz_offset_hours,
        latitude=latitude,
        longitude=longitude,
        house_system=house_system,
    )
    return analyze_cusps(house_cusps)
