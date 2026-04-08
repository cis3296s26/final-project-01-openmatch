from datetime import datetime, timezone

def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def utc_now() -> datetime:
    return datetime.now(timezone.utc)