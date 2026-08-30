from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any

from .store import REPO_ROOT
from .utils import cuiaba_date_iso

LITURGY_LOCAL_DIR = Path(os.getenv("LITURGIA_LOCAL_DIR", str(REPO_ROOT / "content" / "liturgia" / "dias"))).resolve()


def local_liturgy(date_iso: str) -> dict[str, Any] | None:
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_iso):
        return None
    path = LITURGY_LOCAL_DIR / f"{date_iso}.json"
    if not path.exists():
        return None
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(parsed, dict):
        return None
    if not isinstance(parsed.get("liturgia"), str) or not str(parsed.get("liturgia")).strip():
        return None
    if not isinstance(parsed.get("cor"), str) or not isinstance(parsed.get("tempoLiturgicoAtual"), str) or not isinstance(parsed.get("tempoCategoria"), str):
        return None
    if not isinstance(parsed.get("leituras"), dict):
        return None
    return parsed


def today_liturgy() -> dict[str, Any] | None:
    return local_liturgy(cuiaba_date_iso())
