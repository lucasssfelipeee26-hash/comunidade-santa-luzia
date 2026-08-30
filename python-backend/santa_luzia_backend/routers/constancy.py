from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..ranking_notifications import notify_ranking_changes, ranking_snapshot
from ..security import require_user
from ..store import mutate_main, now_ms, read_main
from ..utils import cuiaba_date_iso, valid_date_iso

router = APIRouter(tags=["constancy"])
POINTS_PER_DAY = 2
WEEK_DAYS = 7
PREFIX = "Constância de Luz"
MAX_OFFLINE_DAYS = 14


def response(body: dict[str, Any], status: int = 200):
    return JSONResponse(body, status_code=status)


def shift(iso: str, days: int) -> str:
    return (date.fromisoformat(iso) + timedelta(days=days)).isoformat()


def week_of(today: str):
    parsed = date.fromisoformat(today)
    distance = parsed.weekday()
    monday = parsed - timedelta(days=distance)
    dates = [(monday + timedelta(days=i)).isoformat() for i in range(WEEK_DAYS)]
    return monday.isoformat(), dates[-1], dates, distance


def reason(day: str) -> str:
    return f"{PREFIX} {day}"


def week_status(store: dict[str, Any], user_id: str, today: str):
    monday, sunday, dates, index_today = week_of(today)
    years = {int(item[:4]) for item in dates}
    adjustments = [
        row for row in store["ranking_ajustes"]
        if isinstance(row, dict)
        and str(row.get("usuario_id")) == user_id
        and int(row.get("ano") or 0) in years
        and int(row.get("pontos") or 0) == POINTS_PER_DAY
        and str(row.get("motivo") or "").startswith(f"{PREFIX} ")
    ]
    received = {str(row.get("motivo"))[len(PREFIX) + 1:len(PREFIX) + 11] for row in adjustments}
    days = [{"numero": index + 1, "data": value, "recebido": value in received, "hoje": value == today} for index, value in enumerate(dates)]
    completed = sum(item["recebido"] for item in days)
    return {
        "titulo": PREFIX,
        "pontosPorDia": POINTS_PER_DAY,
        "maximoSemanal": POINTS_PER_DAY * WEEK_DAYS,
        "semanaInicio": monday,
        "semanaFim": sunday,
        "diaAtual": index_today + 1,
        "dias": days,
        "diasConcluidos": completed,
        "pontosSemana": completed * POINTS_PER_DAY,
        "recebidoHoje": today in received,
        "concluida": completed == WEEK_DAYS,
    }


@router.get("/api/constancia-luz")
async def get_constancy(request: Request):
    user = require_user(request)
    today = cuiaba_date_iso()
    return response({"ok": True, "constancia": week_status(read_main(), str(user["id"]), today)})


@router.post("/api/constancia-luz")
async def post_constancy(request: Request):
    user = require_user(request)
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    today = cuiaba_date_iso()
    requested = str(body.get("data") or today)
    if not valid_date_iso(requested) or requested > today or requested < shift(today, -MAX_OFFLINE_DAYS):
        return response({"erro": "Data da presença diária inválida ou fora da janela de sincronização."}, 400)
    year = int(requested[:4])
    store = read_main()
    expected_reason = reason(requested)
    existing = next(
        (
            row for row in store["ranking_ajustes"]
            if isinstance(row, dict)
            and str(row.get("usuario_id")) == str(user["id"])
            and int(row.get("ano") or 0) == year
            and int(row.get("pontos") or 0) == POINTS_PER_DAY
            and row.get("motivo") == expected_reason
        ),
        None,
    )
    if existing:
        return response({"ok": True, "jaContabilizado": True, "pontosAdicionados": 0, "data": requested, "constancia": week_status(store, str(user["id"]), today)})
    before = ranking_snapshot(year, store)
    def save(data: dict[str, Any]):
        duplicate = next((row for row in data["ranking_ajustes"] if isinstance(row, dict) and str(row.get("usuario_id")) == str(user["id"]) and int(row.get("ano") or 0) == year and int(row.get("pontos") or 0) == POINTS_PER_DAY and row.get("motivo") == expected_reason), None)
        if duplicate:
            return duplicate, True
        row = {"id": f"ajuste-{now_ms()}", "usuario_id": user["id"], "pontos": POINTS_PER_DAY, "motivo": expected_reason, "ano": year, "criado_por": user["id"], "criado_em": now_ms()}
        data["ranking_ajustes"].append(row)
        return row, False
    adjustment, duplicate = mutate_main(save)
    if duplicate:
        return response({"ok": True, "jaContabilizado": True, "pontosAdicionados": 0, "data": requested, "constancia": week_status(read_main(), str(user["id"]), today)})
    notify_ranking_changes(year, before, str(user["id"]), f"constancia-luz:{requested}")
    return response({"ok": True, "jaContabilizado": False, "pontosAdicionados": POINTS_PER_DAY, "data": requested, "ajusteId": adjustment["id"], "constancia": week_status(read_main(), str(user["id"]), today)})
