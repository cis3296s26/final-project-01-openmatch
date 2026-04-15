from math import pow
from sqlalchemy import text

from core.ranking import get_rank_from_mmr


DEFAULT_MMR = 1000
NORMAL_K = 32
PLACEMENT_K = 64
MIN_MMR = 0



def expected_score(player_mmr: int, opponent_mmr: int) -> float:
    return 1 / (1 + pow(10, (opponent_mmr - player_mmr) / 400))


def calc_new_mmr(player_mmr: int, opponent_mmr: int, did_win: bool, placement_matches_remaining: int) -> int:
    actual = 1.0 if did_win else 0.0
    expected = expected_score(player_mmr, opponent_mmr)
    k = PLACEMENT_K if placement_matches_remaining > 0 else NORMAL_K
    new_mmr = round(player_mmr + k * (actual - expected))
    return max(MIN_MMR, new_mmr)


def average(values: list[int]) -> int:
    if not values:
        return DEFAULT_MMR
    return round(sum(values) / len(values))


def apply_individual_competitive_mmr(conn, match: dict, winner_side: str) -> None:
    players = conn.execute(
        text(
            """
            SELECT
                mp.id AS match_player_id,
                mp.user_id,
                mp.side,
                p.id AS profile_id,
                ps.id AS profile_sport_id,
                ps.sport_id,
                ps.mmr,
                ps.placement_matches_remaining,
                ps.rank_tier
            FROM match_players mp
            JOIN profiles p
              ON p.user_id = mp.user_id
            JOIN profile_sports ps
              ON ps.profile_id = p.id
             AND ps.sport_id = :sport_id
            WHERE mp.match_id = :match_id
            ORDER BY mp.id ASC
            """
        ),
        {"match_id": match["id"], "sport_id": match["sport_id"]},
    ).mappings().all()

    side_a = [p for p in players if p["side"] == "A"]
    side_b = [p for p in players if p["side"] == "B"]

    avg_a = average([int(p["mmr"]) for p in side_a])
    avg_b = average([int(p["mmr"]) for p in side_b])

    for p in side_a:
        did_win = winner_side == "A"
        old_mmr = int(p["mmr"])
        placement_remaining = int(p["placement_matches_remaining"])
        new_mmr = calc_new_mmr(old_mmr, avg_b, did_win, placement_remaining)
        new_rank = get_rank_from_mmr(new_mmr)
        new_placement_remaining = max(0, placement_remaining - 1)

        conn.execute(
            text(
                """
                UPDATE profile_sports
                SET
                    mmr = :new_mmr,
                    placement_matches_remaining = :placement_remaining,
                    rank_tier = :rank_tier,
                    updated_at = NOW()
                WHERE id = :profile_sport_id
                """
            ),
            {
                "new_mmr": new_mmr,
                "placement_remaining": new_placement_remaining,
                "rank_tier": new_rank,
                "profile_sport_id": p["profile_sport_id"],
            },
        )

        conn.execute(
            text(
                """
                UPDATE match_players
                SET mmr_before = :mmr_before,
                    mmr_after = :mmr_after
                WHERE id = :match_player_id
                """
            ),
            {
                "mmr_before": old_mmr,
                "mmr_after": new_mmr,
                "match_player_id": p["match_player_id"],
            },
        )

    for p in side_b:
        did_win = winner_side == "B"
        old_mmr = int(p["mmr"])
        placement_remaining = int(p["placement_matches_remaining"])
        new_mmr = calc_new_mmr(old_mmr, avg_a, did_win, placement_remaining)
        new_rank = get_rank_from_mmr(new_mmr)
        new_placement_remaining = max(0, placement_remaining - 1)

        conn.execute(
            text(
                """
                UPDATE profile_sports
                SET
                    mmr = :new_mmr,
                    placement_matches_remaining = :placement_remaining,
                    rank_tier = :rank_tier,
                    updated_at = NOW()
                WHERE id = :profile_sport_id
                """
            ),
            {
                "new_mmr": new_mmr,
                "placement_remaining": new_placement_remaining,
                "rank_tier": new_rank,
                "profile_sport_id": p["profile_sport_id"],
            },
        )

        conn.execute(
            text(
                """
                UPDATE match_players
                SET mmr_before = :mmr_before,
                    mmr_after = :mmr_after
                WHERE id = :match_player_id
                """
            ),
            {
                "mmr_before": old_mmr,
                "mmr_after": new_mmr,
                "match_player_id": p["match_player_id"],
            },
        )


def apply_team_competitive_mmr(conn, match: dict, winner_side: str) -> None:
    if not match["side_a_team_id"] or not match["side_b_team_id"]:
        return

    side_a_team = conn.execute(
        text(
            """
            SELECT team_id, team_mmr
            FROM team_stats
            WHERE team_id = :team_id
            """
        ),
        {"team_id": match["side_a_team_id"]},
    ).mappings().first()

    side_b_team = conn.execute(
        text(
            """
            SELECT team_id, team_mmr
            FROM team_stats
            WHERE team_id = :team_id
            """
        ),
        {"team_id": match["side_b_team_id"]},
    ).mappings().first()

    if not side_a_team or not side_b_team:
        return

    a_old = int(side_a_team["team_mmr"])
    b_old = int(side_b_team["team_mmr"])

    # Team MMR update
    a_new = calc_new_mmr(a_old, b_old, winner_side == "A", 0)
    b_new = calc_new_mmr(b_old, a_old, winner_side == "B", 0)

    conn.execute(
        text(
            """
            UPDATE team_stats
            SET team_mmr = :team_mmr,
                updated_at = NOW()
            WHERE team_id = :team_id
            """
        ),
        {"team_mmr": a_new, "team_id": match["side_a_team_id"]},
    )

    conn.execute(
        text(
            """
            UPDATE team_stats
            SET team_mmr = :team_mmr,
                updated_at = NOW()
            WHERE team_id = :team_id
            """
        ),
        {"team_mmr": b_new, "team_id": match["side_b_team_id"]},
    )

    # Side A players: opponent is Team B's old MMR
    side_a_players = conn.execute(
        text(
            """
            SELECT
                mp.id AS match_player_id,
                mp.user_id,
                ps.id AS profile_sport_id,
                ps.mmr,
                ps.placement_matches_remaining
            FROM match_players mp
            JOIN profiles p
              ON p.user_id = mp.user_id
            JOIN profile_sports ps
              ON ps.profile_id = p.id
             AND ps.sport_id = :sport_id
            WHERE mp.match_id = :match_id
              AND mp.side = 'A'
            ORDER BY mp.id ASC
            """
        ),
        {"match_id": match["id"], "sport_id": match["sport_id"]},
    ).mappings().all()

    # Side B players: opponent is Team A's old MMR
    side_b_players = conn.execute(
        text(
            """
            SELECT
                mp.id AS match_player_id,
                mp.user_id,
                ps.id AS profile_sport_id,
                ps.mmr,
                ps.placement_matches_remaining
            FROM match_players mp
            JOIN profiles p
              ON p.user_id = mp.user_id
            JOIN profile_sports ps
              ON ps.profile_id = p.id
             AND ps.sport_id = :sport_id
            WHERE mp.match_id = :match_id
              AND mp.side = 'B'
            ORDER BY mp.id ASC
            """
        ),
        {"match_id": match["id"], "sport_id": match["sport_id"]},
    ).mappings().all()

    for p in side_a_players:
        old_player_mmr = int(p["mmr"])
        placement_remaining = int(p["placement_matches_remaining"])
        new_player_mmr = calc_new_mmr(
            old_player_mmr,
            b_old,
            winner_side == "A",
            placement_remaining,
        )
        new_rank = get_rank_from_mmr(new_player_mmr)
        new_placement_remaining = max(0, placement_remaining - 1)

        conn.execute(
            text(
                """
                UPDATE profile_sports
                SET
                    mmr = :new_mmr,
                    placement_matches_remaining = :placement_remaining,
                    rank_tier = :rank_tier,
                    updated_at = NOW()
                WHERE id = :profile_sport_id
                """
            ),
            {
                "new_mmr": new_player_mmr,
                "placement_remaining": new_placement_remaining,
                "rank_tier": new_rank,
                "profile_sport_id": p["profile_sport_id"],
            },
        )

        conn.execute(
            text(
                """
                UPDATE match_players
                SET
                    mmr_before = :mmr_before,
                    mmr_after = :mmr_after
                WHERE id = :match_player_id
                """
            ),
            {
                "mmr_before": old_player_mmr,
                "mmr_after": new_player_mmr,
                "match_player_id": p["match_player_id"],
            },
        )

    for p in side_b_players:
        old_player_mmr = int(p["mmr"])
        placement_remaining = int(p["placement_matches_remaining"])
        new_player_mmr = calc_new_mmr(
            old_player_mmr,
            a_old,
            winner_side == "B",
            placement_remaining,
        )
        new_rank = get_rank_from_mmr(new_player_mmr)
        new_placement_remaining = max(0, placement_remaining - 1)

        conn.execute(
            text(
                """
                UPDATE profile_sports
                SET
                    mmr = :new_mmr,
                    placement_matches_remaining = :placement_remaining,
                    rank_tier = :rank_tier,
                    updated_at = NOW()
                WHERE id = :profile_sport_id
                """
            ),
            {
                "new_mmr": new_player_mmr,
                "placement_remaining": new_placement_remaining,
                "rank_tier": new_rank,
                "profile_sport_id": p["profile_sport_id"],
            },
        )

        conn.execute(
            text(
                """
                UPDATE match_players
                SET
                    mmr_before = :mmr_before,
                    mmr_after = :mmr_after
                WHERE id = :match_player_id
                """
            ),
            {
                "mmr_before": old_player_mmr,
                "mmr_after": new_player_mmr,
                "match_player_id": p["match_player_id"],
            },
        )