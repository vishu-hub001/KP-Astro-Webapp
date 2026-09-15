"""
dasha/dasha_results.py

Thin formatting layer: converts a dasha.vimshottari tree (Python
datetimes, nested dicts) into a flat, JSON-serializable list of period
rows -- the shape most API/report consumers actually want, rather than
walking the nested tree themselves.
"""

from __future__ import annotations

from datetime import datetime


def flatten_dasha_tree(dasha_tree: list[dict]) -> list[dict]:
    """
    Flatten a (possibly annotated) Vimshottari tree into one row per
    period at every level present, each tagged with its level and
    parent lords.

    Args:
        dasha_tree: List of Mahadasha dicts from
            dasha.vimshottari.compute_vimshottari_dasha(), optionally
            annotated by dasha.dasha_significator_link.annotate_dasha_tree().

    Returns:
        [
            {
                "level": "mahadasha", "lord": "Venus", "lineage": [],
                "start_date": "1990-05-21T14:35:00", "end_date": "...",
                "duration_years": 10.0,
                "significations": [...],       # if present
                "common_significations": [...], # if present (AD/PD only)
            },
            {"level": "antardasha", "lord": "Sun", "lineage": ["Venus"], ...},
            {"level": "pratyantardasha", "lord": "Rahu", "lineage": ["Venus", "Sun"], ...},
            ...
        ]
        Ordered chronologically (depth-first, matching each period's own
        span order).
    """
    rows: list[dict] = []

    def _row(period: dict, level: str, lineage: list[str]) -> dict:
        row = {
            "level": level,
            "lord": period["lord"],
            "lineage": lineage,
            "start_date": _iso(period["start_date"]),
            "end_date": _iso(period["end_date"]),
            "duration_years": round(period["duration_years"], 6),
        }
        if "significations" in period:
            row["significations"] = period["significations"]["all"]
        if "common_significations" in period:
            row["common_significations"] = period["common_significations"]
        return row

    for md in dasha_tree:
        rows.append(_row(md, "mahadasha", []))
        for ad in md.get("bhuktis", []):
            rows.append(_row(ad, "antardasha", [md["lord"]]))
            for pd in ad.get("antaras", []):
                rows.append(_row(pd, "pratyantardasha", [md["lord"], ad["lord"]]))

    return rows


def _iso(dt: datetime) -> str:
    """Internal helper: datetime -> ISO string, JSON-safe."""
    return dt.isoformat()
