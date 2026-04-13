from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from contextlib import asynccontextmanager

from db.init_db import init_db

from core.database import engine, r

from utils.time import now_iso

from routes.users import router as users_router
from routes.auth import router as auth_router
from routes.profiles import router as profiles_router
from routes.teams import router as teams_router
from routes.matches import router as matches_router
from routes.live_matches import router as live_matches_router
from routes.locations import router as locations_router
from routes.websockets import router as websockets_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("============================================")
    print("Starting up...")
    print("Connecting to Redis...")
    print("Initializing database...")
    print("============================================")

    init_db()
    
    print("Startup complete!")

    yield

    print("============================================")
    print("Shutting down...")
    print("============================================")

app = FastAPI(title="Open Match API", version="0.1.0", lifespan=lifespan)

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

@app.get("/health")
def health():
    with engine.begin() as conn:
        conn.execute(text("SELECT 1"))
    r.ping()
    return {"status": "ok", "time": now_iso()}

app.include_router(users_router)
app.include_router(auth_router)
app.include_router(profiles_router)
app.include_router(teams_router)
app.include_router(matches_router)
app.include_router(live_matches_router)
app.include_router(locations_router)
app.include_router(websockets_router)