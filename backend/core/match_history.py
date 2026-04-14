from sqlalchemy import text


def archive_completed_match(conn, match_id: int) -> int:
    match = conn.execute(
        text(
            """
            SELECT
                lm.id,
                lm.match_post_id,
                lm.sport_id,
                lm.queue_type,
                lm.side_a_team_id,
                lm.side_b_team_id,
                lm.status,
                lm.started_at,
                lm.ended_at,
                lm.winner_side,
                lm.winner_team_id,
                lm.result_method,
                lm.score_side_a,
                lm.score_side_b,
                mp.title,
                mp.skill,
                COALESCE(mp.is_competitive, FALSE) AS is_competitive,
                mp.location,
                mp.note
            FROM live_matches lm
            JOIN match_posts mp ON mp.id = lm.match_post_id
            WHERE lm.id = :match_id
            """
        ),
        {"match_id": match_id},
    ).mappings().first()

    if not match:
        raise ValueError("Match not found")

    history = conn.execute(
        text(
            """
            INSERT INTO match_history (
                original_match_id,
                original_post_id,
                sport_id,
                queue_type,
                title,
                skill,
                is_competitive,
                location,
                note,
                side_a_team_id,
                side_b_team_id,
                winner_side,
                winner_team_id,
                score_side_a,
                score_side_b,
                result_method,
                started_at,
                ended_at
            )
            VALUES (
                :original_match_id,
                :original_post_id,
                :sport_id,
                :queue_type,
                :title,
                :skill,
                :is_competitive,
                :location,
                :note,
                :side_a_team_id,
                :side_b_team_id,
                :winner_side,
                :winner_team_id,
                :score_side_a,
                :score_side_b,
                :result_method,
                :started_at,
                :ended_at
            )
            RETURNING id
            """
        ),
        {
            "original_match_id": match["id"],
            "original_post_id": match["match_post_id"],
            "sport_id": match["sport_id"],
            "queue_type": match["queue_type"],
            "title": match["title"],
            "skill": match["skill"],
            "is_competitive": match["is_competitive"],
            "location": match["location"],
            "note": match["note"],
            "side_a_team_id": match["side_a_team_id"],
            "side_b_team_id": match["side_b_team_id"],
            "winner_side": match["winner_side"],
            "winner_team_id": match["winner_team_id"],
            "score_side_a": match["score_side_a"],
            "score_side_b": match["score_side_b"],
            "result_method": match["result_method"],
            "started_at": match["started_at"],
            "ended_at": match["ended_at"],
        },
    ).mappings().one()

    history_id = history["id"]

    players = conn.execute(
        text(
            """
            SELECT user_id, side, team_id, mmr_before, mmr_after
            FROM match_players
            WHERE match_id = :match_id
            ORDER BY id ASC
            """
        ),
        {"match_id": match_id},
    ).mappings().all()

    for p in players:
        conn.execute(
            text(
                """
                INSERT INTO match_history_players (
                    match_history_id,
                    user_id,
                    side,
                    team_id,
                    mmr_before,
                    mmr_after
                )
                VALUES (
                    :match_history_id,
                    :user_id,
                    :side,
                    :team_id,
                    :mmr_before,
                    :mmr_after
                )
                """
            ),
            {
                "match_history_id": history_id,
                "user_id": p["user_id"],
                "side": p["side"],
                "team_id": p["team_id"],
                "mmr_before": p["mmr_before"],
                "mmr_after": p["mmr_after"],
            },
        )

    return history_id