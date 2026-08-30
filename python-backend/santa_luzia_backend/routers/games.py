from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..ranking_notifications import notify_ranking_changes, ranking_snapshot
from ..security import require_user
from ..store import mutate_main, now_ms, read_main
from ..utils import clean_text, cuiaba_date_iso, rate_allowed, request_ip

router = APIRouter(tags=["games"])
JEWELS_DAILY_LIMIT = 35
JEWELS_MAX_REWARD_PHASE = 10
WHATAJONG_DAILY_LIMIT = 30
WHATAJONG_TOTAL_ROUNDS = 24
WHATAJONG_MAX_REWARD_ROUND = 15


def response(body: dict[str, Any], status: int = 200):
    return JSONResponse(body, status_code=status)


def _ip(request: Request) -> str:
    return request_ip(request.headers, request.client.host if request.client else None)


def _year_today() -> tuple[str, int]:
    today = cuiaba_date_iso()
    return today, int(today[:4])


def _adjustments(store: dict[str, Any], user_id: str, year: int, prefixes: tuple[str, ...]):
    return [
        row for row in store["ranking_ajustes"]
        if isinstance(row, dict) and str(row.get("usuario_id")) == user_id and int(row.get("ano") or 0) == year
        and any(str(row.get("motivo") or "").startswith(prefix) for prefix in prefixes)
    ]


def _save_adjustment(user_id: str, points: int, reason: str, year: int):
    def save(store: dict[str, Any]):
        row = {"id": f"ajuste-{now_ms()}", "usuario_id": user_id, "pontos": points, "motivo": reason, "ano": year, "criado_por": user_id, "criado_em": now_ms()}
        store["ranking_ajustes"].append(row)
        return row
    return mutate_main(save)


def jewels_points(phase: int) -> int:
    phase = max(0, int(phase))
    base = [0, 3, 7, 12, 18, 25]
    if phase <= 5:
        return base[phase]
    return min(JEWELS_DAILY_LIMIT, 25 + (phase - 5) * 2)


def jewels_min_score(phase: int) -> int:
    return sum(780 + max(0, level - 1) * 260 for level in range(1, max(0, int(phase)) + 1))


def jewels_state(store: dict[str, Any], user_id: str):
    today, year = _year_today()
    prefixes = (f"Missão do Altar {today}", f"Caminho da Luz {today}")
    adjustments = _adjustments(store, user_id, year, prefixes)
    points = sum(int(row.get("pontos") or 0) for row in adjustments)
    phase = 0
    for current in range(1, JEWELS_MAX_REWARD_PHASE + 1):
        if jewels_points(current) <= points:
            phase = current
        else:
            break
    for row in adjustments:
        match = re.search(r"fase concluída\s+(\d+)", str(row.get("motivo") or ""), re.I)
        if match:
            phase = max(phase, int(match.group(1)))
    return today, year, points, min(JEWELS_MAX_REWARD_PHASE, phase)


@router.get("/api/jogo/caminho-da-luz/resultado")
async def jewels_get(request: Request):
    user = require_user(request)
    _, _, points, phase = jewels_state(read_main(), str(user["id"]))
    return response({"ok": True, "pontosTotalDia": points, "faseServidor": phase, "limiteDiario": JEWELS_DAILY_LIMIT})


@router.post("/api/jogo/caminho-da-luz/resultado")
async def jewels_post(request: Request):
    user = require_user(request)
    if not rate_allowed(f"jogo:joias:{user['id']}:{_ip(request)}", 80, 15 * 60):
        return response({"erro": "Muitos resultados enviados em pouco tempo. Aguarde alguns minutos e tente novamente."}, 429)
    try: body = await request.json()
    except Exception: body = {}
    if not isinstance(body, dict): body = {}
    try:
        score = int(float(body.get("score") or 0))
        level = int(float(body.get("level") or 1))
        phase = int(float(body.get("completedPhase"))) if body.get("completedPhase") is not None else max(0, level - 1)
    except (TypeError, ValueError, OverflowError):
        return response({"erro": "Resultado inválido."}, 400)
    mode = clean_text(body.get("mode") or "Joias da Luz", 80) or "Joias da Luz"
    if score < 0 or score > 1_000_000 or level < 1 or level > 999 or phase < 0 or phase > 999 or level != phase + 1:
        return response({"erro": "Resultado inválido."}, 400)
    store = read_main()
    today, year, current_points, server_phase = jewels_state(store, str(user["id"]))
    calculated = jewels_points(phase)
    if calculated <= current_points or phase <= server_phase or server_phase >= JEWELS_MAX_REWARD_PHASE:
        return response({"ok": True, "jaContabilizado": True, "melhorado": False, "pontosRanking": current_points, "pontosAdicionados": 0, "pontosTotalDia": current_points, "faseConcluida": phase, "faseServidor": server_phase, "limiteDiario": JEWELS_DAILY_LIMIT})
    expected = server_phase + 1
    if phase != expected:
        return response({"erro": "A progressão recebida está fora de sequência. Sincronize as fases pendentes na ordem em que foram concluídas.", "faseEsperada": expected, "faseServidor": server_phase, "pontosTotalDia": current_points, "limiteDiario": JEWELS_DAILY_LIMIT}, 409)
    if score < jewels_min_score(phase):
        return response({"erro": "A pontuação informada não é compatível com a fase concluída.", "faseEsperada": expected, "faseServidor": server_phase, "pontosTotalDia": current_points, "limiteDiario": JEWELS_DAILY_LIMIT}, 409)
    before = ranking_snapshot(year, store)
    added = calculated - current_points
    adjustment = _save_adjustment(str(user["id"]), added, f"Missão do Altar {today} · {mode} · fase concluída {phase} · score {score} · total diário {calculated}", year)
    notify_ranking_changes(year, before, str(user["id"]), f"missao:{today}:{phase}")
    return response({"ok": True, "jaContabilizado": False, "melhorado": current_points > 0, "pontosRanking": added, "pontosAdicionados": added, "pontosTotalDia": calculated, "faseConcluida": phase, "faseServidor": phase, "limiteDiario": JEWELS_DAILY_LIMIT, "ajusteId": adjustment["id"]})


def whatajong_points(round_number: int) -> int:
    value = max(0, min(WHATAJONG_MAX_REWARD_ROUND, int(round_number)))
    return min(WHATAJONG_DAILY_LIMIT, value * 2)


def whatajong_state(store: dict[str, Any], user_id: str):
    today, year = _year_today()
    prefix = f"Whatajong {today}"
    adjustments = _adjustments(store, user_id, year, (prefix,))
    points = sum(int(row.get("pontos") or 0) for row in adjustments)
    maximum = 0
    for row in adjustments:
        match = re.search(r"rodada concluída\s+(\d+)", str(row.get("motivo") or ""), re.I)
        if match:
            maximum = max(maximum, int(match.group(1)))
    return today, year, points, min(WHATAJONG_TOTAL_ROUNDS, maximum)


@router.get("/api/jogo/whatajong/resultado")
async def whatajong_get(request: Request):
    user = require_user(request)
    _, _, points, round_number = whatajong_state(read_main(), str(user["id"]))
    return response({"ok": True, "pontosTotalDia": points, "rodadaServidor": round_number, "limiteDiario": WHATAJONG_DAILY_LIMIT, "totalRodadas": WHATAJONG_TOTAL_ROUNDS})


@router.post("/api/jogo/whatajong/resultado")
async def whatajong_post(request: Request):
    user = require_user(request)
    if not rate_allowed(f"jogo:whatajong:{user['id']}:{_ip(request)}", 80, 15 * 60):
        return response({"erro": "Muitos resultados enviados em pouco tempo. Aguarde alguns minutos e tente novamente."}, 429)
    try: body = await request.json()
    except Exception: body = {}
    if not isinstance(body, dict): body = {}
    try:
        score = int(float(body.get("score") or 0))
        completed = int(float(body.get("completedRound") or 0))
    except (TypeError, ValueError, OverflowError):
        return response({"erro": "Resultado inválido."}, 400)
    difficulty_raw = str(body.get("difficulty") or "facil")
    difficulty = difficulty_raw if difficulty_raw in {"medio", "dificil"} else "facil"
    if score < 0 or score > 50_000_000 or completed < 1 or completed > WHATAJONG_TOTAL_ROUNDS:
        return response({"erro": "Resultado inválido."}, 400)
    store = read_main()
    today, year, current_points, server_round = whatajong_state(store, str(user["id"]))
    calculated = whatajong_points(completed)
    if completed <= server_round or calculated <= current_points:
        return response({"ok": True, "jaContabilizado": True, "melhorado": False, "pontosRanking": current_points, "pontosAdicionados": 0, "pontosTotalDia": current_points, "rodadaConcluida": completed, "rodadaServidor": max(server_round, completed), "limiteDiario": WHATAJONG_DAILY_LIMIT})
    before = ranking_snapshot(year, store)
    added = max(0, calculated - current_points)
    if added > 0:
        _save_adjustment(str(user["id"]), added, f"Whatajong {today} · {difficulty} · rodada concluída {completed} · score original {score} · total diário {calculated}", year)
        notify_ranking_changes(year, before, str(user["id"]), f"whatajong:{today}:{completed}")
    return response({"ok": True, "jaContabilizado": added == 0, "melhorado": current_points > 0 and added > 0, "pontosRanking": added, "pontosAdicionados": added, "pontosTotalDia": calculated, "rodadaConcluida": completed, "rodadaServidor": completed, "limiteDiario": WHATAJONG_DAILY_LIMIT})
