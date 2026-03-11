import os
import json
from datetime import datetime, timezone
from typing import List

import redis
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, text

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
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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


def init_db() -> None:
    with engine.begin() as conn:
        conn.execute(
            text(
                """
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
