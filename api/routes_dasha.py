"""GET /dasha - Vimshottari Dasha/Bhukti/Antara periods."""
from fastapi import APIRouter, HTTPException, Query

from core.ephemeris import get_planet_positions
from dasha.vimshottari import compute_vimshottari_dasha
from models.birth_data import BirthData

router = APIRouter()


def _serialize_period(period: dict) -> dict:
    """
    Convert one dasha period dict (as produced by dasha.vimshottari) into
    a JSON-safe dict -- mainly turning its datetime start/end into ISO
    strings, and recursing into nested "bhuktis"/"antaras" if present.
    """
    serialized = {
        "lord": period["lord"],
        "start_date": period["start_date"].isoformat(),
        "end_date": period["end_date"].isoformat(),
        "duration_years": round(period["duration_years"], 6),
    }
    if "bhuktis" in period:
        serialized["bhuktis"] = [_serialize_period(b) for b in period["bhuktis"]]
    if "antaras" in period:
        serialized["antaras"] = [_serialize_period(a) for a in period["antaras"]]
    return serialized


@router.get("/")
def get_dasha(
    date: str = Query(..., description="Birth date, YYYY-MM-DD", examples=["1990-05-21"]),
    time: str = Query(..., description="Birth time (local, 24h), HH:MM:SS", examples=["14:35:00"]),
    tz_offset_hours: float = Query(..., description="Timezone offset from UTC in hours, e.g. 5.5 for IST"),
    latitude: float = Query(..., ge=-90, le=90, description="Birthplace latitude, decimal degrees"),
    longitude: float = Query(..., ge=-180, le=180, description="Birthplace longitude, decimal degrees"),
    levels: int = Query(
        3, ge=1, le=3,
        description="Depth to compute: 1=Mahadasha only, 2=+Antardasha (Bhukti), 3=+Pratyantardasha (Antara)",
    ),
    num_cycles: int = Query(
        1, ge=1, le=2,
        description="Number of full 120-year Vimshottari cycles to generate after birth (capped at 2 to bound response size)",
    ),
):
    """
    Compute the Vimshottari Mahadasha/Bhukti/Antara period tree for the
    given birth details, starting from the natal Moon's nakshatra.
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
        moon = next(p for p in positions.planets if p.name == "Moon")
        mahadashas = compute_vimshottari_dasha(
            moon_longitude=moon.longitude,
            birth_datetime=dt,
            num_cycles=num_cycles,
            levels=levels,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Dasha calculation failed: {exc}")

    return {
        "status": "ok",
        "input": data.model_dump(),
        "mahadashas": [_serialize_period(md) for md in mahadashas],
    }
