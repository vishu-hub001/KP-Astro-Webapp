"""
core/ephemeris.py

Thin wrapper around Swiss Ephemeris (pyswisseph) that produces sidereal
(KP/Krishnamurti Ayanamsa) planetary longitudes and the Ascendant for a
given birth date/time/location.

This is the foundation every other KP module depends on:
- core.cusp_calculator reads house cusps computed here
- core.sub_lord_engine looks up these longitudes in the sub-lord table
- everything downstream (significators, dasha, horary) needs accurate
  positions first.

No external network/file calls beyond the bundled Swiss Ephemeris tables
(pyswisseph ships its own built-in Moshier-based approximation if no
.se1 data files are installed, which is accurate to within a few
arc-seconds for planets and simply fine for KP-style predictive work).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Dict, List

import swisseph as swe
from contextvars import ContextVar

import config

# --- Planet name -> Swiss Ephemeris body constant -----------------------
# KP/Vedic astrology uses these 9 "grahas": 7 classical planets + the two
# lunar nodes (Rahu = North/Mean Node, Ketu = South Node, 180deg opposite).
PLANETS = {
    "Sun": swe.SUN,
    "Moon": swe.MOON,
    "Mars": swe.MARS,
    "Mercury": swe.MERCURY,
    "Jupiter": swe.JUPITER,
    "Venus": swe.VENUS,
    "Saturn": swe.SATURN,
    "Rahu": swe.TRUE_NODE,   # True node is generally preferred over Mean node in KP
}

# House-system letter for pyswisseph. KP always uses Placidus.
_HOUSE_SYSTEM_MAP = {"P": b"P"}


@dataclass
class PlanetPosition:
    name: str
    longitude: float          # sidereal ecliptic longitude, 0-360 deg
    latitude: float           # ecliptic latitude, deg
    speed: float              # deg/day (negative = retrograde)
    is_retrograde: bool = field(init=False)

    def __post_init__(self):
        self.is_retrograde = self.speed < 0

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "longitude": round(self.longitude, 6),
            "latitude": round(self.latitude, 6),
            "speed": round(self.speed, 6),
            "is_retrograde": self.is_retrograde,
        }


@dataclass
class ChartPositions:
    julian_day_ut: float
    ayanamsa: float
    ascendant: float
    mc: float
    planets: List[PlanetPosition]

    def to_dict(self) -> dict:
        return {
            "julian_day_ut": self.julian_day_ut,
            "ayanamsa": round(self.ayanamsa, 6),
            "ascendant": round(self.ascendant, 6),
            "mc": round(self.mc, 6),
            "planets": [p.to_dict() for p in self.planets],
        }


# Per-request ayanamsa override (set by middleware in main.py from the
# X-Ayanamsa header). Falls back to config.AYANAMSA_MODE when unset.
current_ayanamsa: ContextVar = ContextVar("current_ayanamsa", default=None)
SUPPORTED_AYANAMSAS = ("KRISHNAMURTI", "LAHIRI")


def _set_ayanamsa():
    """Configure Swiss Ephemeris to use the selected ayanamsa (KP by default)."""
    name = (current_ayanamsa.get() or config.AYANAMSA_MODE).upper()
    if name not in SUPPORTED_AYANAMSAS:
        name = config.AYANAMSA_MODE
    mode = getattr(swe, f"SIDM_{name}", None)
    if mode is None:
        raise ValueError(f"Unknown ayanamsa mode: {name}")
    swe.set_sid_mode(mode)


def _to_julian_day_ut(dt_local: datetime, tz_offset_hours: float) -> float:
    """
    Convert a local birth datetime + timezone offset (hours, e.g. 5.5 for IST)
    into a Julian Day in Universal Time, as required by Swiss Ephemeris.
    """
    dt_utc = dt_local - timedelta(hours=tz_offset_hours)
    hour_decimal = dt_utc.hour + dt_utc.minute / 60.0 + dt_utc.second / 3600.0
    return swe.julday(dt_utc.year, dt_utc.month, dt_utc.day, hour_decimal)


def get_planet_positions(
    dt_local: datetime,
    tz_offset_hours: float,
    latitude: float,
    longitude: float,
    house_system: str = None,
) -> ChartPositions:
    """
    Compute sidereal (KP Ayanamsa) planetary longitudes, Ascendant, and MC
    for a given birth moment and place.

    Args:
        dt_local: naive datetime of birth in LOCAL time (no tzinfo needed;
                   tz_offset_hours supplies the offset explicitly so callers
                   don't need to fight Python's tz database for historical
                   birth records).
        tz_offset_hours: offset from UTC in hours, e.g. 5.5 for IST, -5 for EST.
        latitude: birthplace latitude in decimal degrees (+ North, - South).
        longitude: birthplace longitude in decimal degrees (+ East, - West).
        house_system: Swiss Ephemeris house system letter; defaults to
                       config.HOUSE_SYSTEM ("P" = Placidus, the KP standard).

    Returns:
        ChartPositions with Ascendant, MC, ayanamsa value, and each of the
        9 KP grahas (Sun..Saturn, Rahu; Ketu is derived as Rahu + 180deg by
        the caller since Swiss Ephemeris only returns the true/mean node).
    """
    _set_ayanamsa()
    house_system = house_system or config.HOUSE_SYSTEM
    hsys_byte = _HOUSE_SYSTEM_MAP.get(house_system, house_system.encode())

    jd_ut = _to_julian_day_ut(dt_local, tz_offset_hours)
    ayanamsa = swe.get_ayanamsa_ut(jd_ut)

    # SIDEREAL flag makes swe.calc_ut return ayanamsa-adjusted longitudes directly.
    calc_flags = swe.FLG_SIDEREAL | swe.FLG_SPEED

    planets: List[PlanetPosition] = []
    for name, body_id in PLANETS.items():
        (lon, lat, dist, lon_speed, lat_speed, dist_speed), _ret_flags = swe.calc_ut(
            jd_ut, body_id, calc_flags
        )
        planets.append(PlanetPosition(name=name, longitude=lon % 360, latitude=lat, speed=lon_speed))

    # Ketu (South Node) is always exactly 180deg from Rahu (North Node).
    rahu = next(p for p in planets if p.name == "Rahu")
    planets.append(
        PlanetPosition(name="Ketu", longitude=(rahu.longitude + 180) % 360, latitude=-rahu.latitude, speed=rahu.speed)
    )

    # Houses + Ascendant + MC, also sidereal.
    cusps, ascmc = swe.houses_ex(jd_ut, latitude, longitude, hsys_byte, flags=swe.FLG_SIDEREAL)
    ascendant = ascmc[0] % 360
    mc = ascmc[1] % 360

    return ChartPositions(
        julian_day_ut=jd_ut,
        ayanamsa=ayanamsa,
        ascendant=ascendant,
        mc=mc,
        planets=planets,
    )


def get_house_cusps(
    dt_local: datetime,
    tz_offset_hours: float,
    latitude: float,
    longitude: float,
    house_system: str = None,
) -> Dict[str, object]:
    """
    Return all 12 sidereal Placidus house cusps for the same birth moment.
    Split out from get_planet_positions() so core.cusp_calculator can call
    it independently without recomputing planets, and vice versa.
    """
    _set_ayanamsa()
    house_system = house_system or config.HOUSE_SYSTEM
    hsys_byte = _HOUSE_SYSTEM_MAP.get(house_system, house_system.encode())

    jd_ut = _to_julian_day_ut(dt_local, tz_offset_hours)
    cusps, ascmc = swe.houses_ex(jd_ut, latitude, longitude, hsys_byte, flags=swe.FLG_SIDEREAL)

    # NOTE: this pyswisseph build returns `cusps` as a 0-indexed 12-tuple
    # (cusps[0] = house 1 ... cusps[11] = house 12), unlike some older
    # docs/builds that return a 1-indexed 13-tuple. We normalize to a
    # 1-indexed dict {1: ..., 12: ...} here so every caller downstream
    # always uses natural house numbers regardless of swisseph's internal
    # tuple layout.
    house_cusps = {house_num: cusps[house_num - 1] % 360 for house_num in range(1, 13)}

    return {
        "julian_day_ut": jd_ut,
        "ascendant": ascmc[0] % 360,
        "mc": ascmc[1] % 360,
        "cusps": house_cusps,
    }
