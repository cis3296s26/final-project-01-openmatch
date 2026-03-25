import os
import json
from datetime import datetime, timezone, timedelta
from typing import List

import redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError
from dotenv import load_dotenv

from typing import List, Optional
from pydantic import BaseModel, EmailStr, field_validator, Field
from passlib.context import CryptContext
from jose import jwt, JWTError
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Load environment variables from .env file
load_dotenv()
load_dotenv(".env.local")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# JWT Configuration
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

# Security scheme for protected routes
security = HTTPBearer()
# ============== JWT UTILITIES ==============
def create_access_token(data: dict) -> str:
    """
    Create a JWT token with the given payload.
    The token includes 'sub' (subject/user_id) and 'exp' (expiration).
    """
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
def verify_token(token: str) -> dict | None:
    """
    Verify and decode a JWT token.
    Returns the payload if valid, None if invalid/expired.
    """
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None
def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Dependency that extracts and validates the JWT from the Authorization header.
    Use this to protect routes that require authentication.
    """
    token = credentials.credentials
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload


# Simple websocket manager
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

    @field_validator('email', 'username')
    @classmethod
    def to_lowercase(cls, v: str) -> str:
        return v.lower()


class ProfileCreate(BaseModel):
    display_name: str = Field(..., min_length=1, max_length=50)
    bio: Optional[str] = Field(default=None, max_length=1000)
    location: Optional[str] = Field(default=None, max_length=100)

class UserLogin(BaseModel):
    login: str = Field(..., min_length=1, max_length=100)  # can be email or username
    password: str = Field(..., min_length=8)

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
                    sport TEXT NOT NULL,
                    city TEXT NOT NULL
                );

                CREATE TABLE IF NOT EXISTS match_posts (
                  id SERIAL PRIMARY KEY,
                  team_id INT NOT NULL REFERENCES teams(id),
                  skill TEXT NOT NULL,
                  note TEXT,
                  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
def create_user(payload: UserCreate):
    try:
        with engine.begin() as conn:
            row = conn.execute(
                text(
                    """
                    INSERT INTO users (first_name, last_name, email, username, password_hash)
                    VALUES (:first_name, :last_name, :email, :username, :password_hash)
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

        return dict(row)
    except IntegrityError:
        raise HTTPException(status_code=400, detail="Email or username already exists")

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
    """Protected: Creates or updates a profile for the authenticated user."""
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
                WHERE id = :profile_id"""
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
                WHERE user_id = :user_id"""
            ),
            {"user_id": user_id}
        ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Profile not found")
    return dict(row)

@app.post("/login")
def login(payload: UserLogin):
    with engine.begin() as conn:
        row = conn.execute(
            text(
                """
                SELECT id, first_name, last_name, email, username, password_hash
                FROM users
                WHERE email = :login OR username = :login
                """
            ),
            {"login": payload.login.lower()}
        ).mappings().first()
    
    if not row:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not pwd_context.verify(payload.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create JWT with user_id as subject
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
            "username": row["username"]
        }
    }

@app.post("/teams")
async def create_team(payload: dict):
    with engine.begin() as conn:
        res = conn.execute(
            text("INSERT INTO teams(name, sport, city) VALUES (:n,:s,:c) RETURNING id"),
            {"n": payload["name"], "s": payload["sport"], "c": payload["city"]},
        )
        team_id = res.scalar_one()

    r.hset(f"team:{team_id}:presence", mapping={"status": "Offline", "updated_at": now_iso()})

    await manager.broadcast({"type": "team_created", "team_id": team_id})
    return {"id": team_id}


@app.get("/teams")
def list_teams():
    with engine.begin() as conn:
        rows = conn.execute(text("SELECT id, name, sport, city FROM teams ORDER BY id DESC")).mappings().all()

    teams = []
    for row in rows:
        pres = r.hgetall(f"team:{row['id']}:presence") or {"status": "Offline", "updated_at": None}
        teams.append({**row, "presence": pres})
    return teams


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


@app.post("/posts")
async def create_post(payload: dict):
    with engine.begin() as conn:
        res = conn.execute(
            text(
                "INSERT INTO match_posts(team_id, skill, note) VALUES (:t,:sk,:no) RETURNING id"
            ),
            {"t": payload["team_id"], "sk": payload["skill"], "no": payload.get("note")},
        )
        post_id = res.scalar_one()

    # TTL for post visibility in Redis (quick list); DB remains as record
    r.setex(f"post:{post_id}:active", 30 * 60, "1")

    await manager.broadcast({"type": "post_created", "post_id": post_id})
    return {"id": post_id}


@app.get("/posts")
def list_posts():
    with engine.begin() as conn:
        rows = conn.execute(
            text(
                """
                SELECT p.id, p.team_id, p.skill, p.note, p.created_at,
                       t.name as team_name, t.sport, t.city
                FROM match_posts p
                JOIN teams t ON t.id = p.team_id
                ORDER BY p.id DESC
                LIMIT 50
                """
            )
        ).mappings().all()

    posts = []
    for row in rows:
        if r.get(f"post:{row['id']}:active") == "1":
            posts.append(dict(row))
    return posts



@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
