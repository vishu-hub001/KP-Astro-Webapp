"""
Generates data/horary_249_table.json

The KP Horary (Prashna) system uses numbers 1-249, NOT the 243 base
sub-lord divisions. This is a distinct, well-documented derivation:

  - The zodiac's 243 sub-lord territories (27 nakshatras x 9 subs each,
    sized by Vimshottari dasha proportions) are the base.
  - Of these 243, exactly 6 straddle a 30-degree sign boundary (since a
    13d20' nakshatra span doesn't line up evenly with 30-degree signs).
  - Because the SIGN LORD changes at that boundary even though the star
    lord and sub lord stay the same, each of those 6 straddling divisions
    is split into two separate horary-table cells: one for each sign.
  - 243 + 6 = 249 total horary numbers.

This script reads the already-built, already-verified
data/nakshatra_sublord_table.json (243 rows) and mechanically splits the
6 sign-boundary-crossing rows to produce the 249-row horary table.
Every degree boundary here is therefore directly derived from data we've
already validated -- nothing here is a new/independent astrological claim.

Verified against 6 independent published sources describing this exact
243 -> 249 mechanism (AjmerAstro, Jagannath Hora, Scribd/Gopalakrishnan,
KundliGPT, paramarsh.app) before building.
"""
import json

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


with open("data/nakshatra_sublord_table.json") as f:
    base_rows = json.load(f)

horary_rows = []

for row in base_rows:
    start = row["start_deg"]
    end = row["end_deg"] if row["end_deg"] < 360 else 360.0

    start_sign_idx = int(start // 30)
    next_boundary = (start_sign_idx + 1) * 30

    if start < next_boundary < end - 1e-9:
        # This sub-lord division straddles a sign boundary -> split into two cells.
        splits = [(start, next_boundary), (next_boundary, end)]
    else:
        splits = [(start, end)]

    for seg_start, seg_end in splits:
        horary_rows.append({
            "nakshatra": row["nakshatra"],
            "nakshatra_index": row["nakshatra_index"],
            "sign": sign_for_longitude(seg_start),
            "star_lord": row["star_lord"],
            "sub_lord": row["sub_lord"],
            "start_deg": round(seg_start, 6),
            "end_deg": round(seg_end, 6),
            "start_dms": deg_to_dms(seg_start),
            "end_dms": deg_to_dms(seg_end),
            "source_sublord_row_id": row["id"],
        })

# Sort by start_deg and assign horary numbers 1-249 in order, per convention:
# Number 1 = first sub of Ashwini (0 deg), Number 249 = last sub of Revati (360 deg).
horary_rows.sort(key=lambda r: r["start_deg"])
for i, row in enumerate(horary_rows, start=1):
    row["horary_number"] = i

# Sanity checks
assert len(horary_rows) == 249, f"Expected 249 rows, got {len(horary_rows)}"
assert horary_rows[0]["horary_number"] == 1
assert horary_rows[0]["start_deg"] == 0.0
assert horary_rows[-1]["horary_number"] == 249
assert abs(horary_rows[-1]["end_deg"] - 360.0) < 1e-6

# Verify no gaps/overlaps across the full sequence
for i in range(len(horary_rows) - 1):
    curr_end = horary_rows[i]["end_deg"]
    next_start = horary_rows[i + 1]["start_deg"]
    assert abs(curr_end - next_start) < 1e-6, (
        f"Gap/overlap between horary numbers {i+1} and {i+2}: "
        f"{curr_end} != {next_start}"
    )

with open("data/horary_249_table.json", "w") as f:
    json.dump(horary_rows, f, indent=2)

print(f"Wrote {len(horary_rows)} rows to data/horary_249_table.json")
print("Horary #1:", horary_rows[0])
print("Horary #249:", horary_rows[-1])

# Show the 6 split points for transparency/verification
split_points = [r for r in horary_rows if r["source_sublord_row_id"] in
                {21, 60, 102, 141, 183, 222}]
print(f"\n{len(split_points)} rows created from the 6 sign-boundary splits:")
for r in split_points:
    print(f"  #{r['horary_number']:3d}  {r['nakshatra']:16s} {r['sign']:12s} "
          f"sub={r['sub_lord']:8s} {r['start_deg']:.4f}->{r['end_deg']:.4f}")
