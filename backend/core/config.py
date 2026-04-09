import os
from dotenv import load_dotenv

load_dotenv()
load_dotenv(".env.local")


SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is not set")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

APP_ENV = os.getenv("APP_ENV", "dev")

YELP_API_KEY = os.getenv("YELP_API_KEY")

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