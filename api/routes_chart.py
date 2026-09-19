"""POST /chart - generate a KP birth chart (planetary positions + house cusps)."""
from fastapi import APIRouter, HTTPException

from core.ephemeris import get_planet_positions, get_house_cusps
from core.sub_lord_engine import get_sublord_info
from models.birth_data import BirthData

router = APIRouter()


def _pada(degree_in_nakshatra: dict) -> int:
    """
    Nakshatra pada (quarter), 1-4, from a degree_in_nakshatra dict as
    returned by core.sub_lord_engine.get_sublord_info(). Each nakshatra
    spans 13deg20', so each pada spans 3deg20' (200 minutes of arc).
    """
    total_deg = degree_in_nakshatra["deg"] + degree_in_nakshatra["min"] / 60 + degree_in_nakshatra["sec"] / 3600
    return min(4, int(total_deg // (200 / 60)) + 1)


def _kp_info(longitude: float) -> dict:
    """KP sign/nakshatra/pada/star-lord/sub-lord lookup, trimmed to the
    fields the frontend needs (drops internal table_row_id)."""
    info = get_sublord_info(longitude)
    return {
        "sign": info["sign"],
        "nakshatra": info["nakshatra"],
        "nakshatra_index": info["nakshatra_index"],
        "pada": _pada(info["degree_in_nakshatra"]),
        "star_lord": info["star_lord"],
        "sub_lord": info["sub_lord"],
    }


@router.post("/")
def post_chart(data: BirthData):
    """
    Compute sidereal (Krishnamurti Ayanamsa) planetary positions, Ascendant,
    MC, and Placidus house cusps for the given birth details. Each planet
    and cusp also carries its KP sign/nakshatra/pada/star-lord/sub-lord.
    """
    try:
        dt = data.as_datetime()
        positions = get_planet_positions(
            dt_local=dt,
            tz_offset_hours=data.tz_offset_hours,
            latitude=data.latitude,
            longitude=data.longitude,
        )
        cusps = get_house_cusps(
            dt_local=dt,
            tz_offset_hours=data.tz_offset_hours,
            latitude=data.latitude,
            longitude=data.longitude,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Chart calculation failed: {exc}")

    positions_dict = positions.to_dict()
    for planet in positions_dict["planets"]:
        planet["kp"] = _kp_info(planet["longitude"])

    cusps_out = {}
    for h, deg in cusps["cusps"].items():
        deg = round(deg, 6)
        cusps_out[str(h)] = {"longitude": deg, "kp": _kp_info(deg)}

    return {
        "status": "ok",
        "input": data.model_dump(),
        "positions": positions_dict,
        "houses": {
            "ascendant": round(cusps["ascendant"], 6),
            "ascendant_kp": _kp_info(cusps["ascendant"]),
            "mc": round(cusps["mc"], 6),
            "cusps": cusps_out,
        },
    }


@router.get("/")
def get_chart_info():
    """Info endpoint explaining how to use POST /chart/."""
    return {
        "status": "ok",
        "message": "POST birth details (date, time, tz_offset_hours, latitude, longitude) to this endpoint to get a chart.",
    }
