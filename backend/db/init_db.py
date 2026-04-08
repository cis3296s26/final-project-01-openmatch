from sqlalchemy import text
from core.database import engine


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
                    description TEXT,
                    city TEXT NOT NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
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
                    UNIQUE(user_id, sport_id)
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