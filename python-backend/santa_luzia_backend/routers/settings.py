from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..data_protection import protect_database, read_health
from ..security import require_moderator
from ..store import DATA_DIR, revision

router = APIRouter(tags=["settings"])
SITE_CONFIG = DATA_DIR / "configuracao-site.json"
THEMES = [
    {"id": "manto-rubi", "nome": "Manto Rubi + Dourado", "descricao": "Vermelho rubi inspirado no manto de Santa Luzia, com detalhes dourados.", "cores": ["#7b1326", "#5a0b18", "#d4af37"]},
    {"id": "bordo-ouro", "nome": "Bordô + Ouro", "descricao": "Uma combinação mais sóbria, com bordô profundo e ouro antigo.", "cores": ["#5d1020", "#3b0710", "#c99a2e"]},
    {"id": "marfim-rubi", "nome": "Marfim + Rubi", "descricao": "Tema claro com rubi nos destaques e dourado suave.", "cores": ["#8a2035", "#fffaf2", "#d8b45a"]},
    {"id": "vinho-dourado", "nome": "Vinho Escuro + Dourado", "descricao": "Tema solene para o site público, com vinho escuro e dourado luminoso.", "cores": ["#490b17", "#2f060d", "#dfbb55"]},
]
THEME_IDS = {item["id"] for item in THEMES}
DEFAULT_THEME = "manto-rubi"


def response(body: Any, status: int = 200, headers: dict[str, str] | None = None):
    return JSONResponse(body, status_code=status, headers=headers)


def read_theme() -> str:
    try:
        value = json.loads(SITE_CONFIG.read_text(encoding="utf-8"))
        theme = value.get("tema") if isinstance(value, dict) else None
        return theme if theme in THEME_IDS else DEFAULT_THEME
    except Exception:
        return DEFAULT_THEME


def save_theme(theme: str):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    try:
        current = json.loads(SITE_CONFIG.read_text(encoding="utf-8")) if SITE_CONFIG.exists() else {}
    except Exception:
        current = {}
    if not isinstance(current, dict):
        current = {}
    from ..store import now_ms
    current.update({"tema": theme, "atualizado_em": now_ms()})
    temporary = SITE_CONFIG.with_suffix(".json.tmp")
    temporary.write_text(json.dumps(current, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(temporary, SITE_CONFIG)


@router.get("/api/configuracao/tema")
async def theme_get():
    return response({"ok": True, "tema": read_theme(), "opcoes": THEMES}, headers={"Cache-Control": "no-store, max-age=0"})


@router.post("/api/configuracao/tema")
async def theme_post(request: Request):
    require_moderator(request)
    try:
        body = await request.json()
    except Exception:
        body = None
    theme = body.get("tema") if isinstance(body, dict) else None
    if theme not in THEME_IDS:
        return response({"ok": False, "erro": "Tema inválido."}, 400)
    save_theme(str(theme))
    return response({"ok": True, "tema": theme})


@router.get("/api/configuracao/diagnostico")
async def diagnostic_config(request: Request):
    require_moderator(request)
    dsn = str(os.getenv("GLITCHTIP_DSN") or os.getenv("NEXT_PUBLIC_GLITCHTIP_DSN") or "").strip()
    return response({"ok": True, "glitchTipDsn": dsn or None, "deepScan": True}, headers={"Cache-Control": "no-store, max-age=0"})


@router.get("/api/diagnostico")
async def diagnostic(request: Request):
    require_moderator(request)
    bank = protect_database() or read_health()
    payload = None
    if isinstance(bank, dict):
        payload = {
            "checkedAt": bank.get("checkedAt"), "status": bank.get("status"), "size": bank.get("size"),
            "sha256": bank.get("sha256"), "backupCount": bank.get("backupCount"), "lastBackup": bank.get("lastBackup"),
            "recoveredFrom": bank.get("recoveredFrom") or None, "error": bank.get("error") or None,
        }
    return response({"ok": True, "versaoDiagnostico": 1, "revisaoDados": revision(), "banco": payload}, headers={"Cache-Control": "no-store, max-age=0"})
