"""Pydantic schema for birth-data input, shared across chart/dasha/significators endpoints."""
from datetime import datetime
from pydantic import BaseModel, Field


class BirthData(BaseModel):
    date: str = Field(..., description="Birth date, YYYY-MM-DD", examples=["1990-05-21"])
    time: str = Field(..., description="Birth time (local, 24h), HH:MM:SS", examples=["14:35:00"])
    tz_offset_hours: float = Field(..., description="Timezone offset from UTC in hours, e.g. 5.5 for IST", examples=[5.5])
    latitude: float = Field(..., ge=-90, le=90, description="Birthplace latitude, decimal degrees")
    longitude: float = Field(..., ge=-180, le=180, description="Birthplace longitude, decimal degrees")

    def as_datetime(self) -> datetime:
        return datetime.strptime(f"{self.date} {self.time}", "%Y-%m-%d %H:%M:%S")
