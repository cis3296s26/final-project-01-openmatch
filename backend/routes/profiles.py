from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from core.database import engine
from core.security import get_current_user
from schemas.profiles import ProfileCreate, ProfileSportCreate

router = APIRouter(tags=["profiles"])

@router.post("/profiles", status_code=201)
def create_profile(payload: ProfileCreate, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])

    try:
        with engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    INSERT INTO profiles (user_id, display_name, bio, location)
                    VALUES (:user_id, :display_name, :bio, :location)
                    ON CONFLICT (user_id) DO UPDATE SET
                        display_name = :display_name,
                        bio = :bio,
                        location = :location,
                        updated_at = NOW()
                    RETURNING id, user_id, display_name, bio, location, created_at, updated_at
                    """
                ),
                {
                    "user_id": user_id,
                    "display_name": payload.display_name,
                    "bio": payload.bio,
                    "location": payload.location,
                }
            ).mappings().one()
        return dict(row)
    except IntegrityError:
        raise HTTPException(status_code=400, detail="Failed to create profile")
    
@router.get("/profiles/{profile_id}")
def get_profile(profile_id: int):
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT id, user_id, display_name, bio, location, created_at, updated_at
                FROM profiles
                WHERE id = :profile_id
                """
            ),
            {"profile_id": profile_id}
        ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    return dict(row)

@router.get("/users/{user_id}/profile")
def get_user_profile(user_id: int):
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT id, user_id, display_name, bio, location, created_at, updated_at
                FROM profiles
                WHERE user_id = :user_id
                """
            ),
            {"user_id": user_id}
        ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    return dict(row)


# ===============SPORTS PROFILE ENDPOINTS================ #

@router.get("/sports")
def list_sports():
    with engine.begin() as conn:
        rows = conn.execute(
            text("SELECT id, name FROM sports WHERE is_active = TRUE ORDER BY name")
        ).mappings().all()
    return [dict(row) for row in rows]

@router.post("/profile-sports", status_code=201)
def create_profile_sport(payload: ProfileSportCreate, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])

    try:
        with engine.begin() as conn:
            profile = conn.execute(
                text("SELECT id FROM profiles WHERE user_id = :user_id"),
                {"user_id": user_id}
            ).mappings().first()

            if not profile:
                raise HTTPException(status_code=400, detail="Profile not found. Please create a profile first.")

            sport = conn.execute(
                text("SELECT id, name FROM sports WHERE id = :sport_id AND is_active = TRUE"),
                {"sport_id": payload.sport_id}
            ).mappings().first()

            if not sport:
                raise HTTPException(status_code=400, detail="Sport not found")

            row = conn.execute(
                text(
                    """
                    INSERT INTO profile_sports (profile_id, sport_id)
                    VALUES (:profile_id, :sport_id)
                    RETURNING id, profile_id, sport_id, mmr, matches_played, wins, losses,
                              placement_matches_remaining, rank_tier, created_at, updated_at
                    """
                ),
                {
                    "profile_id": profile["id"],
                    "sport_id": payload.sport_id,
                }
            ).mappings().one()

        result = dict(row)
        result["sport_name"] = sport["name"]
        return result
    except IntegrityError:
        raise HTTPException(status_code=400, detail="Sport already added to profile")


@router.get("/users/{user_id}/profile-sports")
def get_user_profile_sports(user_id: int, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        profile = conn.execute(
            text("SELECT id FROM profiles WHERE user_id = :user_id"),
            {"user_id": user_id}
        ).mappings().first()

        if not profile:
            return []

        rows = conn.execute(
            text(
                """
                SELECT ps.id, ps.profile_id, ps.sport_id, s.name as sport_name,
                       ps.mmr, ps.matches_played, ps.wins, ps.losses,
                       ps.placement_matches_remaining, ps.rank_tier,
                       ps.created_at, ps.updated_at
                FROM profile_sports ps
                JOIN sports s ON s.id = ps.sport_id
                WHERE ps.profile_id = :profile_id
                ORDER BY s.name
                """
            ),
            {"profile_id": profile["id"]}
        ).mappings().all()

    return [dict(row) for row in rows]

@router.delete("/profile-sports/{profile_sport_id}")
def delete_profile_sport(profile_sport_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])

    with engine.begin() as conn:
        profile = conn.execute(
            text("SELECT id FROM profiles WHERE user_id = :user_id"),
            {"user_id": user_id}
        ).mappings().first()

        if not profile:
            raise HTTPException(status_code=404, detail="Profile not found")

        result = conn.execute(
            text(
                """
                DELETE FROM profile_sports
                WHERE id = :profile_sport_id AND profile_id = :profile_id
                RETURNING id
                """
            ),
            {"profile_sport_id": profile_sport_id, "profile_id": profile["id"]}
        ).mappings().first()

        if not result:
            raise HTTPException(status_code=404, detail="Sport profile not found or not owned by user")

    return {"message": "Sport removed from profile"}
