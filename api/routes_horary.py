"""GET /horary - KP horary (Prashna) chart from a number 1-249."""
from fastapi import APIRouter, HTTPException, Query

from api.routes_chart import _kp_info
from core.ruling_planets import get_ruling_planets
from horary.horary_rules import judge_horary_number
from horary.horary_chart import cast_horary_chart
from horary.horary_rules import validate_horary_number_against_ruling_planets
from models.birth_data import BirthData

router = APIRouter()

# Traditional KP house groupings per query topic: houses that support the
# matter and houses that deny it. Guidelines only -- authors vary slightly.
TOPICS = {
    "general":   {"label": "General (no specific topic)", "favorable": [], "unfavorable": []},
    "marriage":  {"label": "Marriage / relationship", "favorable": [2, 7, 11], "unfavorable": [1, 6, 10]},
    "career":    {"label": "Job / career", "favorable": [2, 6, 10, 11], "unfavorable": [5, 8, 12]},
    "money":     {"label": "Money / gain", "favorable": [2, 6, 11], "unfavorable": [5, 8, 12]},
    "property":  {"label": "Property / vehicle purchase", "favorable": [4, 11, 12], "unfavorable": [3, 5, 10]},
    "education": {"label": "Education / exams", "favorable": [4, 9, 11], "unfavorable": [3, 8, 12]},
    "health":    {"label": "Health / recovery", "favorable": [1, 5, 11], "unfavorable": [6, 8, 12]},
    "children":  {"label": "Children", "favorable": [2, 5, 11], "unfavorable": [1, 4, 10]},
    "travel":    {"label": "Foreign travel", "favorable": [3, 9, 12], "unfavorable": [2, 4]},
    "litigation": {"label": "Litigation / dispute win", "favorable": [1, 6, 11], "unfavorable": [5, 8, 12]},
}


@router.get("/")
def get_horary(
    number: int = Query(..., ge=1, le=249, description="Querent's chosen horary number, 1-249"),
    date: str = Query(..., description="Date of judgment, YYYY-MM-DD", examples=["2024-03-15"]),
    time: str = Query(..., description="Time of judgment (local, 24h), HH:MM:SS", examples=["11:20:00"]),
    tz_offset_hours: float = Query(..., description="Timezone offset from UTC in hours, e.g. 5.5 for IST"),
    latitude: float = Query(..., ge=-90, le=90, description="Latitude of the place of judgment, decimal degrees"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude of the place of judgment, decimal degrees"),
    topic: str = Query("general", description="Query topic key (marriage, career, money, ...)"),
):
    """
    Cast a KP horary (Prashna) chart: the real chart for the moment of
    judgment, plus the querent's chosen number's sign/star/sub lord
    lookup, its house significators, and the standard Ruling-Planets
    validation check for whether the number appears "genuine".
    """
    data = BirthData(
        date=date, time=time, tz_offset_hours=tz_offset_hours,
        latitude=latitude, longitude=longitude,
    )
    try:
        dt = data.as_datetime()
        result = cast_horary_chart(
            horary_number=number,
            dt_local=dt,
            tz_offset_hours=data.tz_offset_hours,
            latitude=data.latitude,
            longitude=data.longitude,
        )
        cp = result["chart_positions"]
        moon_lon = next(p.longitude for p in cp.planets if p.name == "Moon")
        # Day lord from the LOCAL civil date (not the UTC-derived one).
        ruling_planets = get_ruling_planets(dt, cp.ascendant, moon_lon)
        rp_validation = validate_horary_number_against_ruling_planets(
            result["horary_point"], ruling_planets
        )
        topic_def = TOPICS.get(topic, TOPICS["general"])
        judgment = None
        if topic_def["favorable"] or topic_def["unfavorable"]:
            judgment = judge_horary_number(
                result["horary_point"], result["significators"],
                topic_def["favorable"], topic_def["unfavorable"],
            )
            judgment.update({"topic": topic, "label": topic_def["label"],
                             "favorable_houses": topic_def["favorable"],
                             "unfavorable_houses": topic_def["unfavorable"]})
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Horary calculation failed: {exc}")

    # Full chart for the moment of judgment, same shape as POST /chart/.
    positions = cp.to_dict()
    for planet in positions["planets"]:
        planet["kp"] = _kp_info(planet["longitude"])
    cusps_out = {}
    for h, deg in result["house_cusps"]["cusps"].items():
        deg = round(deg, 6)
        cusps_out[str(h)] = {"longitude": deg, "kp": _kp_info(deg)}
    asc = result["house_cusps"]["ascendant"]
    chart = {
        "positions": positions,
        "houses": {
            "ascendant": round(asc, 6),
            "ascendant_kp": _kp_info(asc),
            "mc": round(result["house_cusps"]["mc"], 6),
            "cusps": cusps_out,
        },
    }

    return {
        "status": "ok",
        "chart": chart,
        "judgment": judgment,
        "topics": {k: v["label"] for k, v in TOPICS.items()},
        "input": {**data.model_dump(), "horary_number": number},
        "horary_point": result["horary_point"],
        "significators": result["significators"],
        "ruling_planets": ruling_planets,
        "ruling_planets_validation": rp_validation,
    }
