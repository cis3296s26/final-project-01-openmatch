from datetime import datetime
from pydantic import BaseModel

class TeamMember(BaseModel):
    id: int
    user_id: int
    name: str
    role: str
    joined_at: datetime

class TeamStats(BaseModel):
    team_mmr: int
    matches_played: int
    wins: int
    losses: int
    ties: int

class TeamProfile(BaseModel):
    id: int
    name: str
    sport: str
    city: str
    description: str | None
    rank: str
    stats: TeamStats
    members: list[TeamMember]
    created_at: datetime
    member_count: int

class Team(BaseModel):
    id: int
    name: str
    sport_id: int
    city: str

class TeamCreateForm(BaseModel):
    name: str
    sport_id: int
    city: str

class joinTeam(BaseModel):
    role: str
    sport_id: int

class editTeam(BaseModel):
    name: str