from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone, timedelta

from core.database import engine, r
from core.security import get_current_user
from core.websocket import manager

from schemas.matches import MatchPostCreate, MatchPostUpdate

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

        row = conn.execute(
            text(
                """
                INSERT INTO match_posts (user_id, team_id, sport_id, title, skill, location, note, expires_at)
                VALUES (:user_id, :team_id, :sport_id, :title, :skill, :location, :note, :expires_at)
                RETURNING id, user_id, team_id, sport_id, title, skill, location, note, expires_at, created_at, updated_at
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
