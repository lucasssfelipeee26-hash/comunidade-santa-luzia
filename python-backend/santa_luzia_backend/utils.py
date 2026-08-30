from __future__ import annotations

import re
import threading
import time
from collections import defaultdict, deque
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

CUIABA = ZoneInfo("America/Cuiaba")
_RATE_LOCK = threading.Lock()
_RATE_BUCKETS: dict[str, deque[float]] = defaultdict(deque)


def cuiaba_now() -> datetime:
    return datetime.now(CUIABA)


def cuiaba_date_iso() -> str:
    return cuiaba_now().date().isoformat()


def operational_year(value: Any) -> int | None:
    try:
        year = int(value)
    except (TypeError, ValueError):
        return None
    return year if 2020 <= year <= 2100 else None


def valid_date_iso(value: Any, min_year: int = 2020, max_year: int = 2100) -> bool:
    text = str(value or "")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", text):
        return False
    try:
        parsed = date.fromisoformat(text)
    except ValueError:
        return False
    return min_year <= parsed.year <= max_year


def valid_time_24h(value: Any) -> bool:
    text = str(value or "")
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", text):
        return False
    return True


def subtract_minutes(clock: str, minutes: int) -> str:
    hour, minute = (int(part) for part in clock.split(":", 1))
    total = (hour * 60 + minute - int(minutes)) % (24 * 60)
    return f"{total // 60:02d}:{total % 60:02d}"


def clean_text(value: Any, limit: int, *, strip_controls: bool = True) -> str:
    text = str(value or "")
    if strip_controls:
        text = re.sub(r"[\x00-\x1f\x7f]", " ", text)
    return text.strip()[:limit]


def rate_allowed(key: str, maximum: int, window_seconds: int) -> bool:
    current = time.monotonic()
    cutoff = current - window_seconds
    with _RATE_LOCK:
        bucket = _RATE_BUCKETS[key]
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) >= maximum:
            return False
        bucket.append(current)
        if len(_RATE_BUCKETS) > 10000:
            for existing_key in list(_RATE_BUCKETS)[:2000]:
                if not _RATE_BUCKETS[existing_key] or _RATE_BUCKETS[existing_key][-1] < cutoff:
                    _RATE_BUCKETS.pop(existing_key, None)
        return True


def request_ip(headers: Any, client_host: str | None) -> str:
    forwarded = str(headers.get("x-forwarded-for", "")).split(",", 1)[0].strip()
    return forwarded or str(client_host or "desconhecido")


def generated_id(prefix: str) -> str:
    return f"{prefix}-{int(time.time() * 1000)}-{time.time_ns() % 1_000_000:06d}"


def date_range(start: date, days: int):
    for offset in range(days):
        yield start + timedelta(days=offset)
