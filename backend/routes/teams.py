from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from core.database import engine, r
from core.security import get_current_user
from core.websocket import manager

from core.config import FRONTEND_URL
from core.teams import verify_user_has_sport_profile, is_captain
from core.ranking import get_rank_from_mmr
from schemas.teams import TeamMember, TeamStats, TeamProfile, Team, TeamCreateForm, joinTeam, editTeam, inviteUser

from utils.time import now_iso

import secrets
import hashlib

router = APIRouter(tags=["teams"])


@router.post("/teams")
async def create_team(payload: TeamCreateForm, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        try:
            user_id = int(current_user["sub"])

            if not verify_user_has_sport_profile(conn, user_id, payload.sport_id):
                raise HTTPException(status_code=403, detail="You must create sport profile for this team's sport")

            invite_only = not payload.is_open

            row = conn.execute(
                text(
                    """
                    WITH inserted_team AS (
                        INSERT INTO teams (name, sport_id, city, invite_only)
                        VALUES (:name, :sport_id, :city, :invite_only)
                        RETURNING id, name, sport_id, city, invite_only, created_at
                    )
                    SELECT it.id, it.name, it.city, it.sport_id, it.invite_only, s.name AS sport
                    FROM inserted_team it
                    JOIN sports s ON it.sport_id = s.id;
                    """
                ),
                {
                    "name": payload.name,
                    "sport_id": payload.sport_id,
                    "city": payload.city,
                    "invite_only": invite_only,
                },
            ).mappings().one()

            result = dict(row)
            team_id = result["id"]

            conn.execute(
                text(
                    """
                    INSERT INTO team_stats (team_id, team_mmr, matches_played, wins, losses, ties)
                    VALUES (:team_id, 1000, 0, 0, 0, 0)
                    """
                ),
                {"team_id": team_id},
            )

            conn.execute(
                text(
                    """
                    INSERT INTO team_members (user_id, team_id, sport_id, role)
                    SELECT :user_id, :team_id, sport_id, 'captain'
                    FROM teams
                    WHERE id = :team_id
                    """
                ),
                {"user_id": user_id, "team_id": team_id},
            )

        except IntegrityError:
            raise HTTPException(status_code=400, detail="A team with this name and sport already exist")

    await manager.broadcast({
        "type": "team_created",
        "teamId": team_id,
    })
    await manager.broadcast({
        "type": "team_updated",
        "teamId": team_id,
    })

    return {
        "name": result["name"],
        "id": result["id"],
        "sport_id": result["sport_id"],
        "city": result["city"],
        "sport": result["sport"],
        "invite_only": result["invite_only"],
    }


@router.get("/teams")
def list_teams():
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT t.id, t.name, t.sport_id, t.city, t.invite_only, s.name AS sport
                FROM teams t
                JOIN sports s ON t.sport_id = s.id
                ORDER BY t.id DESC
                """
            )
        ).mappings().all()

    teams = []
    for row in rows:
        pres = r.hgetall(f"team:{row['id']}:presence") or {"status": "Offline", "updated_at": None}
        teams.append({**row, "presence": pres})
    return teams


@router.patch("/teams/{team_id}")
async def edit_team_name(team_id: int, payload: editTeam, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        user_id = int(current_user["sub"])

        try:
            user_is_captain = conn.execute(
                text(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM team_members
                        WHERE team_id = :team_id
                          AND user_id = :user_id
                          AND role = 'captain'
                    ) as user_is_captain
                    """
                ),
                {
                    "team_id": team_id,
                    "user_id": user_id,
                },
            ).mappings().first().user_is_captain

            if not user_is_captain:
                raise HTTPException(status_code=403, detail="User does not have permissions to edit this team!")

            updated = conn.execute(
                text(
                    """
                    UPDATE teams
                    SET name = :name,
                        invite_only = :invite_only
                    WHERE id = :team_id
                    RETURNING id
                    """
                ),
                {
                    "team_id": team_id,
                    "name": payload.name,
                    "invite_only": payload.invite_only,
                },
            ).mappings().first()

            if not updated:
                raise HTTPException(status_code=404, detail="Team not found")

        except IntegrityError:
            raise HTTPException(status_code=400, detail="Error encountered. Does another team with this name and sport exist?")

    await manager.broadcast({
        "type": "team_updated",
        "teamId": team_id,
    })

    return {"ok": True}


@router.delete("/teams/{team_id}")
async def delete_team(team_id: int, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        user_id = int(current_user["sub"])

        try:
            user_is_captain = conn.execute(
                text(
                    """
                    SELECT EXISTS (
                        SELECT 1
                        FROM team_members
                        WHERE team_id = :team_id
                          AND user_id = :user_id
                          AND role = 'captain'
                    ) as user_is_captain
                    """
                ),
                {
                    "team_id": team_id,
                    "user_id": user_id,
                },
            ).mappings().first().user_is_captain

            if not user_is_captain:
                raise HTTPException(status_code=403, detail="User does not have permissions to delete this team!")

            conn.execute(
                text(
                    """
                    DELETE FROM teams
                    WHERE id = :team_id
                    """
                ),
                {"team_id": team_id},
            )

        except IntegrityError:
            raise HTTPException(status_code=400, detail="Error encountered with deleting team.")

    await manager.broadcast({
        "type": "team_deleted",
        "teamId": team_id,
    })
    await manager.broadcast({
        "type": "team_updated",
        "teamId": team_id,
    })

    return {"ok": True}


@router.post("/teams/{team_id}/join")
async def join_team(team_id: int, payload: joinTeam, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        try:
            user_id = int(current_user["sub"])

            if not verify_user_has_sport_profile(conn, user_id, payload.sport_id):
                raise HTTPException(status_code=403, detail="You must create sport profile for this team's sport")

            team = conn.execute(
                text("SELECT invite_only FROM teams WHERE id = :team_id"),
                {"team_id": team_id},
            ).mappings().first()

            if not team:
                raise HTTPException(status_code=404, detail="Team not found")

            if team["invite_only"]:
                raise HTTPException(status_code=403, detail="This team is invite only")

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
                    "role": payload.role,
                },
            ).mappings().one()

        except IntegrityError as e:
            err = str(e.orig) if e.orig else ""
            if "team_members_user_id_sport_id_key" in err:
                raise HTTPException(status_code=409, detail="You are already on a team for this sport. Leave your current team first.")
            raise HTTPException(status_code=409, detail="You are already a member of this team")

    await manager.broadcast({
        "type": "team_member_joined",
        "teamId": team_id,
        "userId": user_id,
    })
    await manager.broadcast({
        "type": "team_updated",
        "teamId": team_id,
    })

    return row


@router.post("/teams/{team_id}/leave")
async def leave_team(team_id: int, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        user_id = int(current_user["sub"])

        captain_is_leaving = is_captain(conn, user_id, team_id)

        senior_player = conn.execute(
            text(
                """
                SELECT user_id
                FROM team_members
                WHERE team_id = :team_id
                  AND user_id <> :captain_id
                ORDER BY joined_at ASC
                LIMIT 1
                """
            ),
            {"captain_id": user_id, "team_id": team_id},
        ).mappings().first()

        if not senior_player:
            raise HTTPException(status_code=403, detail="Can't leave the team if you're the only member! Please delete instead.")

        try:
            row = conn.execute(
                text(
                    """
                    DELETE FROM team_members
                    WHERE user_id = :user_id
                      AND team_id = :team_id
                    """
                ),
                {
                    "user_id": user_id,
                    "team_id": team_id,
                },
            )

            if row.rowcount == 0:
                raise HTTPException(status_code=400, detail="User is not a member of this team")

            if captain_is_leaving:
                conn.execute(
                    text(
                        """
                        UPDATE team_members
                        SET role = 'captain'
                        WHERE user_id = :user_id
                          AND team_id = :team_id
                        """
                    ),
                    {
                        "user_id": senior_player.user_id,
                        "team_id": team_id,
                    },
                )

        except IntegrityError:
            raise HTTPException(status_code=400, detail="Unable to leave team. Please try again.")

    await manager.broadcast({
        "type": "team_updated",
        "teamId": team_id,
    })

    return {"ok": True}


@router.post("/teams/{team_id}/presence")
async def set_presence(team_id: int, payload: dict):
    status = payload["status"]
    if status not in {"Ready", "Away", "Offline"}:
        return {"error": "invalid status"}

    key = f"team:{team_id}:presence"
    r.hset(key, mapping={"status": status, "updated_at": now_iso()})
    if status == "Ready":
        r.expire(key, 30 * 60)

    await manager.broadcast({
        "type": "presence_updated",
        "teamId": team_id,
        "status": status,
    })
    await manager.broadcast({
        "type": "team_updated",
        "teamId": team_id,
    })

    return {"ok": True}


@router.get("/users/{user_id}/teams")
def get_user_teams(user_id: int, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT
                    t.id,
                    t.name,
                    t.city,
                    s.name AS sport,
                    ts.team_mmr,
                    COUNT(tm2.user_id) AS member_count
                FROM team_members tm
                JOIN teams t
                  ON tm.team_id = t.id
                JOIN sports s
                  ON t.sport_id = s.id
                JOIN team_stats ts
                  ON ts.team_id = t.id
                JOIN team_members tm2
                  ON tm2.team_id = t.id
                WHERE tm.user_id = :user_id
                GROUP BY t.id, t.name, t.city, s.name, ts.team_mmr
                ORDER BY t.name ASC
                """
            ),
            {"user_id": user_id},
        ).mappings().all()

    result = []
    for row in rows:
        mmr = int(row["team_mmr"])
        rank = get_rank_from_mmr(mmr)

        result.append({
            "id": row["id"],
            "name": row["name"],
            "city": row["city"],
            "sport": row["sport"],
            "member_count": int(row["member_count"]),
            "rank": rank,
        })

    return result


@router.get("/teams/{team_id}/members")
def list_team_members(team_id: int) -> list[TeamMember]:
    with engine.begin() as conn:
        team = conn.execute(
            text("SELECT id FROM teams WHERE id = :team_id"),
            {"team_id": team_id},
        ).first()

        if not team:
            raise HTTPException(status_code=404, detail="Team not found")

        rows = conn.execute(
            text(
                """
                SELECT tm.id, tm.user_id, tm.role, tm.joined_at,
                       u.first_name || ' ' || u.last_name AS name
                FROM team_members tm
                JOIN users u ON u.id = tm.user_id
                WHERE team_id = :team_id
                ORDER BY tm.joined_at ASC
                """
            ),
            {"team_id": team_id},
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
            {"team_id": team_id},
        ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Team stats not found")

    return TeamStats(**row)


@router.get("/teams/{team_id}/profile")
def get_team_profile(
    team_id: int,
    current_user: dict = Depends(get_current_user),
):
    auth_user_id = int(current_user["sub"])

    with engine.begin() as conn:
        team_row = conn.execute(
            text(
                """
                SELECT
                    t.id,
                    t.name,
                    s.name AS sport,
                    t.city,
                    t.created_at,
                    t.description,
                    t.invite_only,
                    ts.team_mmr,
                    ts.matches_played,
                    ts.wins,
                    ts.losses,
                    ts.ties
                FROM teams t
                JOIN sports s ON s.id = t.sport_id
                JOIN team_stats ts ON ts.team_id = t.id
                WHERE t.id = :team_id
                """
            ),
            {"team_id": team_id},
        ).mappings().first()

        if not team_row:
            raise HTTPException(status_code=404, detail="Team not found")

        members_rows = conn.execute(
            text(
                """
                SELECT
                    tm.id,
                    tm.user_id,
                    tm.role,
                    tm.joined_at,
                    u.first_name,
                    u.last_name
                FROM team_members tm
                JOIN users u ON u.id = tm.user_id
                WHERE tm.team_id = :team_id
                ORDER BY tm.joined_at ASC
                """
            ),
            {"team_id": team_id},
        ).mappings().all()

        viewer_row = conn.execute(
            text(
                """
                SELECT role
                FROM team_members
                WHERE team_id = :team_id AND user_id = :user_id
                """
            ),
            {"team_id": team_id, "user_id": auth_user_id},
        ).mappings().first()

    rank = get_rank_from_mmr(team_row["team_mmr"])

    members = [
        {
            "id": row["id"],
            "user_id": row["user_id"],
            "name": f"{row['first_name']} {row['last_name']}",
            "role": row["role"].lower(),
            "joined_at": row["joined_at"],
        }
        for row in members_rows
    ]

    is_member = viewer_row is not None
    viewer_role = viewer_row["role"].lower() if viewer_row else None

    return {
        "id": team_row["id"],
        "name": team_row["name"],
        "sport": team_row["sport"],
        "city": team_row["city"],
        "description": team_row["description"],
        "invite_only": team_row["invite_only"],
        "rank": rank,
        "created_at": team_row["created_at"],
        "member_count": len(members),
        "stats": {
            "team_mmr": team_row["team_mmr"],
            "matches_played": team_row["matches_played"],
            "wins": team_row["wins"],
            "losses": team_row["losses"],
            "ties": team_row["ties"],
        },
        "members": members,
        "viewer": {
            "is_member": is_member,
            "can_invite": is_member,
            "can_edit": viewer_role == "captain",
        },
    }


@router.post("/teams/{team_id}/invite")
async def invite_user(team_id: int, payload: inviteUser, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        user_id = int(current_user["sub"])

        requester = conn.execute(
            text("SELECT id FROM team_members WHERE team_id = :team_id AND user_id = :user_id"),
            {"team_id": team_id, "user_id": user_id},
        ).first()

        if not requester:
            raise HTTPException(status_code=403, detail="You must be a team member to send invites")

        invitee = conn.execute(
            text("SELECT id FROM users WHERE username = :username"),
            {"username": payload.username},
        ).mappings().first()

        if not invitee:
            raise HTTPException(status_code=404, detail="User not found")

        invitee_id = invitee["id"]

        already_member = conn.execute(
            text("SELECT id FROM team_members WHERE team_id = :team_id AND user_id = :user_id"),
            {"team_id": team_id, "user_id": invitee_id},
        ).first()

        if already_member:
            raise HTTPException(status_code=409, detail="User is already a member of this team")

        plaintext_token = secrets.token_urlsafe(32)
        hashed_token = hashlib.sha256(plaintext_token.encode()).hexdigest()
        invite_url = f"{FRONTEND_URL}/my-teams/invite?token={plaintext_token}"

        conn.execute(
            text(
                """
                INSERT INTO team_invite (user_id, team_id, token_hash)
                VALUES (:user_id, :team_id, :token_hash)
                """
            ),
            {"user_id": invitee_id, "team_id": team_id, "token_hash": hashed_token},
        )

        return {"invite_url": invite_url}


@router.post("/teams/invite")
async def accept_invite(token: str, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        user_id = int(current_user["sub"])

        hashed_token = hashlib.sha256(token.encode()).hexdigest()

        invite = conn.execute(
            text("SELECT id, user_id, team_id FROM team_invite WHERE token_hash = :token_hash"),
            {"token_hash": hashed_token},
        ).mappings().first()

        if not invite:
            raise HTTPException(status_code=404, detail="Invalid or expired invite link")

        if invite["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="This invite was not issued to you")

        team_id = invite["team_id"]

        team = conn.execute(
            text("SELECT sport_id FROM teams WHERE id = :team_id"),
            {"team_id": team_id},
        ).mappings().first()

        if not team:
            raise HTTPException(status_code=404, detail="Team no longer exists")

        if not verify_user_has_sport_profile(conn, user_id, team["sport_id"]):
            raise HTTPException(status_code=403, detail="You must create sport profile for this team's sport")

        try:
            conn.execute(
                text(
                    """
                    INSERT INTO team_members (user_id, team_id, sport_id, role)
                    VALUES (:user_id, :team_id, :sport_id, 'member')
                    """
                ),
                {"user_id": user_id, "team_id": team_id, "sport_id": team["sport_id"]},
            )
        except IntegrityError as e:
            err = str(e.orig) if e.orig else ""
            if "team_members_user_id_sport_id_key" in err:
                raise HTTPException(status_code=409, detail="You are already on a team for this sport")
            raise HTTPException(status_code=409, detail="You are already a member of this team")

        conn.execute(
            text("DELETE FROM team_invite WHERE id = :id"),
            {"id": invite["id"]},
        )

    await manager.broadcast({
        "type": "team_member_joined",
        "teamId": team_id,
        "userId": user_id,
    })
    await manager.broadcast({
        "type": "team_updated",
        "teamId": team_id,
    })

    return {"ok": True, "team_id": team_id}