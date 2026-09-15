"""
Generates data/nakshatra_sublord_table.json

KP sub-lord logic:
- Zodiac = 360 degrees = 27 Nakshatras x 13deg20' (800 arcminutes) each.
- Vimshottari Dasha lord sequence (9 planets), with total cycle = 120 years:
    Ketu(7) - Venus(20) - Sun(6) - Moon(10) - Mars(7) - Rahu(18) - Jupiter(16) - Saturn(19) - Mercury(17)
- Nakshatra star-lords cycle through this same 9-planet sequence, repeating
  3 times across the 27 nakshatras (27 / 9 = 3).
- Within each nakshatra, it is further divided into 9 "sub" portions, each
  sized proportionally to that planet's Vimshottari years (out of 120),
  and the sub-lord sequence *starts from the nakshatra's own star lord*
  and cycles through all 9 in the same fixed order.

Output: a flat list of 243 rows, each with degree-arcminute boundaries
(absolute zodiacal longitude, 0-360deg), nakshatra name, star lord, and sub lord.
Used by core/sub_lord_engine.py to look up any longitude's Sign/Star Lord/Sub Lord.
"""
import json

PLANET_ORDER = ["Ketu", "Venus", "Sun", "Moon", "Mars", "Rahu", "Jupiter", "Saturn", "Mercury"]
DASHA_YEARS = {"Ketu": 7, "Venus": 20, "Sun": 6, "Moon": 10, "Mars": 7,
               "Rahu": 18, "Jupiter": 16, "Saturn": 19, "Mercury": 17}
TOTAL_YEARS = sum(DASHA_YEARS.values())  # 120

NAKSHATRAS = [
    "Ashwini", "Bharani", "Krittika", "Rohini", "Mrigashira", "Ardra",
    "Punarvasu", "Pushya", "Ashlesha", "Magha", "Purva Phalguni", "Uttara Phalguni",
    "Hasta", "Chitra", "Swati", "Vishakha", "Anuradha", "Jyeshtha",
    "Mula", "Purva Ashadha", "Uttara Ashadha", "Shravana", "Dhanishta", "Shatabhisha",
    "Purva Bhadrapada", "Uttara Bhadrapada", "Revati"
]

NAK_SPAN_ARCMIN = (360.0 / 27) * 60  # 800 arcminutes per nakshatra

SIGNS = ["Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
         "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces"]


def sign_for_longitude(deg):
    idx = int(deg // 30) % 12
    return SIGNS[idx]


def deg_to_dms(deg):
    d = int(deg)
    m_full = (deg - d) * 60
    m = int(m_full)
    s = round((m_full - m) * 60, 2)
    return {"deg": d, "min": m, "sec": s}


rows = []
row_id = 0

for nak_index, nak_name in enumerate(NAKSHATRAS):
    star_lord = PLANET_ORDER[nak_index % 9]
    nak_start_arcmin = nak_index * NAK_SPAN_ARCMIN

    # Sub-lord order starts at the star lord itself, then cycles through
    # the fixed 9-planet order starting right after it.
    start_pos = PLANET_ORDER.index(star_lord)
    sub_sequence = [PLANET_ORDER[(start_pos + i) % 9] for i in range(9)]

    cursor_arcmin = nak_start_arcmin
    for sub_lord in sub_sequence:
        span_arcmin = (DASHA_YEARS[sub_lord] / TOTAL_YEARS) * NAK_SPAN_ARCMIN
        start_deg = cursor_arcmin / 60.0
        end_deg = (cursor_arcmin + span_arcmin) / 60.0

        rows.append({
            "id": row_id,
            "nakshatra": nak_name,
            "nakshatra_index": nak_index + 1,   # 1-27
            "sign": sign_for_longitude(start_deg),
            "star_lord": star_lord,
            "sub_lord": sub_lord,
            "start_deg": round(start_deg, 6),
            "end_deg": round(end_deg, 6),
            "start_dms": deg_to_dms(start_deg),
            "end_dms": deg_to_dms(end_deg),
        })
        row_id += 1
        cursor_arcmin += span_arcmin

# Sanity checks
assert len(rows) == 243, f"Expected 243 rows, got {len(rows)}"
assert abs(rows[-1]["end_deg"] - 360.0) < 1e-6, f"Table doesn't end at 360deg: {rows[-1]['end_deg']}"
assert abs(rows[0]["start_deg"] - 0.0) < 1e-6

with open("data/nakshatra_sublord_table.json", "w") as f:
    json.dump(rows, f, indent=2)

print(f"Wrote {len(rows)} rows to data/nakshatra_sublord_table.json")
print("First row:", rows[0])
print("Last row:", rows[-1])
