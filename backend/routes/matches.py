from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone, timedelta

from core.database import engine, r
from core.security import get_current_user
from core.websocket import manager
from core.teams import get_users_team_for_sport
from core.posts import require_post_not_expired, check_fill_and_start_ready, require_before_deadline

from schemas.matches import MatchPostCreate, MatchPostUpdate, MatchPostDetailOut, MatchPostParticipantOut, MatchPostJoin


router = APIRouter(tags=["matches"])

@router.post("/posts", status_code=201)
async def create_post(payload: MatchPostCreate, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=payload.expires_in_minutes)

    with engine.begin() as conn:
        sport = conn.execute(
            text("SELECT id, name FROM sports WHERE id = :sport_id AND is_active = TRUE"),
            {"sport_id": payload.sport_id}
        ).mappings().first()

        if not sport:
            raise HTTPException(status_code=400, detail="Sport not found")

        user = conn.execute(
            text("SELECT first_name, last_name FROM users WHERE id = :user_id"),
            {"user_id": user_id}
        ).mappings().first()

        team_name = None
        if payload.team_id:
            team = conn.execute(
                text("SELECT id, name FROM teams WHERE id = :team_id"),
                {"team_id": payload.team_id}
            ).mappings().first()
            if not team:
                raise HTTPException(status_code=400, detail="Team not found")
            team_name = team["name"]

            existing = conn.execute(
                text(
                    """
                    SELECT id FROM match_posts
                    WHERE team_id = :team_id AND sport_id = :sport_id
                      AND expires_at > NOW() AND status NOT IN ('confirmed')
                    LIMIT 1
                    """
                ),
                {"team_id": payload.team_id, "sport_id": payload.sport_id},
            ).mappings().first()
            if existing:
                raise HTTPException(
                    status_code=409,
                    detail=f"Your team already has an active post for this sport (post #{existing['id']}). "
                           "Wait for it to expire or delete it before creating a new one.",
                )

        row = conn.execute(
            text(
                """
                INSERT INTO match_posts (user_id, team_id, sport_id, title, skill, location, note, expires_at, players_per_side)
                VALUES (:user_id, :team_id, :sport_id, :title, :skill, :location, :note, :expires_at, :players_per_side)
                RETURNING id, user_id, team_id, sport_id, title, skill, location, note, expires_at, players_per_side, created_at, updated_at
                """
            ),
            {
                "user_id": user_id,
                "team_id": payload.team_id,
                "sport_id": payload.sport_id,
                "title": payload.title,
                "skill": payload.skill,
                "location": payload.location,
                "note": payload.note,
                "expires_at": expires_at,
                "players_per_side": payload.players_per_side,
            },
        ).mappings().one()

    r.setex(f"post:{row['id']}:active", payload.expires_in_minutes * 60, "1")

    await manager.broadcast({"type": "post_created", "post_id": row["id"]})

    result = dict(row)
    result["sport_name"] = sport["name"]
    result["user_name"] = f"{user['first_name']} {user['last_name']}"
    result["team_name"] = team_name
    return result


@router.get("/posts")
def list_posts():
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT p.id, p.user_id, p.team_id, p.sport_id, p.title, p.skill, p.location, p.note,
                       p.status, p.players_per_side,
                       p.expires_at, p.created_at, p.updated_at,
                       s.name as sport_name,
                       u.first_name, u.last_name,
                       t.name as team_name
                FROM match_posts p
                JOIN sports s ON s.id = p.sport_id
                JOIN users u ON u.id = p.user_id
                LEFT JOIN teams t ON t.id = p.team_id
                WHERE p.expires_at > NOW()
                ORDER BY p.created_at DESC
                LIMIT 50
                """
            )
        ).mappings().all()

    posts = []
    for row in rows:
        if r.get(f"post:{row['id']}:active") == "1":
            post = dict(row)
            post["user_name"] = f"{row['first_name']} {row['last_name']}"
            del post["first_name"]
            del post["last_name"]
            posts.append(post)
    return posts


@router.get("/users/{user_id}/posts")
def get_user_posts(user_id: int, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT p.id, p.user_id, p.team_id, p.sport_id, p.title, p.skill, p.location, p.note,
                       p.expires_at, p.created_at, p.updated_at,
                       s.name as sport_name,
                       t.name as team_name
                FROM match_posts p
                JOIN sports s ON s.id = p.sport_id
                LEFT JOIN teams t ON t.id = p.team_id
                WHERE p.user_id = :user_id AND p.expires_at > NOW()
                ORDER BY p.created_at DESC
                """
            ),
            {"user_id": user_id}
        ).mappings().all()

    posts = []
    for row in rows:
        if r.get(f"post:{row['id']}:active") == "1":
            posts.append(dict(row))
    return posts


@router.put("/posts/{post_id}")
def update_post(post_id: int, payload: MatchPostUpdate, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])

    with engine.begin() as conn:
        existing = conn.execute(
            text("SELECT id, user_id FROM match_posts WHERE id = :post_id"),
            {"post_id": post_id}
        ).mappings().first()

        if not existing:
            raise HTTPException(status_code=404, detail="Post not found")

        if existing["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to edit this post")

        updates = []
        params = {"post_id": post_id}

        if payload.title is not None:
            updates.append("title = :title")
            params["title"] = payload.title
        if payload.skill is not None:
            updates.append("skill = :skill")
            params["skill"] = payload.skill
        if payload.location is not None:
            updates.append("location = :location")
            params["location"] = payload.location
        if payload.note is not None:
            updates.append("note = :note")
            params["note"] = payload.note

        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        updates.append("updated_at = NOW()")

        row = conn.execute(
            text(
                f"""
                UPDATE match_posts
                SET {', '.join(updates)}
                WHERE id = :post_id
                RETURNING id, user_id, sport_id, title, skill, location, note, expires_at, created_at, updated_at
                """
            ),
            params
        ).mappings().one()

        sport = conn.execute(
            text("SELECT name FROM sports WHERE id = :sport_id"),
            {"sport_id": row["sport_id"]}
        ).mappings().first()

    result = dict(row)
    result["sport_name"] = sport["name"]
    return result


@router.delete("/posts/{post_id}")
async def delete_post(post_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])

    with engine.begin() as conn:
        existing = conn.execute(
            text("SELECT id, user_id FROM match_posts WHERE id = :post_id"),
            {"post_id": post_id}
        ).mappings().first()

        if not existing:
            raise HTTPException(status_code=404, detail="Post not found")

        if existing["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="Not authorized to delete this post")

        conn.execute(
            text("DELETE FROM match_posts WHERE id = :post_id"),
            {"post_id": post_id}
        )

    r.delete(f"post:{post_id}:active")

    await manager.broadcast({"type": "post_deleted", "post_id": post_id})

    return {"message": "Post deleted successfully"}


@router.get("/posts/{post_id}")
def get_post_detail(post_id: int) -> MatchPostDetailOut:
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT p.id, p.user_id, p.team_id, p.sport_id, p.title, p.skill, p.location, p.note,
                       p.status, p.players_per_side,
                       p.locked_by_team_id, p.locked_by_user_id, p.locked_at, p.ready_deadline_at,
                       p.expires_at, p.created_at, p.updated_at,
                       s.name as sport_name,
                       t.name as team_name
                FROM match_posts p
                JOIN sports s ON s.id = p.sport_id
                LEFT JOIN teams t ON t.id = p.team_id
                WHERE p.id = :post_id
                """
            ),
            {"post_id": post_id},
        ).mappings().first()

        if not row:
            raise HTTPException(status_code=404, detail="Post not found")

        participants = conn.execute(
            text(
                """
                SELECT mp.id, mp.match_post_id, mp.user_id, u.username,
                       mp.side, mp.team_id, mp.selected_for_match, mp.ready, mp.joined_at
                FROM match_post_participants mp
                JOIN users u ON u.id = mp.user_id
                WHERE mp.match_post_id = :post_id
                ORDER BY mp.joined_at ASC
                """
            ),
            {"post_id": post_id},
        ).mappings().all()

    base = dict(row)
    base["participants"] = [MatchPostParticipantOut(**dict(p)) for p in participants]
    return MatchPostDetailOut(**base)

@router.post("/posts/{post_id}/join")
async def join_post(post_id: int, payload: MatchPostJoin, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])

    with engine.begin() as conn:
        post = conn.execute(
            text(
                """
                SELECT id, team_id, sport_id, status, players_per_side,
                       locked_by_team_id, ready_deadline_at, expires_at
                FROM match_posts
                WHERE id = :post_id
                """
            ),
            {"post_id": post_id},
        ).mappings().first()

        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        require_post_not_expired(post)
        if post["status"] != "open":
            raise HTTPException(status_code=409, detail="Post is no longer accepting joins")

        if post["team_id"] is None:
            raise HTTPException(status_code=400, detail="Use accept-individual for individual posts")

        team_id = payload.team_id
        if team_id is None:
            team_id = get_users_team_for_sport(conn, user_id, int(post["sport_id"]))

        if team_id is None:
            raise HTTPException(status_code=400, detail="User is not on a team for this sport")

        team_id = int(team_id)
        poster_team_id = int(post["team_id"])

        if team_id == poster_team_id:
            side = "A"
        else:
            # Lock in opponent team on first opposing join
            current_opponent = post["locked_by_team_id"]
            if current_opponent is None:
                team_sport = conn.execute(
                    text("SELECT sport_id FROM teams WHERE id = :team_id"),
                    {"team_id": team_id},
                ).mappings().first()
                if not team_sport or int(team_sport["sport_id"]) != int(post["sport_id"]):
                    raise HTTPException(status_code=400, detail="Team sport does not match post sport")
                conn.execute(
                    text("UPDATE match_posts SET locked_by_team_id = :tid, updated_at = NOW() WHERE id = :pid"),
                    {"tid": team_id, "pid": post_id},
                )
            elif int(current_opponent) != team_id:
                raise HTTPException(status_code=403, detail="Another team has already claimed opponent side")
            side = "B"

        mem = conn.execute(
            text("SELECT 1 FROM team_members WHERE user_id = :u AND team_id = :t"),
            {"u": user_id, "t": team_id},
        ).first()
        if not mem:
            raise HTTPException(status_code=403, detail="User is not a member of that team")

        n = int(post["players_per_side"])
        current_count = conn.execute(
            text("SELECT COUNT(*) AS c FROM match_post_participants WHERE match_post_id = :pid AND side = :side"),
            {"pid": post_id, "side": side},
        ).mappings().one()
        if int(current_count["c"]) >= n:
            raise HTTPException(status_code=409, detail=f"{side.capitalize()} side is full ({n}/{n})")

        inserted = conn.execute(
            text(
                """
                INSERT INTO match_post_participants (match_post_id, user_id, side, team_id, selected_for_match)
                VALUES (:post_id, :user_id, :side, :team_id, TRUE)
                ON CONFLICT (match_post_id, user_id) DO UPDATE SET team_id = EXCLUDED.team_id
                RETURNING id, match_post_id, user_id, side, team_id, selected_for_match, ready, joined_at
                """
            ),
            {"post_id": post_id, "user_id": user_id, "side": side, "team_id": team_id},
        ).mappings().one()

        # Re-read post in case locked_by_team_id was just set
        post_refreshed = conn.execute(
            text("SELECT id, team_id, players_per_side, status, locked_by_team_id FROM match_posts WHERE id = :pid"),
            {"pid": post_id},
        ).mappings().one()
        ready_started = check_fill_and_start_ready(conn, post_id, post_refreshed)

    await manager.broadcast({"type": "participant_joined", "post_id": post_id, "user_id": user_id})
    if ready_started:
        await manager.broadcast({"type": "ready_window_started", "post_id": post_id})
    return dict(inserted)


@router.post("/posts/{post_id}/leave")
async def leave_post(post_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])

    with engine.begin() as conn:
        post = conn.execute(
            text(
                """
                SELECT id, team_id, status, players_per_side, expires_at
                FROM match_posts
                WHERE id = :post_id
                """
            ),
            {"post_id": post_id},
        ).mappings().first()

        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        if post["status"] == "confirmed":
            raise HTTPException(status_code=409, detail="Cannot leave a confirmed match")

        participant = conn.execute(
            text(
                """
                SELECT id, side, team_id
                FROM match_post_participants
                WHERE match_post_id = :post_id AND user_id = :user_id
                """
            ),
            {"post_id": post_id, "user_id": user_id},
        ).mappings().first()

        if not participant:
            raise HTTPException(status_code=400, detail="You are not a participant in this match")

        conn.execute(
            text("DELETE FROM match_post_participants WHERE match_post_id = :post_id AND user_id = :user_id"),
            {"post_id": post_id, "user_id": user_id},
        )

        if post["status"] == "ready_pending":
            conn.execute(
                text(
                    """
                    UPDATE match_posts
                    SET status = 'open', ready_deadline_at = NULL, updated_at = NOW()
                    WHERE id = :post_id
                    """
                ),
                {"post_id": post_id},
            )

    await manager.broadcast({"type": "participant_left", "post_id": post_id, "user_id": user_id})
    return {"message": "Successfully left the match"}


@router.post("/posts/{post_id}/ready")
async def ready_up(post_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])

    with engine.begin() as conn:
        post = conn.execute(
            text("SELECT id, team_id, status, players_per_side, ready_deadline_at, expires_at FROM match_posts WHERE id = :post_id"),
            {"post_id": post_id},
        ).mappings().first()
        if not post:
            raise HTTPException(status_code=404, detail="Post not found")
        require_post_not_expired(post)
        if post["status"] != "ready_pending":
            raise HTTPException(status_code=409, detail="Ready window has not started yet")
        require_before_deadline(post)

        participant = conn.execute(
            text(
                """
                SELECT id, match_post_id, user_id, team_id, selected_for_match, ready
                FROM match_post_participants
                WHERE match_post_id = :post_id AND user_id = :user_id
                """
            ),
            {"post_id": post_id, "user_id": user_id},
        ).mappings().first()

        if not participant:
            raise HTTPException(status_code=400, detail="Join the match first")

        if not participant["selected_for_match"]:
            raise HTTPException(status_code=403, detail="You are not selected for this match")

        updated = conn.execute(
            text(
                """
                UPDATE match_post_participants
                SET ready = TRUE
                WHERE match_post_id = :post_id AND user_id = :user_id
                RETURNING id, match_post_id, user_id, side, team_id, selected_for_match, ready, joined_at
                """
            ),
            {"post_id": post_id, "user_id": user_id},
        ).mappings().one()

        # Check if all selected participants are now ready
        sel = conn.execute(
            text(
                """
                SELECT COUNT(*) AS total,
                       SUM(CASE WHEN ready THEN 1 ELSE 0 END) AS ready_count
                FROM match_post_participants
                WHERE match_post_id = :post_id AND selected_for_match = TRUE
                """
            ),
            {"post_id": post_id},
        ).mappings().one()

        confirmed = False
        if int(sel["total"] or 0) > 0 and int(sel["ready_count"]) == int(sel["total"]):
            conn.execute(
                text("UPDATE match_posts SET status = 'confirmed', updated_at = NOW() WHERE id = :post_id"),
                {"post_id": post_id},
            )
            confirmed = True

    await manager.broadcast({"type": "ready_updated", "post_id": post_id, "user_id": user_id})
    if confirmed:
        await manager.broadcast({"type": "post_confirmed", "post_id": post_id})
    return dict(updated)


@router.post("/posts/{post_id}/accept-individual")
async def accept_individual(post_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])

    with engine.begin() as conn:
        post = conn.execute(
            text(
                """
                SELECT id, user_id, team_id, sport_id, status, players_per_side,
                       locked_by_user_id, locked_at, ready_deadline_at, expires_at
                FROM match_posts
                WHERE id = :post_id
                """
            ),
            {"post_id": post_id},
        ).mappings().first()

        if not post:
            raise HTTPException(status_code=404, detail="Post not found")

        require_post_not_expired(post)

        if post["team_id"] is not None:
            raise HTTPException(status_code=400, detail="This is a team post; use join instead")

        if post["status"] not in ("open",):
            raise HTTPException(status_code=409, detail="Post is no longer accepting participants")

        n = int(post["players_per_side"])

        # Alternate sides A/B by current counts; cap per side at N
        counts = conn.execute(
            text(
                """
                SELECT side, COUNT(*) AS c
                FROM match_post_participants
                WHERE match_post_id = :post_id
                GROUP BY side
                """
            ),
            {"post_id": post_id},
        ).mappings().all()
        by_side = {r["side"]: int(r["c"]) for r in counts}

        count_a = by_side.get("A", 0)
        count_b = by_side.get("B", 0)
        if count_a >= n and count_b >= n:
            raise HTTPException(status_code=409, detail="Both sides are full")
        side = "A" if count_a <= count_b else "B"
        if by_side.get(side, 0) >= n:
            side = "B" if side == "A" else "A"

        inserted = conn.execute(
            text(
                """
                INSERT INTO match_post_participants (match_post_id, user_id, side, team_id, selected_for_match, ready)
                VALUES (:post_id, :user_id, :side, NULL, TRUE, FALSE)
                ON CONFLICT (match_post_id, user_id) DO NOTHING
                RETURNING id, match_post_id, user_id, side, team_id, selected_for_match, ready, joined_at
                """
            ),
            {"post_id": post_id, "user_id": user_id, "side": side},
        ).mappings().first()

        if not inserted:
            raise HTTPException(status_code=409, detail="Already accepted this post")

        ready_started = check_fill_and_start_ready(conn, post_id, post)

    await manager.broadcast({"type": "individual_accepted", "post_id": post_id, "user_id": user_id})
    if ready_started:
        await manager.broadcast({"type": "ready_window_started", "post_id": post_id})
    return dict(inserted)