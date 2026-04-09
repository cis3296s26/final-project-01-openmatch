from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from core.database import engine
from core.security import pwd_context

from schemas.users import UserCreate
from services.email_verification import create_and_send_verification_email

router = APIRouter(tags=["users"])

@router.post("/users", status_code=201)
async def create_user(payload: UserCreate):
    try:
        with engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    INSERT INTO users (first_name, last_name, email, username, password_hash, email_verified)
                    VALUES (:first_name, :last_name, :email, :username, :password_hash, FALSE)
                    RETURNING id, first_name, last_name, email, username, created_at
                    """
                ),
                {
                    "first_name": payload.first_name,
                    "last_name": payload.last_name,
                    "email": payload.email,
                    "username": payload.username,
                    "password_hash": pwd_context.hash(payload.password),
                },
            ).mappings().one()

            await create_and_send_verification_email(row, conn)

        return dict(row)
    except IntegrityError:
        raise HTTPException(status_code=400, detail="Email or username already exists")

@router.get("/users/{user_id}")
def get_user(user_id: int):
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT id, first_name, last_name, email, username, created_at
                FROM users
                WHERE id = :user_id
                """
            ),
            {"user_id": user_id}
        ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(row)