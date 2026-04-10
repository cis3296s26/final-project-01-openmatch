from fastapi import HTTPException
from sqlalchemy import text
from datetime import timedelta

from utils.time import utc_now 

def require_post_not_expired(post: dict) -> None:
    if post["expires_at"] <= utc_now():
        raise HTTPException(status_code=410, detail="Post expired")


def require_before_deadline(post: dict) -> None:
    deadline = post.get("ready_deadline_at")
    if deadline and deadline <= utc_now():
        raise HTTPException(status_code=410, detail="Ready window expired")
    
def check_fill_and_start_ready(conn, post_id: int, post: dict) -> bool:
    """Check if both sides have reached players_per_side. If so, transition to ready_pending."""
    n = int(post["players_per_side"])
    is_team_post = post["team_id"] is not None

    counts = conn.execute(
        text(
            """
            SELECT side, COUNT(*) AS c
            FROM match_post_participants
            WHERE match_post_id = :post_id
            GROUP BY side
            """
        ),
        {"post_id": post_id},
    ).mappings().all()
    by_side = {r["side"]: int(r["c"]) for r in counts}

    if is_team_post:
        filled = by_side.get("poster", 0) >= n and by_side.get("opponent", 0) >= n
    else:
        filled = by_side.get("A", 0) >= n and by_side.get("B", 0) >= n

    if filled:
        now = utc_now()
        deadline = now + timedelta(minutes=5)
        conn.execute(
            text(
                """
                UPDATE match_posts
                SET status = 'ready_pending',
                    ready_deadline_at = :deadline,
                    updated_at = NOW()
                WHERE id = :post_id AND status = 'open'
                """
            ),
            {"post_id": post_id, "deadline": deadline},
        )
        return True
    return False