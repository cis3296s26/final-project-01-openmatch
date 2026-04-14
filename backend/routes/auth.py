from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from datetime import datetime, timezone
import hashlib

from core.database import engine
from core.security import pwd_context, create_access_token

from schemas.users import UserLogin

from services.email_verification import create_and_send_verification_email

router = APIRouter(tags=["auth"])

@router.post("/login")
def login(payload: UserLogin):
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT u.id, u.first_name, u.last_name, u.email, u.username, u.password_hash, u.email_verified,
                       p.display_name
                FROM users u
                LEFT JOIN profiles p ON p.user_id = u.id
                WHERE u.email = :login OR u.username = :login
                """
            ),
            {"login": payload.login.lower()}
        ).mappings().first()

    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not pwd_context.verify(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not row["email_verified"]:
        raise HTTPException(
            status_code=403,
            detail="Please verify your email before signing in",
        )

    access_token = create_access_token({
        "sub": str(row["id"]),
        "email": row["email"],
        "username": row["username"]
    })

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": row["id"],
            "first_name": row["first_name"],
            "last_name": row["last_name"],
            "email": row["email"],
            "username": row["username"],
            "display_name": row["display_name"]
        }
    }

@router.post("/resendVerification")
async def resetAndSendToken(payload: UserLogin):
    # Get the user's information
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT id, first_name, last_name, email, username
                FROM users
                WHERE email = :login OR username = :login
                """
            ),
            {"login": payload.login.lower()}
        ).mappings().first()

        # Catch if user does not exist
        if not row:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Clear all existing tokens for this user
        conn.execute(
            text(
                """
                DELETE FROM email_verification_tokens WHERE user_id= :user_id
                """
            ),
            {
                "user_id": row["id"] 
            }
        )

        # Create the token, add it to the database, and send it
        await create_and_send_verification_email(row, conn)

@router.get("/verify")
def verify_email(token: str):
    with engine.begin() as conn:
        hashed_token = hashlib.sha256(token.encode()).hexdigest()

        row = conn.execute(
            text(
                """
                SELECT id, user_id, expires_at, used_at
                FROM email_verification_tokens
                WHERE token_hash = :desired_token_hash
                """
            ),
            {
                "desired_token_hash": hashed_token
            }
        ).mappings().first()

        if not row:
            raise HTTPException(status_code=400, detail="This verification link is invalid. Please request a new one.")
        if row["used_at"] is not None:
            raise HTTPException(status_code=410, detail="This verification link has already been used. You can log in now.")
        if row["expires_at"] < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="This verification link has expired. Please request a new one.")

        conn.execute(
            text(
                """
                UPDATE users SET email_verified = TRUE WHERE id = :user_id
                """
            ),
            {
                "user_id": row["user_id"],
            }
        )

        conn.execute(
            text(
                """
                UPDATE email_verification_tokens SET used_at = :used_at WHERE id = :id
                """
            ),
            {
                "used_at": datetime.now(timezone.utc),
                "id": row["id"],
            }
        )

    return {"message": "Email verified successfully"}
