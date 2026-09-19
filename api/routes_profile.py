"""
GET/POST /profile - save and load birth-data profiles.

NOTE ON SCOPE: no separate build spec exists for this endpoint beyond
its one-line docstring and the original TODO's hint ("wire to a
profile store, data/kundali_profiles.json equivalent"). This implements
a minimal flat-file JSON store with four operations:

  - POST   /profile/       create a new profile, returns it with a
                            generated id
  - GET    /profile/       list all saved profiles (most recent first)
  - GET    /profile/{id}   fetch one profile by id
  - DELETE /profile/{id}   remove a profile by id

This is a single JSON file (config.PROFILES_STORE) read/rewritten in
full on every request -- appropriate for a single-user/dev deployment,
but NOT safe for concurrent writes from multiple worker processes (no
file locking, no atomic rename). If this app grows into a multi-user
product, swap this for a real database; the route contracts above
shouldn't need to change.
"""
import json
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, HTTPException

import config
from models.birth_data import BirthData
from models.profile import Profile, ProfileCreate

router = APIRouter()

def _resolve_store_path() -> Path:
    """Use the Google Drive folder if it can be created/written; otherwise
    fall back to the local data/ file. On first use, existing local
    profiles are copied across so nothing is lost."""
    path = Path(config.PROFILES_STORE)
    legacy = Path(config.LEGACY_PROFILES_STORE)
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        if not path.exists() and legacy.exists() and path != legacy:
            shutil.copyfile(legacy, path)
        return path
    except OSError:
        return legacy


_STORE_PATH = _resolve_store_path()


def _load_profiles() -> list[dict]:
    """
    Read all saved profiles from disk.

    Returns an empty list (rather than raising) if the store file
    doesn't exist yet -- this is the expected state on first run, before
    any profile has ever been saved, not an error condition.
    """
    if not _STORE_PATH.exists():
        return []
    with open(_STORE_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _save_profiles(profiles: list[dict]) -> None:
    """Write the full profile list back to disk, creating the data
    directory first if it doesn't exist yet.
    """
    _STORE_PATH.parent.mkdir(parents=True, exist_ok=True)
    # Write to a temp file then swap it in, so Drive never syncs a half-written file.
    tmp = _STORE_PATH.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(profiles, f, indent=2)
    tmp.replace(_STORE_PATH)


@router.get("/")
def list_profiles():
    """List all saved birth-data profiles, most recently created first."""
    profiles = _load_profiles()
    profiles.sort(key=lambda p: p["created_at"], reverse=True)
    return {"status": "ok", "count": len(profiles), "profiles": profiles}


@router.post("/import")
def import_profiles(payload: dict):
    """
    Merge profiles from an exported JSON file. Accepts either a bare list
    of profiles or {"profiles": [...]}. Profiles whose id already exists,
    or that duplicate an existing name + birth data, are skipped.
    """
    incoming = payload.get("profiles") if isinstance(payload, dict) else None
    if not isinstance(incoming, list):
        raise HTTPException(status_code=400, detail="Expected a JSON object with a 'profiles' list.")

    existing = _load_profiles()
    seen_ids = {p["id"] for p in existing}

    def sig(p):
        b = p["birth_data"]
        return (p["name"].strip().lower(), b["date"], b["time"], round(b["latitude"], 4), round(b["longitude"], 4))

    seen_sigs = {sig(p) for p in existing}
    added, skipped, invalid = 0, 0, 0
    for raw in incoming:
        try:
            birth = BirthData(**raw["birth_data"])
            prof = Profile(
                id=str(raw.get("id") or uuid.uuid4()),
                name=str(raw["name"]).strip() or "Imported",
                birth_data=birth,
                created_at=str(raw.get("created_at") or datetime.now(timezone.utc).isoformat()),
            ).model_dump()
        except Exception:
            invalid += 1
            continue
        if prof["id"] in seen_ids or sig(prof) in seen_sigs:
            skipped += 1
            continue
        existing.append(prof)
        seen_ids.add(prof["id"])
        seen_sigs.add(sig(prof))
        added += 1

    if added:
        _save_profiles(existing)
    return {"status": "ok", "added": added, "skipped": skipped, "invalid": invalid}


@router.get("/{profile_id}")
def get_profile(profile_id: str):
    """Fetch a single saved profile by its id."""
    for p in _load_profiles():
        if p["id"] == profile_id:
            return {"status": "ok", "profile": p}
    raise HTTPException(status_code=404, detail=f"Profile {profile_id!r} not found")


@router.post("/")
def create_profile(data: ProfileCreate):
    """
    Save a new birth-data profile.

    The server generates the id (a UUID4) and created_at timestamp --
    callers only submit a display name and birth details.
    """
    profile = Profile(
        id=str(uuid.uuid4()),
        name=data.name,
        birth_data=data.birth_data,
        created_at=datetime.now(timezone.utc).isoformat(),
    )

    profiles = _load_profiles()
    profiles.append(profile.model_dump())
    _save_profiles(profiles)

    return {"status": "ok", "profile": profile.model_dump()}


@router.delete("/{profile_id}")
def delete_profile(profile_id: str):
    """Delete a saved profile by its id."""
    profiles = _load_profiles()
    remaining = [p for p in profiles if p["id"] != profile_id]

    if len(remaining) == len(profiles):
        raise HTTPException(status_code=404, detail=f"Profile {profile_id!r} not found")

    _save_profiles(remaining)
    return {"status": "ok", "deleted_id": profile_id}
