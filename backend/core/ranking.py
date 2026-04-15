TIERS = [
    {"name": "Bronze III", "min": 0, "max": 299},
    {"name": "Bronze II", "min": 300, "max": 599},
    {"name": "Bronze I", "min": 600, "max": 899},
    {"name": "Silver III", "min": 900, "max": 1099},
    {"name": "Silver II", "min": 1100, "max": 1249},
    {"name": "Silver I", "min": 1250, "max": 1399},
    {"name": "Gold III", "min": 1400, "max": 1549},
    {"name": "Gold II", "min": 1550, "max": 1699},
    {"name": "Gold I", "min": 1700, "max": 1849},
    {"name": "Platinum III", "min": 1850, "max": 1999},
    {"name": "Platinum II", "min": 2000, "max": 2149},
    {"name": "Platinum I", "min": 2150, "max": 2299},
    {"name": "Diamond", "min": 2300, "max": 2599},
    {"name": "Champion", "min": 2600, "max": 9999},
]


def get_rank_from_mmr(mmr: int) -> str:
    for tier in TIERS:
        if tier["min"] <= mmr <= tier["max"]:
            return tier["name"]
    return "Bronze III"