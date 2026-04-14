from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from core.database import engine, r
from core.security import get_current_user
from core.websocket import manager

from schemas.teams import TeamMember, TeamStats, TeamProfile, Team, TeamCreateForm, joinTeam
from core.teams import validate_sport_profile_for_joining_team

from utils.time import now_iso

router = APIRouter(tags=["teams"])

@router.post("/teams")
async def create_team(payload: TeamCreateForm, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        try: 
            # define User Id
            user_id = int(current_user["sub"])
            
            # Check if this user has a sports profile for the team being joined, prevent if true
            if not validate_sport_profile_for_joining_team(conn, user_id, payload.sport_id):
                raise HTTPException(status_code=403, detail="You must create sport profile for this team's sport")

            row = conn.execute(
                text(
                    """
                    WITH inserted_team AS (
                        INSERT INTO teams (name, sport_id, city)
                        VALUES (:name, :sport_id, :city)
                        RETURNING id, name, sport_id, city, created_at
                    )
                    SELECT it.id, it.name, it.city, it.sport_id, s.name AS sport
                    FROM inserted_team it
                    JOIN sports s ON it.sport_id = s.id;
                    """
                ),
                {"name": payload.name, "sport_id": payload.sport_id, "city": payload.city},
            ).mappings().one()
            result = dict(row)

            # Define Team and UserID
            team_id = result["id"]

            # Initialize team profile
            conn.execute(
                text("""
                    INSERT INTO team_stats (team_id, team_mmr, matches_played, wins, losses, ties)
                    VALUES (:team_id, 1000, 0, 0, 0, 0)
                """),
                {"team_id": team_id}
            )

            # Create first user as captain
            conn.execute(
                text("""
                    INSERT INTO team_members (user_id, team_id, sport_id, role)
                    SELECT :user_id, :team_id, sport_id, 'captain'
                    FROM teams WHERE id = :team_id
                """),
                {"user_id": user_id, "team_id": team_id}
            )

            await manager.broadcast({"type": "team_created", "team_id": team_id})
            
            return {
                "name": result["name"],
                "id": result["id"],
                "sport_id": result["sport_id"],
                "city": result["city"],
                "sport": result["sport"]
            }
        except IntegrityError:
            raise HTTPException(status_code=400, detail="A team with this name and sport already exist")

@router.get("/teams")
def list_teams():
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT t.id, t.name, t.sport_id, t.city, s.name AS sport
                FROM teams t
                JOIN sports s ON t.sport_id = s.id
                ORDER BY id DESC
                """
            )
        ).mappings().all()

    teams = []
    for row in rows:
        pres = r.hgetall(f"team:{row['id']}:presence") or {"status": "Offline", "updated_at": None}
        teams.append({**row, "presence": pres})
    return teams

@router.post("/teams/{team_id}/join")
async def join_team(team_id: int, payload: joinTeam, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        try:
            # Define User Id
            user_id = int(current_user["sub"])
            
            # Check if this user has a sports profile for the team being joined, prevent if true
            if not validate_sport_profile_for_joining_team(conn, user_id, payload.sport_id):
                raise HTTPException(status_code=403, detail="You must create sport profile for this team's sport")

            row = conn.execute(
                text(
                    """
                    INSERT INTO team_members (user_id, team_id, sport_id, role)
                    SELECT :user_id, t.id, t.sport_id, :role
                    FROM teams t
                    WHERE t.id = :team_id
                    RETURNING id, user_id, team_id, sport_id, role, joined_at
                    """
                ),
                {
                    "user_id": user_id,
                    "team_id": team_id,
                    "role": payload.role
                },
            ).mappings().one()

            return row
        except IntegrityError:
            raise HTTPException(status_code=400, detail="User is already a member of this team or another team of the same sport")
        
@router.post("/teams/{team_id}/leave")
async def leave_team(team_id: int, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        user_id = int(current_user["sub"])

        try:
            row = conn.execute(
                text(
                    """
                    DELETE FROM team_members
                    WHERE (user_id = :user_id) AND (team_id = :team_id)
                    """
                ),
                {
                    "user_id": user_id,
                    "team_id": team_id,
                },
            )

            if row.rowcount == 0:
                raise HTTPException(status_code=400, detail="User is not a member of this team")

            return {"ok": True}
        except IntegrityError:
            raise HTTPException(status_code=400, detail="Bad Request")


@router.post("/teams/{team_id}/presence")
async def set_presence(team_id: int, payload: dict):
    status = payload["status"]
    if status not in {"Ready", "Away", "Offline"}:
        return {"error": "invalid status"}

    key = f"team:{team_id}:presence"
    r.hset(key, mapping={"status": status, "updated_at": now_iso()})
    if status == "Ready":
        r.expire(key, 30 * 60)

    await manager.broadcast({"type": "presence_updated", "team_id": team_id, "status": status})
    return {"ok": True}

@router.get("/users/{user_id}/teams")
def get_user_teams(user_id: int, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT t.id, t.name, t.sport_id, t.city, s.name AS sport
                FROM team_members tm
                JOIN teams t ON tm.team_id = t.id
                JOIN sports s ON t.sport_id = s.id
                WHERE tm.user_id = :user_id
                """
            ),
            {
                "user_id": user_id
            }
        ).mappings().all()

    return [dict(row) for row in rows]

@router.get("/teams/{team_id}/members")
def list_team_members(team_id: int) -> list[TeamMember]:
    with engine.begin() as conn:
        team = conn.execute(
            text("SELECT id FROM teams WHERE id = :team_id"),
            {"team_id": team_id}
        ).first()

        if not team:
            raise HTTPException(status_code=404, detail="Team not found")

        rows = conn.execute(
            text("""
                SELECT tm.id, tm.user_id, tm.role, tm.joined_at,
                       u.first_name || ' ' || u.last_name AS name
                FROM team_members tm
                JOIN users u ON u.id = tm.user_id
                WHERE team_id = :team_id
                ORDER BY tm.joined_at ASC
            """),
            {"team_id": team_id}
        ).mappings().all()

    return [TeamMember(**row) for row in rows]

@router.get("/teams/{team_id}/stats")
def get_team_stats(team_id: int) -> TeamStats:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT team_mmr, matches_played, wins, losses, ties
                FROM team_stats
                WHERE team_id = :team_id
                """
            ),
            {"team_id": team_id}
        ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Team stats not found")

    return TeamStats(**row)

@router.get("/teams/{team_id}/profile")
def get_team_profile(team_id: int) -> TeamProfile:
    with engine.begin() as conn:
        team_row = conn.execute(
            text("""
                SELECT t.id, t.name, s.name as sport, t.city, t.created_at, t.description,
                       ts.team_mmr, ts.matches_played, ts.wins, ts.losses, ts.ties
                FROM teams t
                JOIN sports s ON s.id = t.sport_id
                JOIN team_stats ts ON ts.team_id = t.id
                WHERE t.id = :team_id
            """),
            {"team_id": team_id}
        ).mappings().first()

        if not team_row:
            raise HTTPException(status_code=404, detail="Team not found")

        members_rows = conn.execute(
            text("""
                SELECT tm.id, tm.user_id, tm.role, tm.joined_at, u.first_name, u.last_name
                FROM team_members tm
                JOIN users u ON u.id = tm.user_id
                WHERE tm.team_id = :team_id
                ORDER BY tm.joined_at ASC
            """),
            {"team_id": team_id}
        ).mappings().all()

    TIERS = [
        {"name": "Bronze III", "min": 0,    "max": 299},
        {"name": "Bronze II",  "min": 300,  "max": 599},
        {"name": "Bronze I",   "min": 600,  "max": 899},
        {"name": "Silver III", "min": 900,  "max": 1099},
        {"name": "Silver II",  "min": 1100, "max": 1249},
        {"name": "Silver I",   "min": 1250, "max": 1399},
        {"name": "Gold III",   "min": 1400, "max": 1549},
        {"name": "Gold II",    "min": 1550, "max": 1699},
        {"name": "Gold I",     "min": 1700, "max": 1849},
        {"name": "Platinum III","min": 1850,"max": 1999},
        {"name": "Platinum II", "min": 2000,"max": 2149},
        {"name": "Platinum I",  "min": 2150,"max": 2299},
        {"name": "Diamond",    "min": 2300, "max": 2599},
        {"name": "Champion",   "min": 2600, "max": 9999},
    ]

    mmr = team_row["team_mmr"]
    rank = next((t["name"] for t in TIERS if t["min"] <= mmr <= t["max"]), "Bronze III")

    members = [
        TeamMember(
            id=row["id"],
            user_id=row["user_id"],
            name=f"{row['first_name']} {row['last_name']}",
            role=row["role"].lower(),
            joined_at=row["joined_at"]
        )
        for row in members_rows
    ]

    return TeamProfile(
        id=team_row["id"],
        name=team_row["name"],
        sport=team_row["sport"],
        city=team_row["city"],
        description=team_row["description"],
        rank=rank,
        created_at=team_row["created_at"],
        member_count=len(members),
        stats=TeamStats(
            team_mmr=team_row["team_mmr"],
            matches_played=team_row["matches_played"],
            wins=team_row["wins"],
            losses=team_row["losses"],
            ties=team_row["ties"]
        ),
        members=members
    )
