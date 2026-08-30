from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..liturgy_service import local_liturgy
from ..security import require_user
from ..store import (
    list_notifications,
    list_scales,
    mark_all_notifications_read,
    mark_notification_read,
    ranking_config,
    read_main,
    save_notification,
)
from ..utils import cuiaba_date_iso

router = APIRouter(tags=["notifications"])


def response(body: dict[str, Any], status: int = 200, headers: dict[str, str] | None = None):
    return JSONResponse(body, status_code=status, headers=headers)


def _daily_notices(user_id: str, today: str) -> None:
    if local_liturgy(today):
        save_notification(
            user_id,
            f"quiz-hoje:{today}",
            "quiz",
            "Quiz de hoje disponível",
            "Leia a Liturgia de hoje e conclua o Quiz Litúrgico da Jornada.",
            "/area-restrita/ranking?aba=hoje",
        )
    save_notification(
        user_id,
        f"missao-hoje:{today}",
        "missao",
        "Missão do Altar disponível",
        "Avance pelas fases e conquiste até 35 pontos por dia na classificação.",
        "/area-restrita/ranking?aba=missao",
    )
    save_notification(
        user_id,
        f"classificacao-hoje:{today}",
        "ranking",
        "Confira a classificação",
        "Veja sua posição atual e acompanhe quem subiu no ranking da Jornada Litúrgica.",
        "/area-restrita/ranking?aba=classificacao",
    )


@router.get("/api/notificacoes")
async def get_notifications(request: Request):
    user = require_user(request)
    today = cuiaba_date_iso()
    _daily_notices(str(user["id"]), today)
    store = read_main()
    scales = [
        scale
        for scale in list_scales(store)
        if str(scale.get("data") or "") >= today
        and any(
            isinstance(person, dict)
            and (str(person.get("id")) == str(user["id"]) or str(person.get("nome")) == str(user.get("nome")))
            for person in scale.get("pessoas") or []
        )
    ][:20]
    pending_quizzes = sum(
        1
        for quiz in store["quizzes"]
        if isinstance(quiz, dict)
        and quiz.get("ativo")
        and (not quiz.get("data_referencia") or str(quiz.get("data_referencia")) >= today)
    )
    notifications = list_notifications(str(user["id"]))
    windows_beta = "SantaLuziaWindowsBeta/" in request.headers.get("user-agent", "") or request.headers.get("x-santa-luzia-windows-beta") == "1"
    if windows_beta:
        from ..store import now_ms
        current = now_ms()
        notifications = [item for item in notifications if current - int(item.get("criado_em") or 0) < 6 * 60 * 1000]
    config = ranking_config(int(today[:4]), store)
    return response(
        {
            "autenticado": True,
            "usuario": {"id": user.get("id"), "nome": user.get("nome"), "tipo": user.get("tipo")},
            "minutosAntecedencia": config["minutos_antecedencia"],
            "escalas": scales,
            "quizzesPendentes": pending_quizzes,
            "notificacoes": notifications,
            "naoLidas": sum(not item.get("lida_em") for item in notifications),
        },
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@router.post("/api/notificacoes")
async def update_notifications(request: Request):
    user = require_user(request)
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    if str(body.get("action") or "lida") == "todas":
        return response({"ok": True, "alteradas": mark_all_notifications_read(str(user["id"]))})
    notification_id = str(body.get("id") or "")
    if not notification_id or not mark_notification_read(str(user["id"]), notification_id):
        return response({"erro": "Notificação não encontrada."}, 404)
    return response({"ok": True})
