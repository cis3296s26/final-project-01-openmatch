from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional, Literal

class MatchPostCreate(BaseModel):
    sport_id: int
    team_id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=100)
    skill: str = Field(..., min_length=1, max_length=50)
    location: Optional[str] = Field(default=None, max_length=100)
    note: Optional[str] = Field(default=None, max_length=500)
    expires_in_minutes: int
    players_per_side: int = Field(default=5, ge=1, le=50)


class MatchPostUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=100)
    skill: Optional[str] = Field(default=None, max_length=50)
    location: Optional[str] = Field(default=None, max_length=100)
    note: Optional[str] = Field(default=None, max_length=500)

class MatchPostLock(BaseModel):
    team_id: int


class MatchPostJoin(BaseModel):
    team_id: Optional[int] = None


class MatchPostRosterUpdate(BaseModel):
    user_ids: list[int]


class MatchPostParticipantOut(BaseModel):
    id: int
    match_post_id: int
    user_id: int
    username: Optional[str] = None
    side: Literal["A", "B"]
    team_id: Optional[int] = None
    selected_for_match: bool
    ready: bool
    joined_at: datetime


class MatchPostDetailOut(BaseModel):
    id: int
    user_id: int
    team_id: Optional[int] = None
    sport_id: int
    sport_name: str
    team_name: Optional[str] = None
    title: str
    skill: str
    location: Optional[str] = None
    note: Optional[str] = None
    status: str
    players_per_side: int
    locked_by_team_id: Optional[int] = None
    locked_by_user_id: Optional[int] = None
    locked_at: Optional[datetime] = None
    ready_deadline_at: Optional[datetime] = None
    expires_at: datetime
    created_at: datetime
    updated_at: datetime
    participants: list[MatchPostParticipantOut]

class MatchPlayerOut(BaseModel):
    id: int
    match_id: int
    user_id: int
    side: Literal["A", "B"]
    team_id: Optional[int] = None
    mmr_before: Optional[int] = None
    mmr_after: Optional[int] = None
    created_at: datetime

class MatchFinalizeOut(BaseModel):
    match_id: int
    winner_side: Literal["A", "B"]
    status: Literal["completed"]

class MatchStartConfirmationOut(BaseModel):
    id: int
    match_id: int
    side: Literal["A", "B"]
    user_id: int
    confirmed_at: datetime

class MatchResultReportCreate(BaseModel):
    winner_side: Literal["A", "B"]
    score_side_a: Optional[int] = None
    score_side_b: Optional[int] = None
    note: Optional[str] = None

class MatchResultReportOut(BaseModel):
    id: int
    match_id: int
    reporting_side: Literal["A", "B"]
    reported_by_user_id: int
    winner_side: Literal["A", "B"]
    score_side_a: Optional[int] = None
    score_side_b: Optional[int] = None
    note: Optional[str] = None
    created_at: datetime

class LiveMatchBase(BaseModel):
    id: int
    match_post_id: int
    sport_id: int
    queue_type: Literal["solo", "team"]
    side_a_team_id: Optional[int] = None
    side_b_team_id: Optional[int] = None
    status: str
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None
    winner_side: Optional[Literal["A", "B"]] = None
    winner_team_id: Optional[int] = None
    result_method: Optional[str] = None
    rating_processed: bool
    created_at: datetime
    updated_at: datetime

class LiveMatchOut(LiveMatchBase):
    pass

class LiveMatchDetailOut(LiveMatchBase):
    players: list[MatchPlayerOut]
    start_confirmations: list[MatchStartConfirmationOut]
    result_reports: list[MatchResultReportOut]