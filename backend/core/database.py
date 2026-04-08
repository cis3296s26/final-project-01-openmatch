from dotenv import load_dotenv
import os
import redis
from sqlalchemy import create_engine

load_dotenv()
load_dotenv(".env.local")

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://openmatch:openmatch@localhost:5432/openmatch",
)

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
r = redis.Redis.from_url(REDIS_URL, decode_responses=True)