from typing import Optional
from sqlalchemy import text


def is_captain(conn, user_id: int, team_id: int) -> bool:
    row = conn.execute(
        text(
            """
            SELECT 1
            FROM team_members
            WHERE user_id = :user_id AND team_id = :team_id AND LOWER(role) = 'captain'
            """
        ),
        {"user_id": user_id, "team_id": team_id},
    ).first()
    return row is not None


def get_users_team_for_sport(conn, user_id: int, sport_id: int) -> Optional[int]:
    row = conn.execute(
        text(
            """
            SELECT team_id
            FROM team_members
            WHERE user_id = :user_id AND sport_id = :sport_id
            ORDER BY joined_at ASC
            LIMIT 1
            """
        ),
        {"user_id": user_id, "sport_id": sport_id},
    ).mappings().first()
    return int(row["team_id"]) if row else None