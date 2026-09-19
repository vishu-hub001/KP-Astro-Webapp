"""
Global configuration for KP Astro Webapp.
Central place for astrology-mode constants used across core/, dasha/, horary/, kp_analysis/.
"""
from pathlib import Path

# --- Ayanamsa ---
# KP astrology uses the Krishnamurti Ayanamsa (close to, but not identical to, Lahiri).
AYANAMSA_MODE = "KRISHNAMURTI"   # maps to swisseph.SIDM_KRISHNAMURTI in core/ephemeris.py

# --- House system ---
# KP always uses Placidus houses for cusps.
HOUSE_SYSTEM = "P"   # Placidus, per pyswisseph house system codes

# --- Dasha system ---
DASHA_SYSTEM = "VIMSHOTTARI"

# --- Horary ---
HORARY_MIN_NUMBER = 1
HORARY_MAX_NUMBER = 249

# --- Paths ---
# Anchored to this file's own location (not the process's current working
# directory) so the app works the same whether it's launched with
# `uvicorn main:app` from the project root, from an IDE's run button, or
# via `python main.py` from somewhere else entirely.
BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = str(BASE_DIR / "data")
NAKSHATRA_SUBLORD_TABLE = str(BASE_DIR / "data" / "nakshatra_sublord_table.json")
HORARY_TABLE = str(BASE_DIR / "data" / "horary_249_table.json")
# Profiles are stored in a JSON file inside the app's data/ folder.
# Optional: set the KP_PROFILES_STORE environment variable to use another path.
import os
LEGACY_PROFILES_STORE = str(BASE_DIR / "data" / "kundali_profiles.json")
PROFILES_STORE = os.environ.get("KP_PROFILES_STORE", LEGACY_PROFILES_STORE)
RESULTS_CACHE_DIR = str(BASE_DIR / "results" / "cache")
