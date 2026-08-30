from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from .store import REPO_ROOT
from .utils import cuiaba_date_iso

LITURGY_LOCAL_DIR = Path(os.getenv("LITURGIA_LOCAL_DIR", str(REPO_ROOT / "content" / "liturgia" / "dias"))).resolve()
LITURGY_COMPLETE_DIR = Path(
    os.getenv("LITURGIA_COMPLETE_DIR", str(REPO_ROOT / "public" / "offline" / "liturgia-completa"))
).resolve()


def _valid_liturgy(parsed: Any) -> dict[str, Any] | None:
    if not isinstance(parsed, dict):
        return None
    if not isinstance(parsed.get("liturgia"), str) or not str(parsed.get("liturgia")).strip():
        return None
    if not isinstance(parsed.get("cor"), str):
        return None
    # Os pacotes mensais consolidados preservam estes campos, inclusive quando o
    # valor é string vazia em celebrações que não precisam de classificação extra.
    if not isinstance(parsed.get("tempoLiturgicoAtual", ""), str) or not isinstance(parsed.get("tempoCategoria", ""), str):
        return None
    readings = parsed.get("leituras")
    if not isinstance(readings, dict):
        return None
    return parsed


@lru_cache(maxsize=36)
def _monthly_package(month_key: str) -> dict[str, Any] | None:
    if not re.fullmatch(r"\d{4}-\d{2}", month_key):
        return None
    path = LITURGY_COMPLETE_DIR / f"{month_key}.json"
    if not path.exists():
        return None
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(parsed, dict) or not isinstance(parsed.get("dias"), dict):
        return None
    return parsed


def complete_offline_liturgy(date_iso: str) -> dict[str, Any] | None:
    """Porta direta de obterLiturgiaCompletaOffline() do backend TypeScript.

    O snapshot mensal só é aceito quando contém a celebração e, como no servidor
    original, pelo menos Primeira Leitura e Evangelho. Assim não promovemos um
    pacote parcial a liturgia completa.
    """
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_iso):
        return None
    package = _monthly_package(date_iso[:7])
    days = package.get("dias") if package else None
    raw = days.get(date_iso) if isinstance(days, dict) else None
    day = _valid_liturgy(raw)
    if not day:
        return None
    readings = day.get("leituras") or {}
    first = readings.get("primeiraLeitura")
    gospel = readings.get("evangelho")
    if not isinstance(first, list) or not first or not isinstance(gospel, list) or not gospel:
        return None
    return day


def local_liturgy(date_iso: str) -> dict[str, Any] | None:
    """Lê a base diária curada e usa o mesmo pacote mensal completo do TS como fallback."""
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_iso):
        return None
    path = LITURGY_LOCAL_DIR / f"{date_iso}.json"
    if path.exists():
        try:
            parsed = _valid_liturgy(json.loads(path.read_text(encoding="utf-8")))
            if parsed:
                return parsed
        except Exception:
            pass
    return complete_offline_liturgy(date_iso)


def today_liturgy() -> dict[str, Any] | None:
    return local_liturgy(cuiaba_date_iso())
