# KP_Astro_Webapp — Build Status

## ✅ Completed & tested

### Core (`core/`)
| File | Purpose |
|---|---|
| `ephemeris.py` | Swiss Ephemeris wrapper — planet positions, house cusps (*pre-existing*) |
| `sub_lord_engine.py` | 243-row sub-lord lookup (sign/nakshatra/star lord/sub lord for any longitude) |
| `cusp_calculator.py` | Cuspal enrichment — sign lord, sub lord, span, for all 12 houses + Asc/MC |
| `significators.py` | 4-level KP house significators |
| `ruling_planets.py` | Day lord + Ascendant/Moon sign/star/sub lords |
| `conjunctions.py` | Same-sign and orb-based planetary conjunctions |
| `panchang.py` | Tithi, vara, nakshatra, yoga, karana |

### Dasha (`dasha/`)
| File | Purpose |
|---|---|
| `vimshottari.py` | Mahadasha/Antardasha/Pratyantardasha tree + current-period lookup |
| `dasha_significator_link.py` | Links dasha lords to house significations (incl. common/agreement across levels) |
| `dasha_results.py` | Flattens a dasha tree into a flat JSON-safe row list |

### KP Analysis (`kp_analysis/`)
| File | Purpose |
|---|---|
| `cuspal_interlink.py` | Cuspal sub-lord interlink judgment (which houses support/deny a matter) |
| `event_timing.py` | Scans the dasha tree for periods that favor a judged matter |

### Horary (`horary/`)
| File | Purpose |
|---|---|
| `horary_chart.py` | 249-number table lookup + real-time chart casting |
| `horary_rules.py` | Ruling-planets validation + horary sub-lord judgment |

### API (`api/`) — all 5 routes live
`POST /chart`, `GET /significators`, `GET /dasha`, `GET /profile` (CRUD), `GET /horary`

### Data
`nakshatra_sublord_table.json` (243 rows), `horary_249_table.json` (249 rows) — both validated gapless/complete.

### Models
`birth_data.py`, `profile.py` — in active use by routes.

---

## ⚠️ Still stubbed / needed

| File | Status | Notes |
|---|---|---|
| `kp_analysis/house_analysis.py` | **Empty, 0 lines** | Not yet built. Unclear scope — likely general house-strength/occupant summary; overlaps partly with `significators.py` + `cusp_calculator.py`. Needs a decision on what it adds beyond those. |
| `models/chart_response.py` | **Empty, 0 lines** | Never wired — routes currently return plain dicts instead of typed Pydantic response models. Not blocking, but no response-schema validation/OpenAPI docs benefit yet. |
| `models/significator_response.py` | **Empty, 0 lines** | Same as above — unused. |

## 🚫 Not built — needs your input first

None currently blocked. (Horary was the last blocker — resolved once you supplied the 249-number table.)

## 📝 Design notes worth knowing
- **No spec existed** for most files beyond `sub_lord_engine.py` — shapes were inferred from KP convention and documented as assumptions in each file's docstring (flagged explicitly where domain judgment was involved, e.g. karana numbering, RP-validation threshold).
- **Favorable/unfavorable house lists are never hardcoded** — `cuspal_interlink.judge_house()`, `event_timing.classify_period()`, and `horary_rules.judge_horary_number()` all take these as caller-supplied params, since they're matter-specific (marriage vs. career vs. litigation) and vary by KP author.
- **Every module was tested against a real chart** (1990-05-21, Delhi) with manual cross-checks, not just unit-level asserts.
