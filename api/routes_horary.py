"""GET /horary - KP horary (Prashna) chart from a number 1-249."""
from fastapi import APIRouter, HTTPException, Query

from core.ruling_planets import get_ruling_planets_for_chart
from horary.horary_chart import cast_horary_chart
from horary.horary_rules import validate_horary_number_against_ruling_planets
from models.birth_data import BirthData

router = APIRouter()


@router.get("/")
def get_horary(
    number: int = Query(..., ge=1, le=249, description="Querent's chosen horary number, 1-249"),
    date: str = Query(..., description="Date of judgment, YYYY-MM-DD", examples=["2024-03-15"]),
    time: str = Query(..., description="Time of judgment (local, 24h), HH:MM:SS", examples=["11:20:00"]),
    tz_offset_hours: float = Query(..., description="Timezone offset from UTC in hours, e.g. 5.5 for IST"),
    latitude: float = Query(..., ge=-90, le=90, description="Latitude of the place of judgment, decimal degrees"),
    longitude: float = Query(..., ge=-180, le=180, description="Longitude of the place of judgment, decimal degrees"),
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
        ruling_planets = get_ruling_planets_for_chart(result["chart_positions"])
        rp_validation = validate_horary_number_against_ruling_planets(
            result["horary_point"], ruling_planets
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Horary calculation failed: {exc}")

    return {
        "status": "ok",
        "input": {**data.model_dump(), "horary_number": number},
        "horary_point": result["horary_point"],
        "significators": result["significators"],
        "ruling_planets": ruling_planets,
        "ruling_planets_validation": rp_validation,
    }
