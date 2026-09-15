"""GET /significators - 4-level house significators for a chart."""
from fastapi import APIRouter, HTTPException, Query

from core.ephemeris import get_house_cusps, get_planet_positions
from core.significators import get_significators_for_chart
from models.birth_data import BirthData

router = APIRouter()


@router.get("/")
def get_significators(
    date: str = Query(..., description="Birth date, YYYY-MM-DD", examples=["1990-05-21"]),
    time: str = Query(..., description="Birth time (local, 24h), HH:MM:SS", examples=["14:35:00"]),
    tz_offset_hours: float = Query(..., description="Timezone offset from UTC in hours, e.g. 5.5 for IST"),
    latitude: float = Query(..., ge=-90, le=90, description="Birthplace latitude, decimal degrees"),
    longitude: float = Query(..., ge=-180, le=180, description="Birthplace longitude, decimal degrees"),
):
    """
    Compute the 4-level KP house significators (level_1..level_4, plus a
    deduplicated "all") for every house 1-12, for the given birth details.
    """
    data = BirthData(
        date=date, time=time, tz_offset_hours=tz_offset_hours,
        latitude=latitude, longitude=longitude,
    )
    try:
        dt = data.as_datetime()
        positions = get_planet_positions(
            dt_local=dt,
            tz_offset_hours=data.tz_offset_hours,
            latitude=data.latitude,
            longitude=data.longitude,
        )
        house_cusps = get_house_cusps(
            dt_local=dt,
            tz_offset_hours=data.tz_offset_hours,
            latitude=data.latitude,
            longitude=data.longitude,
        )
        significators = get_significators_for_chart(positions, house_cusps)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Significator calculation failed: {exc}")

    return {
        "status": "ok",
        "input": data.model_dump(),
        "significators": significators,
    }
