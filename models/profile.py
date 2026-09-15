"""Pydantic schemas for saved birth-data profiles (GET/POST /profile)."""
from pydantic import BaseModel, Field

from models.birth_data import BirthData


class ProfileCreate(BaseModel):
    """Request body for POST /profile -- what the client submits to save
    a new profile. The server generates the id and created_at fields.
    """
    name: str = Field(
        ..., min_length=1,
        description="Display name for this profile, e.g. 'Self' or 'John Doe'",
        examples=["Self"],
    )
    birth_data: BirthData


class Profile(BaseModel):
    """A saved profile as stored/returned by the API -- ProfileCreate
    plus server-assigned id and creation timestamp.
    """
    id: str
    name: str
    birth_data: BirthData
    created_at: str
