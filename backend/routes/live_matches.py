from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text

from core.database import engine
from core.security import get_current_user
from core.mmr import apply_individual_competitive_mmr, apply_team_competitive_mmr
from core.match_history import archive_completed_match
from core.websocket import manager

from schemas.matches import (
    MatchFinalizeOut,
    MatchResultReportCreate,
    MatchResultReportOut,
    LiveMatchDetailOut,
    MatchStartConfirmationOut,
    MatchScoreUpdate,
    MatchScoreOut,
)

router = APIRouter(tags=["live_matches"])


def _get_match_or_404(conn, match_id: int):
    match = conn.execute(
        text("SELECT * FROM live_matches WHERE id = :id"),
        {"id": match_id},
    ).mappings().first()
    if not match:
        raise HTTPException(404, "Match not found")
    return match


def _require_match_player(conn, match_id: int, user_id: int):
    player = conn.execute(
        text("SELECT * FROM match_players WHERE match_id = :mid AND user_id = :uid"),
        {"mid": match_id, "uid": user_id},
    ).mappings().first()
    if not player:
        raise HTTPException(403, "User not in match")
    return player


def _build_match_detail(conn, match):
    players = conn.execute(
        text("SELECT * FROM match_players WHERE match_id = :id ORDER BY id ASC"),
        {"id": match["id"]},
    ).mappings().all()

    confirmations = conn.execute(
        text("SELECT * FROM match_start_confirmations WHERE match_id = :id ORDER BY confirmed_at ASC"),
        {"id": match["id"]},
    ).mappings().all()

    reports = conn.execute(
        text("SELECT * FROM match_result_reports WHERE match_id = :id ORDER BY created_at ASC"),
        {"id": match["id"]},
    ).mappings().all()

    return {
        **dict(match),
        "players": players,
        "start_confirmations": confirmations,
        "result_reports": reports,
    }


def _apply_match_completion(conn, match, winner_side: str):
    post = conn.execute(
        text(
            """
            SELECT id, is_competitive
            FROM match_posts
            WHERE id = :post_id
            """
        ),
        {"post_id": match["match_post_id"]},
    ).mappings().first()

    players = conn.execute(
        text(
            """
            SELECT mp.user_id, mp.side, ps.profile_id, ps.sport_id
            FROM match_players mp
            JOIN profiles p ON p.user_id = mp.user_id
            JOIN profile_sports ps ON ps.profile_id = p.id AND ps.sport_id = :sport_id
            WHERE mp.match_id = :id
            """
        ),
        {"id": match["id"], "sport_id": match["sport_id"]},
    ).mappings().all()

    for p in players:
        is_winner = p["side"] == winner_side
        conn.execute(
            text(
                """
                UPDATE profile_sports
                SET
                    wins = wins + :w,
                    losses = losses + :l,
                    matches_played = matches_played + 1,
                    updated_at = NOW()
                WHERE profile_id = :pid AND sport_id = :sid
                """
            ),
            {
                "w": 1 if is_winner else 0,
                "l": 0 if is_winner else 1,
                "pid": p["profile_id"],
                "sid": p["sport_id"],
            },
        )

    winner_team_id = None

    if match["queue_type"] == "team":
        winner_team_id = match["side_a_team_id"] if winner_side == "A" else match["side_b_team_id"]
        loser_team_id = match["side_b_team_id"] if winner_side == "A" else match["side_a_team_id"]

        conn.execute(
            text(
                """
                UPDATE team_stats
                SET wins = wins + 1,
                    matches_played = matches_played + 1,
                    updated_at = NOW()
                WHERE team_id = :tid
                """
            ),
            {"tid": winner_team_id},
        )

        conn.execute(
            text(
                """
                UPDATE team_stats
                SET losses = losses + 1,
                    matches_played = matches_played + 1,
                    updated_at = NOW()
                WHERE team_id = :tid
                """
            ),
            {"tid": loser_team_id},
        )

    if post and post["is_competitive"]:
        if match["queue_type"] == "team":
            apply_team_competitive_mmr(conn, match, winner_side)
        else:
            apply_individual_competitive_mmr(conn, match, winner_side)

    conn.execute(
        text(
            """
            UPDATE live_matches
            SET
                winner_side = :winner_side,
                winner_team_id = :winner_team_id,
                status = 'completed',
                ended_at = NOW(),
                result_method = 'scoreboard',
                rating_processed = TRUE,
                updated_at = NOW()
            WHERE id = :id
            """
        ),
        {
            "id": match["id"],
            "winner_side": winner_side,
            "winner_team_id": winner_team_id,
        },
    )

    archive_completed_match(conn, match["id"])

    conn.execute(
        text("DELETE FROM match_posts WHERE id = :post_id"),
        {"post_id": match["match_post_id"]},
    )


@router.get("/matches/{match_id}", response_model=LiveMatchDetailOut)
def get_match(match_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])
    with engine.begin() as conn:
        match = _get_match_or_404(conn, match_id)
        _require_match_player(conn, match_id, user_id)
        return _build_match_detail(conn, match)


@router.get("/posts/{post_id}/live-match", response_model=LiveMatchDetailOut)
def get_live_match_by_post(post_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])
    with engine.begin() as conn:
        match = conn.execute(
            text(
                """
                SELECT *
                FROM live_matches
                WHERE match_post_id = :post_id
                ORDER BY created_at DESC
                LIMIT 1
                """
            ),
            {"post_id": post_id},
        ).mappings().first()

        if not match:
            raise HTTPException(404, "No live match found for this post")

        _require_match_player(conn, match["id"], user_id)
        return _build_match_detail(conn, match)


@router.post("/matches/{match_id}/start", response_model=MatchStartConfirmationOut)
async def start_match(match_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])
    post_id = None

    with engine.begin() as conn:
        match = _get_match_or_404(conn, match_id)
        post_id = match["match_post_id"]

        if match["rating_processed"]:
            raise HTTPException(400, "Match already finalized")

        if match["status"] != "awaiting_start":
            raise HTTPException(400, "Match already started or invalid state")

        player = _require_match_player(conn, match_id, user_id)
        side = player["side"]

        conn.execute(
            text(
                """
                INSERT INTO match_start_confirmations (match_id, side, user_id)
                VALUES (:mid, :side, :uid)
                ON CONFLICT (match_id, side) DO NOTHING
                """
            ),
            {"mid": match_id, "side": side, "uid": user_id},
        )

        confirmation = conn.execute(
            text(
                """
                SELECT *
                FROM match_start_confirmations
                WHERE match_id = :mid AND side = :side
                """
            ),
            {"mid": match_id, "side": side},
        ).mappings().first()

        confirmations = conn.execute(
            text("SELECT COUNT(*) as c FROM match_start_confirmations WHERE match_id = :id"),
            {"id": match_id},
        ).mappings().one()

        if int(confirmations["c"]) == 2:
            conn.execute(
                text(
                    """
                    UPDATE live_matches
                    SET status = 'in_progress', started_at = NOW(), updated_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"id": match_id},
            )
            conn.execute(
                text(
                    """
                    UPDATE match_posts
                    SET status = 'in_progress',
                        expires_at = NOW() + INTERVAL '12 hours',
                        updated_at = NOW()
                    WHERE id = :post_id
                    """
                ),
                {"post_id": post_id},
            )

    await manager.broadcast({
        "type": "live_match_updated",
        "postId": post_id,
    })
    await manager.broadcast({
        "type": "match_started",
        "postId": post_id,
    })
    await manager.broadcast({
        "type": "post_updated",
        "postId": post_id,
    })

    return confirmation


@router.post("/matches/{match_id}/score", response_model=MatchScoreOut)
async def update_score(match_id: int, payload: MatchScoreUpdate, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])
    post_id = None

    with engine.begin() as conn:
        match = _get_match_or_404(conn, match_id)
        player = _require_match_player(conn, match_id, user_id)
        post_id = match["match_post_id"]

        if match["rating_processed"]:
            raise HTTPException(400, "Match already finalized")

        if match["status"] != "in_progress":
            raise HTTPException(400, "Score can only be updated while match is in progress")

        # Anti-cheat rule:
        # You can only update the opposing side's score.
        if player["side"] == payload.side:
            raise HTTPException(403, "You can only update the opposing side's score.")

        if payload.side == "A":
            next_score = max(0, int(match["score_side_a"]) + payload.delta)
            conn.execute(
                text(
                    """
                    UPDATE live_matches
                    SET score_side_a = :score, updated_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"id": match_id, "score": next_score},
            )
        else:
            next_score = max(0, int(match["score_side_b"]) + payload.delta)
            conn.execute(
                text(
                    """
                    UPDATE live_matches
                    SET score_side_b = :score, updated_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"id": match_id, "score": next_score},
            )

        updated = _get_match_or_404(conn, match_id)

    await manager.broadcast({
        "type": "match_score_updated",
        "postId": post_id,
    })
    await manager.broadcast({
        "type": "live_match_updated",
        "postId": post_id,
    })

    return {
        "match_id": updated["id"],
        "score_side_a": updated["score_side_a"],
        "score_side_b": updated["score_side_b"],
        "status": updated["status"],
    }


@router.post("/matches/{match_id}/end", response_model=MatchFinalizeOut)
async def end_match(match_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])
    post_id = None

    with engine.begin() as conn:
        match = _get_match_or_404(conn, match_id)
        _require_match_player(conn, match_id, user_id)
        post_id = match["match_post_id"]

        if match["rating_processed"]:
            raise HTTPException(400, "Match already finalized")

        if match["status"] != "in_progress":
            raise HTTPException(400, "Only an in-progress match can be ended")

        score_a = int(match["score_side_a"] or 0)
        score_b = int(match["score_side_b"] or 0)

        if score_a == score_b:
            raise HTTPException(400, "Cannot end match while score is tied")

        winner_side = "A" if score_a > score_b else "B"
        _apply_match_completion(conn, match, winner_side)

    await manager.broadcast({
        "type": "match_ended",
        "postId": post_id,
    })
    await manager.broadcast({
        "type": "live_match_updated",
        "postId": post_id,
    })
    await manager.broadcast({
        "type": "post_updated",
        "postId": post_id,
    })

    return {
        "match_id": match_id,
        "winner_side": winner_side,
        "status": "completed",
    }


@router.post("/matches/{match_id}/report-result", response_model=MatchResultReportOut)
async def report_result(match_id: int, payload: MatchResultReportCreate, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])
    post_id = None

    with engine.begin() as conn:
        match = _get_match_or_404(conn, match_id)
        post_id = match["match_post_id"]

        if match["rating_processed"]:
            raise HTTPException(400, "Match already finalized")

        if match["status"] not in ("in_progress", "awaiting_result"):
            raise HTTPException(400, "Invalid match state")

        player = _require_match_player(conn, match_id, user_id)
        side = player["side"]

        conn.execute(
            text(
                """
                INSERT INTO match_result_reports
                (match_id, reporting_side, reported_by_user_id, winner_side, score_side_a, score_side_b, note)
                VALUES (:mid, :side, :uid, :winner, :sa, :sb, :note)
                ON CONFLICT (match_id, reporting_side)
                DO UPDATE SET
                    winner_side = EXCLUDED.winner_side,
                    score_side_a = EXCLUDED.score_side_a,
                    score_side_b = EXCLUDED.score_side_b,
                    note = EXCLUDED.note
                """
            ),
            {
                "mid": match_id,
                "side": side,
                "uid": user_id,
                "winner": payload.winner_side,
                "sa": payload.score_side_a,
                "sb": payload.score_side_b,
                "note": payload.note,
            },
        )

        if match["status"] == "in_progress":
            conn.execute(
                text(
                    """
                    UPDATE live_matches
                    SET status = 'awaiting_result', updated_at = NOW()
                    WHERE id = :id
                    """
                ),
                {"id": match_id},
            )

        report = conn.execute(
            text(
                """
                SELECT *
                FROM match_result_reports
                WHERE match_id = :mid AND reporting_side = :side
                """
            ),
            {"mid": match_id, "side": side},
        ).mappings().first()

    await manager.broadcast({
        "type": "live_match_updated",
        "postId": post_id,
    })

    return report


@router.post("/matches/{match_id}/finalize", response_model=MatchFinalizeOut)
async def finalize_match(match_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])
    post_id = None

    with engine.begin() as conn:
        match = _get_match_or_404(conn, match_id)
        _require_match_player(conn, match_id, user_id)
        post_id = match["match_post_id"]

        if match["rating_processed"]:
            raise HTTPException(400, "Match already finalized")

        if match["status"] != "awaiting_result":
            raise HTTPException(400, "Match not ready for finalization")

        reports = conn.execute(
            text("SELECT reporting_side, winner_side FROM match_result_reports WHERE match_id = :id"),
            {"id": match_id},
        ).mappings().all()

        if len(reports) < 2:
            raise HTTPException(400, "Both sides must submit result")

        winner_sides = {r["winner_side"] for r in reports}

        if len(winner_sides) != 1:
            conn.execute(
                text("UPDATE live_matches SET status = 'disputed', updated_at = NOW() WHERE id = :id"),
                {"id": match_id},
            )
            await manager.broadcast({
                "type": "live_match_updated",
                "postId": post_id,
            })
            raise HTTPException(409, "Result disputed")

        winner_side = winner_sides.pop()
        _apply_match_completion(conn, match, winner_side)

    await manager.broadcast({
        "type": "match_ended",
        "postId": post_id,
    })
    await manager.broadcast({
        "type": "live_match_updated",
        "postId": post_id,
    })
    await manager.broadcast({
        "type": "post_updated",
        "postId": post_id,
    })

    return {
        "match_id": match_id,
        "winner_side": winner_side,
        "status": "completed",
    }