from pydantic import BaseModel, Field
from typing import Optional

class MatchPostCreate(BaseModel):
    sport_id: int
    team_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=100)
    skill: str = Field(..., min_length=1, max_length=50)
    location: Optional[str] = Field(default=None, max_length=100)
    note: Optional[str] = Field(default=None, max_length=500)
    expires_in_minutes: int


class MatchPostUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=100)
    skill: Optional[str] = Field(default=None, max_length=50)
    location: Optional[str] = Field(default=None, max_length=100)
    note: Optional[str] = Field(default=None, max_length=500)
