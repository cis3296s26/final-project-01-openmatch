from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text

from core.database import engine
from core.security import get_current_user

from schemas.matches import MatchFinalizeOut, MatchResultReportCreate, MatchResultReportOut, LiveMatchDetailOut, MatchStartConfirmationOut

router = APIRouter(tags=["live_matches"])

@router.post("/matches/{match_id}/report-result", response_model=MatchResultReportOut)
def report_result(match_id: int, payload: MatchResultReportCreate, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])

    with engine.begin() as conn:
        match = conn.execute(
            text("SELECT * FROM live_matches WHERE id = :id"),
            {"id": match_id}
        ).mappings().first()

        if not match:
            raise HTTPException(404, "Match not found")

        if match["status"] not in ("in_progress", "awaiting_result"):
            raise HTTPException(400, "Invalid match state")

        player = conn.execute(
            text("SELECT side FROM match_players WHERE match_id = :mid AND user_id = :uid"),
            {"mid": match_id, "uid": user_id}
        ).mappings().first()

        if not player:
            raise HTTPException(403, "User not in match")

        side = player["side"]

        conn.execute(
            text("""
                INSERT INTO match_result_reports
                (match_id, reporting_side, reported_by_user_id, winner_side, score_side_a, score_side_b, note)
                VALUES (:mid, :side, :uid, :winner, :sa, :sb, :note)
                ON CONFLICT (match_id, reporting_side)
                DO UPDATE SET
                    winner_side = EXCLUDED.winner_side,
                    score_side_a = EXCLUDED.score_side_a,
                    score_side_b = EXCLUDED.score_side_b,
                    note = EXCLUDED.note
            """),
            {
                "mid": match_id,
                "side": side,
                "uid": user_id,
                "winner": payload.winner_side,
                "sa": payload.score_side_a,
                "sb": payload.score_side_b,
                "note": payload.note
            }
        )

        if match["status"] == "in_progress":
            conn.execute(
                text("UPDATE live_matches SET status = 'awaiting_result' WHERE id = :id"),
                {"id": match_id}
            )

        report = conn.execute(
            text("""
                SELECT *
                FROM match_result_reports
                WHERE match_id = :mid AND reporting_side = :side
            """),
            {"mid": match_id, "side": side}
        ).mappings().first()

    return report

@router.get("/matches/{match_id}", response_model=LiveMatchDetailOut)
def get_match(match_id: int):
    with engine.begin() as conn:

        match = conn.execute(
            text("SELECT * FROM live_matches WHERE id = :id"),
            {"id": match_id}
        ).mappings().first()

        if not match:
            raise HTTPException(404, "Match not found")

        players = conn.execute(
            text("SELECT * FROM match_players WHERE match_id = :id"),
            {"id": match_id}
        ).mappings().all()

        confirmations = conn.execute(
            text("SELECT * FROM match_start_confirmations WHERE match_id = :id"),
            {"id": match_id}
        ).mappings().all()

        reports = conn.execute(
            text("SELECT * FROM match_result_reports WHERE match_id = :id"),
            {"id": match_id}
        ).mappings().all()

    return {
        **dict(match),
        "players": players,
        "start_confirmations": confirmations,
        "result_reports": reports
    }

@router.post("/matches/{match_id}/finalize", response_model=MatchFinalizeOut)
def finalize_match(match_id: int, current_user: dict = Depends(get_current_user)):
    with engine.begin() as conn:

        match = conn.execute(
            text("SELECT * FROM live_matches WHERE id = :id"),
            {"id": match_id},
        ).mappings().first()

        if not match:
            raise HTTPException(404, "Match not found")

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
                text("UPDATE live_matches SET status = 'disputed' WHERE id = :id"),
                {"id": match_id},
            )
            raise HTTPException(409, "Result disputed")

        winner_side = winner_sides.pop()

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
            {"id": match_id, "sport_id": match["sport_id"]},
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
        else:
            winner_team_id = None

        conn.execute(
            text(
                """
                UPDATE live_matches
                SET
                    winner_side = :winner_side,
                    winner_team_id = :winner_team_id,
                    status = 'completed',
                    ended_at = NOW(),
                    result_method = 'agreed',
                    rating_processed = TRUE,
                    updated_at = NOW()
                WHERE id = :id
                """
            ),
            {
                "id": match_id,
                "winner_side": winner_side,
                "winner_team_id": winner_team_id,
            },
        )

    return {
        "match_id": match_id,
        "winner_side": winner_side,
        "status": "completed"
    }


@router.post("/matches/{match_id}/start", response_model=MatchStartConfirmationOut)
def start_match(match_id: int, current_user: dict = Depends(get_current_user)):
    user_id = int(current_user["sub"])

    with engine.begin() as conn:
        match = conn.execute(
            text("SELECT * FROM live_matches WHERE id = :id"),
            {"id": match_id}
        ).mappings().first()

        if not match:
            raise HTTPException(404, "Match not found")

        if match["status"] != "awaiting_start":
            raise HTTPException(400, "Match already started or invalid state")
        
        if match["rating_processed"]:
            raise HTTPException(400, "Match already finalized")

        player = conn.execute(
            text("SELECT side FROM match_players WHERE match_id = :mid AND user_id = :uid"),
            {"mid": match_id, "uid": user_id}
        ).mappings().first()

        if not player:
            raise HTTPException(403, "User not in match")

        side = player["side"]

        conn.execute(
            text("""
                INSERT INTO match_start_confirmations (match_id, side, user_id)
                VALUES (:mid, :side, :uid)
                ON CONFLICT (match_id, side) DO NOTHING
            """),
            {"mid": match_id, "side": side, "uid": user_id}
        )

        confirmations = conn.execute(
            text("SELECT COUNT(*) as c FROM match_start_confirmations WHERE match_id = :id"),
            {"id": match_id}
        ).mappings().one()

        if confirmations["c"] == 2:
            conn.execute(
                text("""
                    UPDATE live_matches
                    SET status = 'in_progress', started_at = NOW()
                    WHERE id = :id
                """),
                {"id": match_id}
            )

    return {"message": "Start confirmed"}