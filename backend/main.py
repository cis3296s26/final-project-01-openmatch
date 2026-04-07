import os
import json
import smtplib
import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from dotenv import load_dotenv
import redis
import resend
import requests
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError

from pydantic import BaseModel, EmailStr, field_validator, Field
from passlib.context import CryptContext
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from jose import jwt, JWTError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

load_dotenv()
load_dotenv(".env.local")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is not set")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

APP_ENV = os.getenv("APP_ENV", "dev")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://openmatch:openmatch@localhost:5432/openmatch",
)
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

MAIL_SENDER = os.getenv("MAIL_USERNAME")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD")

RESEND_API_KEY = os.getenv("RESEND_API_KEY")
EMAIL_FROM = os.getenv("EMAIL_FROM", "OpenMatch <onboarding@resend.dev>")

YELP_API_KEY = os.getenv("YELP_API_KEY")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
r = redis.Redis.from_url(REDIS_URL, decode_responses=True)

app = FastAPI(title="Open Match API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://openmatch-frontend.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def send_email_smtp(to: str, subject: str, body: str):
    if not MAIL_SENDER or not MAIL_PASSWORD:
        raise RuntimeError("MAIL_USERNAME or MAIL_PASSWORD is missing")

    msg = MIMEMultipart()
    msg["From"] = MAIL_SENDER
    msg["To"] = to
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "html"))

    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=15) as server:
        server.login(MAIL_SENDER, MAIL_PASSWORD)
        server.sendmail(MAIL_SENDER, to, msg.as_string())


def send_email_resend(to: str, subject: str, body: str):
    if not RESEND_API_KEY:
        raise RuntimeError("RESEND_API_KEY is missing")

    resend.api_key = RESEND_API_KEY

    resend.Emails.send(
        {
            "from": EMAIL_FROM,
            "to": [to],
            "subject": subject,
            "html": body,
        }
    )


def send_email(to: str, subject: str, body: str):
    if APP_ENV == "prod":
        send_email_resend(to, subject, body)
    else:
        send_email_smtp(to, subject, body)


security = HTTPBearer()


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


class ConnectionManager:
    def __init__(self) -> None:
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket) -> None:
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket) -> None:
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, payload: dict) -> None:
        msg = json.dumps(payload)
        dead = []
        for ws in self.active:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)


manager = ConnectionManager()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class UserCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(..., min_length=1, max_length=50)
    email: EmailStr
    username: str = Field(..., min_length=1, max_length=40)
    password: str = Field(..., min_length=8)

    @field_validator("email", "username")
    @classmethod
    def to_lowercase(cls, v: str) -> str:
        return v.lower()


class ProfileCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=50)
    bio: Optional[str] = Field(default=None, max_length=1000)
    location: Optional[str] = Field(default=None, max_length=100)


class UserLogin(BaseModel):
    login: str = Field(..., min_length=1, max_length=100)
    password: str = Field(..., min_length=8)


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
class ProfileSportCreate(BaseModel):
    sport_id: int

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

def init_db() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS users (
                    id SERIAL PRIMARY KEY,
                    first_name TEXT NOT NULL,
                    last_name TEXT NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
                    username TEXT NOT NULL UNIQUE,
                    password_hash TEXT NOT NULL,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS email_verification_tokens (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token_hash TEXT NOT NULL UNIQUE,
                    expires_at TIMESTAMPTZ NOT NULL,
                    used_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_token_hash
                    ON email_verification_tokens(token_hash);

                CREATE TABLE IF NOT EXISTS profiles (
                    id SERIAL PRIMARY KEY,
                    user_id INT UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                    display_name TEXT NOT NULL,
                    bio TEXT,
                    location TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS sports (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL UNIQUE,
                    is_active BOOLEAN NOT NULL DEFAULT TRUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS teams (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    sport_id INT NOT NULL REFERENCES sports(id),
                    city TEXT NOT NULL,
                    UNIQUE(name, sport_id)
                );

                CREATE TABLE IF NOT EXISTS team_members (
                    id SERIAL PRIMARY KEY,
                    team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
                    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    sport_id INT NOT NULL REFERENCES sports(id),
                    role TEXT NOT NULL DEFAULT 'member',
                    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(team_id, user_id),
                    UNIQUE(team_id, sport_id)
                );

                CREATE TABLE IF NOT EXISTS team_stats (
                    id SERIAL PRIMARY KEY,
                    team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
                    team_mmr INT NOT NULL DEFAULT 1000,
                    matches_played INT NOT NULL DEFAULT 0,
                    wins INT NOT NULL DEFAULT 0,
                    losses INT NOT NULL DEFAULT 0,
                    ties INT NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS match_posts (
                    id SERIAL PRIMARY KEY,
                    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    team_id INT REFERENCES teams(id) ON DELETE SET NULL,
                    sport_id INT NOT NULL REFERENCES sports(id),
                    title TEXT NOT NULL,
                    skill TEXT NOT NULL,
                    location TEXT,
                    note TEXT,
                    expires_at TIMESTAMPTZ NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS profile_sports (
                    id SERIAL PRIMARY KEY,
                    profile_id INT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                    sport_id INT NOT NULL REFERENCES sports(id) ON DELETE CASCADE,
                    mmr INT NOT NULL DEFAULT 1000,
                    matches_played INT NOT NULL DEFAULT 0,
                    wins INT NOT NULL DEFAULT 0,
                    losses INT NOT NULL DEFAULT 0,
                    placement_matches_remaining INT NOT NULL DEFAULT 5,
                    rank_tier TEXT NOT NULL DEFAULT 'Unranked',
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(profile_id, sport_id)
                );

                INSERT INTO sports (name) VALUES
                    ('Soccer'), ('Basketball'), ('Tennis'), ('Pickleball'),
                    ('Volleyball'), ('Flag Football'), ('Badminton'), ('Softball'),
                    ('Ultimate Frisbee'), ('Hockey'), ('Rugby'), ('Lacrosse')
                ON CONFLICT (name) DO NOTHING;
                """
            )
        )


@app.on_event("startup")
def on_startup() -> None:
    init_db()


@app.get("/health")
def health():
    with engine.begin() as conn:
        conn.execute(text("SELECT 1"))
    r.ping()
    return {"status": "ok", "time": now_iso()}


@app.post("/users", status_code=201)
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

async def create_and_send_verification_email(row: map, conn):
    # Token generation
    plaintext_token = secrets.token_urlsafe(32)
    hashed_token = hashlib.sha256(plaintext_token.encode()).hexdigest()
    verify_url = f"{FRONTEND_URL}/login/verify?token={plaintext_token}"

    # Insert the new email token into the database
    conn.execute(
        text(
            """
            INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
            VALUES (:user_id, :token_hash, :expires_at)
            """
        ),
        {
            "user_id": row["id"],
            "token_hash": hashed_token,
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=24),
        },
    )

    # Email Formatting
    email_html = f"""
    <p>Welcome to OpenMatch.</p>
    <p>Please verify your email by clicking the link below:</p>
    <p><a href="{verify_url}">Verify Email</a></p>
    <p>{verify_url}</p>
    """

    # Try to send the email
    try:
        send_email(
            to=row["email"],
            subject="Openmatch Email Verification",
            body=email_html
        )
    except Exception as e:
        print(f"EMAIL FAILED: {e}. Is this intentional?")

    # Print verification email contents to console if MAIL_USERNAME is not defined (For development)
    if not MAIL_SENDER:
        print(email_html)

@app.post("/resendVerification")
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

@app.get("/verify")
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
            raise HTTPException(status_code=400, detail="Invalid token")
        if row["used_at"] is not None:
            raise HTTPException(status_code=410, detail="Token already used")
        if row["expires_at"] < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Token expired")

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


@app.get("/users/{user_id}")
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


@app.post("/profiles", status_code=201)
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


@app.get("/profiles/{profile_id}")
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


@app.get("/users/{user_id}/profile")
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


@app.get("/sports")
def list_sports():
    with engine.begin() as conn:
        rows = conn.execute(
            text("SELECT id, name FROM sports WHERE is_active = TRUE ORDER BY name")
        ).mappings().all()
    return [dict(row) for row in rows]


@app.get("/users/{user_id}/profile-sports")
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

@app.get("/users/{user_id}/teams")
def get_user_profile_sports(user_id: int, current_user: dict = Depends(get_current_user)):
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

@app.post("/profile-sports", status_code=201)
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


@app.delete("/profile-sports/{profile_sport_id}")
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


@app.post("/login")
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


@app.post("/teams")
async def create_team(payload: TeamCreateForm):
    with engine.begin() as conn:
        try: 
            res = conn.execute(
                text(
                    """
                    INSERT INTO teams(name, sport_id, city)
                    VALUES (:name, :sport_id, :city)
                    RETURNING id
                    """
                ),
                {"name": payload.name, "sport_id": payload.sport_id, "city": payload.city},
            )
            team_id = res.scalar_one()

            r.hset(f"team:{team_id}:presence", mapping={"status": "Offline", "updated_at": now_iso()})

            await manager.broadcast({"type": "team_created", "team_id": team_id})
            return {"id": team_id}
        except IntegrityError:
            raise HTTPException(status_code=400, detail="A team with this name and sport already exist")


@app.get("/teams")
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

@app.post("/teams/{team_id}/join")
async def join_team(team_id: int, payload: joinTeam, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:
        user_id = int(current_user["sub"])

        try:
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
            raise HTTPException(status_code=400, detail="User is already a member of this team")
        
@app.post("/teams/{team_id}/leave")
async def join_team(team_id: int, current_user: dict = Depends(get_current_user)):
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


@app.post("/teams/{team_id}/presence")
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


@app.post("/posts", status_code=201)
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


@app.get("/posts")
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


@app.get("/users/{user_id}/posts")
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


@app.put("/posts/{post_id}")
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


@app.delete("/posts/{post_id}")
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


@app.get("/fields/search")
def search_fields(location: str, sort_by: str = "best_match"):
    if not YELP_API_KEY:
        raise HTTPException(status_code=500, detail="Yelp API key not configured")
    
    if not location:
        raise HTTPException(status_code=400, detail="Location is required")
    
    url = "https://api.yelp.com/v3/businesses/search"
    headers = {"Authorization": f"Bearer {YELP_API_KEY}"}
    params = {
        "location": location,
        "term": "sports fields and facilities",
        "sort_by": sort_by,
        "limit": 20,
    }
    
    try:
        response = requests.get(url, headers=headers, params=params)
        if response.status_code == 200:
            return response.json()
        else:
            raise HTTPException(
                status_code=response.status_code,
                detail="Failed to fetch data from Yelp API"
            )
    except requests.RequestException as e:
        raise HTTPException(status_code=500, detail=f"Error connecting to Yelp API: {str(e)}")


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
