from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..security import require_moderator, require_user
from ..store import approved_team, find_user, mutate_main, now_ms, read_main
from ..utils import rate_allowed, request_ip, valid_date_iso

router = APIRouter(tags=["members"])
VALID_RECORD_TYPES = {"advertencias", "justificativas", "faltas", "observacoes"}


def response(body: dict[str, Any], status: int = 200, headers: dict[str, str] | None = None):
    return JSONResponse(body, status_code=status, headers=headers)


def _offline_rich(request: Request) -> bool:
    agent = request.headers.get("user-agent", "")
    return (
        "SantaLuziaWindowsBeta/" in agent
        or request.headers.get("x-santa-luzia-windows-beta") == "1"
        or "SantaLuziaNative/" in agent
        or request.headers.get("x-santa-luzia-native") == "1"
    )


def _records_by_type(records: list[dict[str, Any]], user_id: str, kind: str):
    items = [
        {"id": row.get("id"), "data": row.get("data"), "descricao": row.get("descricao"), "criadoEm": row.get("criado_em")}
        for row in records
        if isinstance(row, dict) and str(row.get("usuario_id")) == user_id and row.get("tipo") == kind
    ]
    items.sort(key=lambda row: int(row.get("criadoEm") or 0), reverse=True)
    return items


def member_dto(user: dict[str, Any], records: list[dict[str, Any]]):
    user_id = str(user.get("id"))
    return {
        "id": user.get("id"),
        "nome": user.get("nome"),
        "usuario": user.get("usuario"),
        "funcao": user.get("funcao"),
        "email": user.get("email"),
        "desde": user.get("desde"),
        "data_nascimento": user.get("data_nascimento") or None,
        "data_votos": user.get("data_votos") or None,
        "foto": user.get("foto") or None,
        "status": user.get("status"),
        "advertencias": _records_by_type(records, user_id, "advertencias"),
        "justificativas": _records_by_type(records, user_id, "justificativas"),
        "faltas": _records_by_type(records, user_id, "faltas"),
        "observacoes": _records_by_type(records, user_id, "observacoes"),
    }


@router.get("/api/membros")
async def list_members(request: Request):
    require_moderator(request)
    store = read_main()
    members = [user for user in store["usuarios"] if isinstance(user, dict) and user.get("tipo") == "membro"]
    members.sort(key=lambda user: int(user.get("criado_em") or 0), reverse=True)
    return response({"membros": [member_dto(user, store["registros"]) for user in members]})


@router.get("/api/equipe")
async def team(request: Request):
    require_moderator(request)
    store = read_main()
    return response(
        {"equipe": [member_dto(user, store["registros"]) for user in approved_team(store)]},
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@router.get("/api/membros/{user_id}")
async def get_member(user_id: str, request: Request):
    viewer = require_user(request)
    if viewer.get("tipo") != "moderador" and str(viewer.get("id")) != user_id:
        return response({"erro": "Não autorizado."}, 403)
    store = read_main()
    user = find_user(user_id, store)
    if not user or user.get("tipo") != "membro":
        return response({"erro": "Perfil não encontrado."}, 404)
    records = store["registros"] if viewer.get("tipo") == "moderador" or _offline_rich(request) else []
    return response({"membro": member_dto(user, records)}, headers={"Cache-Control": "no-store"})


@router.patch("/api/membros/{user_id}/status")
async def update_member_status(user_id: str, request: Request):
    require_moderator(request)
    try:
        body = await request.json()
    except Exception:
        return response({"erro": "Requisição inválida."}, 400)
    status_value = str((body or {}).get("status") or "")
    if status_value not in {"aprovado", "recusado"}:
        return response({"erro": "Status inválido."}, 400)
    def update(store: dict[str, Any]):
        user = find_user(user_id, store)
        if not user or user.get("tipo") != "membro":
            return False
        user["status"] = status_value
        return True
    if not mutate_main(update):
        return response({"erro": "Perfil não encontrado."}, 404)
    return response({"ok": True})


@router.patch("/api/membros/{user_id}/promover")
async def promote_member(user_id: str, request: Request):
    promoter = require_moderator(request)
    if not user_id or len(user_id) > 160:
        return response({"ok": False, "erro": "Cadastro inválido."}, 400)
    if user_id == str(promoter["id"]):
        return response({"ok": False, "erro": "Sua conta já possui acesso de moderador."}, 409)
    store = read_main()
    target = find_user(user_id, store)
    if not target:
        return response({"ok": False, "erro": "Cadastro não encontrado."}, 404)
    if target.get("tipo") == "moderador":
        return response({"ok": False, "erro": "Este cadastro já é moderador."}, 409)
    if target.get("status") != "aprovado" or target.get("funcao") not in {"Acólito", "Coroinha"}:
        return response({"ok": False, "erro": "Apenas um acólito ou coroinha aprovado pode ser promovido a moderador."}, 409)
    def promote(data: dict[str, Any]):
        user = find_user(user_id, data)
        if not user or user.get("tipo") == "moderador":
            return None
        user["tipo"] = "moderador"
        user["status"] = "aprovado"
        user["promovido_por"] = promoter["id"]
        user["promovido_em"] = now_ms()
        return dict(user)
    promoted = mutate_main(promote)
    if not promoted:
        return response({"ok": False, "erro": "Não foi possível promover este cadastro."}, 409)
    return response({
        "ok": True,
        "mensagem": f"{promoted.get('nome')} agora é moderador. O novo nível de acesso passa a valer automaticamente nas próximas requisições.",
        "moderador": {"id": promoted.get("id"), "nome": promoted.get("nome"), "usuario": promoted.get("usuario"), "email": promoted.get("email")},
    })


@router.post("/api/membros/{user_id}/registros")
async def create_record(user_id: str, request: Request):
    actor = require_user(request)
    if not user_id or len(user_id) > 160:
        return response({"erro": "Perfil inválido."}, 400)
    ip = request_ip(request.headers, request.client.host if request.client else None)
    limit = 80 if actor.get("tipo") == "moderador" else 12
    if not rate_allowed(f"registro:{actor['id']}:{ip}", limit, 60 * 60):
        return response({"erro": "Muitos registros enviados em pouco tempo. Aguarde antes de tentar novamente."}, 429)
    try:
        body = await request.json()
    except Exception:
        body = None
    if not isinstance(body, dict):
        return response({"erro": "Requisição inválida."}, 400)
    kind = str(body.get("tipo") or "")
    date_value = str(body.get("data") or "").strip()
    description = str(body.get("descricao") or "").strip()
    if kind not in VALID_RECORD_TYPES or not valid_date_iso(date_value) or not 3 <= len(description) <= 2000:
        return response({"erro": "Informe tipo, data e descrição válidos. A descrição pode ter até 2.000 caracteres."}, 400)
    allowed_member = kind == "justificativas" and actor.get("tipo") == "membro" and str(actor.get("id")) == user_id
    if actor.get("tipo") != "moderador" and not allowed_member:
        return response({"erro": "Não autorizado."}, 403)
    store = read_main()
    member = find_user(user_id, store)
    if not member or member.get("tipo") != "membro":
        return response({"erro": "Perfil não encontrado."}, 404)
    def save(data: dict[str, Any]):
        row = {"id": str(uuid.uuid4()), "usuario_id": user_id, "tipo": kind, "data": date_value, "descricao": description, "criado_em": now_ms()}
        data["registros"].append(row)
        return row
    mutate_main(save)
    return response({"ok": True})


@router.delete("/api/membros/{user_id}/registros/{record_id}")
async def delete_record(user_id: str, record_id: str, request: Request):
    require_moderator(request)
    def delete(store: dict[str, Any]):
        store["registros"] = [row for row in store["registros"] if not (str(row.get("id")) == record_id and str(row.get("usuario_id")) == user_id)]
    mutate_main(delete)
    return response({"ok": True})
