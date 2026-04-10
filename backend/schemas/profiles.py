from pydantic import BaseModel, Field
from typing import Optional

class ProfileCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=50)
    bio: Optional[str] = Field(default=None, max_length=1000)
    location: Optional[str] = Field(default=None, max_length=100)

class ProfileSportCreate(BaseModel):
    sport_id: int