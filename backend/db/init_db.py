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
                    invite_only BOOLEAN NOT NULL DEFAULT FALSE,
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

                CREATE TABLE IF NOT EXISTS team_invite (
                    id SERIAL PRIMARY KEY,
                    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    team_id INT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
                    token_hash TEXT NOT NULL UNIQUE,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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

                CREATE TABLE IF NOT EXISTS live_matches (
                    id SERIAL PRIMARY KEY,
                    match_post_id INT NOT NULL UNIQUE REFERENCES match_posts(id) ON DELETE CASCADE,
                    sport_id INT NOT NULL REFERENCES sports(id),
                    queue_type TEXT NOT NULL CHECK (queue_type IN ('solo', 'team')),
                    side_a_team_id INT REFERENCES teams(id) ON DELETE SET NULL,
                    side_b_team_id INT REFERENCES teams(id) ON DELETE SET NULL,
                    status TEXT NOT NULL DEFAULT 'awaiting_start'
                        CHECK (status IN ('awaiting_start', 'in_progress', 'awaiting_result', 'completed', 'disputed', 'cancelled')),
                    started_at TIMESTAMPTZ,
                    ended_at TIMESTAMPTZ,
                    winner_side TEXT CHECK (winner_side IN ('A', 'B')),
                    winner_team_id INT REFERENCES teams(id) ON DELETE SET NULL,
                    result_method TEXT,
                    rating_processed BOOLEAN NOT NULL DEFAULT FALSE,
                    score_side_a INT NOT NULL DEFAULT 0,
                    score_side_b INT NOT NULL DEFAULT 0,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CHECK (
                        (queue_type = 'team' AND side_a_team_id IS NOT NULL AND side_b_team_id IS NOT NULL)
                        OR
                        (queue_type = 'solo' AND side_a_team_id IS NULL AND side_b_team_id IS NULL)
                    )
                );

                CREATE TABLE IF NOT EXISTS match_players (
                    id SERIAL PRIMARY KEY,
                    match_id INT NOT NULL REFERENCES live_matches(id) ON DELETE CASCADE,
                    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    side TEXT NOT NULL CHECK (side IN ('A', 'B')),
                    team_id INT REFERENCES teams(id) ON DELETE SET NULL,
                    joined_from_post_participant_id INT,
                    mmr_before INT,
                    mmr_after INT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(match_id, user_id)
                );

                CREATE TABLE IF NOT EXISTS match_start_confirmations (
                    id SERIAL PRIMARY KEY,
                    match_id INT NOT NULL REFERENCES live_matches(id) ON DELETE CASCADE,
                    side TEXT NOT NULL CHECK (side IN ('A', 'B')),
                    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    confirmed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(match_id, side)
                );

                CREATE TABLE IF NOT EXISTS match_result_reports (
                    id SERIAL PRIMARY KEY,
                    match_id INT NOT NULL REFERENCES live_matches(id) ON DELETE CASCADE,
                    reporting_side TEXT NOT NULL CHECK (reporting_side IN ('A', 'B')),
                    reported_by_user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    winner_side TEXT NOT NULL CHECK (winner_side IN ('A', 'B')),
                    score_side_a INT,
                    score_side_b INT,
                    note TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(match_id, reporting_side)
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

                ALTER TABLE match_posts
                    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'open',
                    ADD COLUMN IF NOT EXISTS players_per_side INT NOT NULL DEFAULT 5,
                    ADD COLUMN IF NOT EXISTS locked_by_team_id INT REFERENCES teams(id) ON DELETE SET NULL,
                    ADD COLUMN IF NOT EXISTS locked_by_user_id INT REFERENCES users(id) ON DELETE SET NULL,
                    ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
                    ADD COLUMN IF NOT EXISTS ready_deadline_at TIMESTAMPTZ;

                ALTER TABLE live_matches
                    ADD COLUMN IF NOT EXISTS score_side_a INT NOT NULL DEFAULT 0,
                    ADD COLUMN IF NOT EXISTS score_side_b INT NOT NULL DEFAULT 0;

                CREATE TABLE IF NOT EXISTS match_post_participants (
                    id SERIAL PRIMARY KEY,
                    match_post_id INT NOT NULL REFERENCES match_posts(id) ON DELETE CASCADE,
                    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    side TEXT NOT NULL CHECK (side IN ('A', 'B')),
                    team_id INT REFERENCES teams(id) ON DELETE SET NULL,
                    selected_for_match BOOLEAN NOT NULL DEFAULT FALSE,
                    ready BOOLEAN NOT NULL DEFAULT FALSE,
                    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    UNIQUE(match_post_id, user_id)
                );
                
                CREATE TABLE IF NOT EXISTS match_history (
                    id SERIAL PRIMARY KEY,
                    original_match_id INT,
                    original_post_id INT,
                    sport_id INT NOT NULL REFERENCES sports(id),
                    queue_type TEXT NOT NULL CHECK (queue_type IN ('solo', 'team')),

                    title TEXT,
                    skill TEXT,
                    is_competitive BOOLEAN NOT NULL DEFAULT FALSE,
                    location TEXT,
                    note TEXT,

                    side_a_team_id INT REFERENCES teams(id) ON DELETE SET NULL,
                    side_b_team_id INT REFERENCES teams(id) ON DELETE SET NULL,
                    winner_side TEXT CHECK (winner_side IN ('A', 'B')),
                    winner_team_id INT REFERENCES teams(id) ON DELETE SET NULL,

                    score_side_a INT NOT NULL DEFAULT 0,
                    score_side_b INT NOT NULL DEFAULT 0,

                    result_method TEXT,
                    started_at TIMESTAMPTZ,
                    ended_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE TABLE IF NOT EXISTS match_history_players (
                    id SERIAL PRIMARY KEY,
                    match_history_id INT NOT NULL REFERENCES match_history(id) ON DELETE CASCADE,
                    user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    side TEXT NOT NULL CHECK (side IN ('A', 'B')),
                    team_id INT REFERENCES teams(id) ON DELETE SET NULL,
                    mmr_before INT,
                    mmr_after INT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                );

                CREATE INDEX IF NOT EXISTS idx_match_history_players_user_id
                    ON match_history_players(user_id);

                CREATE INDEX IF NOT EXISTS idx_match_history_created_at
                    ON match_history(created_at DESC);
                

                CREATE INDEX IF NOT EXISTS idx_match_post_participants_post_id
                    ON match_post_participants(match_post_id);

                ALTER TABLE match_posts
                    ADD COLUMN IF NOT EXISTS is_competitive BOOLEAN NOT NULL DEFAULT FALSE;    
                """
            )
        )