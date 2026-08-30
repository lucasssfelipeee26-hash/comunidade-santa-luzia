from __future__ import annotations

import hashlib
import json
import re
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..security import current_user, require_moderator, require_user
from ..store import approved_team, find_user, list_scales, mutate_main, now_ms, read_main, save_notification
from ..utils import rate_allowed, request_ip, valid_date_iso, valid_time_24h

router = APIRouter(tags=["scales"])
SCALE_FUNCTIONS = {
    "1º Cerimoniário", "2º Cerimoniário", "Cruciferário", "1º Ceroferário", "2º Ceroferário",
    "1º Mestre de Procissão", "2º Mestre de Procissão", "Turiferário", "Naviculário", "Librífero",
    "Auxiliar de Credência",
}


def response(body: dict[str, Any], status: int = 200, headers: dict[str, str] | None = None):
    return JSONResponse(body, status_code=status, headers=headers)


def _official_app(request: Request) -> tuple[bool, bool]:
    agent = request.headers.get("user-agent", "")
    windows = "SantaLuziaWindowsBeta/" in agent or request.headers.get("x-santa-luzia-windows-beta") == "1"
    native = "SantaLuziaNative/" in agent or request.headers.get("x-santa-luzia-native") == "1"
    return windows, native


def _priest(value: str) -> str:
    name = re.sub(r"\s+", " ", value.strip())
    if re.match(r"^(padre|pe\.?|frei|dom)\s", name, re.I):
        return re.sub(r"^pe\.?\s+", "Padre ", name, flags=re.I)
    return f"Padre {name}"


def _public_scale(scale: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in scale.items() if k not in {"client_request_id", "client_request_fingerprint", "criado_por"}}


def _justification(store: dict[str, Any], scale_id: str, user_id: str):
    return next((row for row in store["escala_justificativas"] if str(row.get("escala_id")) == scale_id and str(row.get("usuario_id")) == user_id), None)


def _people_from_body(store: dict[str, Any], raw_people: Any, *, strict_update: bool = False):
    people = []
    ids: set[str] = set()
    functions: set[str] = set()
    for item in raw_people if isinstance(raw_people, list) else []:
        if not isinstance(item, dict):
            continue
        user_id = str(item.get("id") or "").strip()
        if not user_id or user_id in ids:
            continue
        user = find_user(user_id, store)
        if not user or user.get("status") != "aprovado" or user.get("funcao") not in {"Acólito", "Coroinha"}:
            continue
        category = "acolito" if user.get("funcao") == "Acólito" else "coroinha"
        function = str(item.get("funcao") or "").strip()
        category_matches = str(item.get("categoria") or "") == category
        function_valid = function in SCALE_FUNCTIONS
        if strict_update and (not category_matches or not function_valid):
            return None, f"Dados inválidos na escala de {user.get('nome')}."
        if not category_matches:
            return None, f"{user.get('nome')} está cadastrado como {str(user.get('funcao')).lower()} e só pode ser incluído em {'Acólitos' if category == 'acolito' else 'Coroinhas'}."
        if not function_valid:
            continue
        if function in functions:
            suffix = "foi repetida" if strict_update else "foi atribuída a mais de uma pessoa"
            return None, f"A função {function} {suffix}."
        ids.add(user_id)
        functions.add(function)
        people.append({"id": user_id, "nome": user.get("nome"), "funcao": function, "categoria": category})
    return people, None


def _payload(request_body: dict[str, Any], windows: bool):
    date_value = str(request_body.get("data") or "").strip()
    time_value = str(request_body.get("horario") or "").strip()
    priest_raw = re.sub(r"\s+", " ", str(request_body.get("celebrante") or "").strip())
    priest = _priest(priest_raw) if priest_raw and windows else priest_raw
    notes = str(request_body.get("observacoes") or "").strip()
    celebration = re.sub(r"\s+", " ", str(request_body.get("celebracaoLiturgica") or "").strip())
    season = re.sub(r"\s+", " ", str(request_body.get("tempoLiturgico") or "").strip())
    color = re.sub(r"\s+", " ", str(request_body.get("corLiturgica") or "").strip())
    cycle = re.sub(r"\s+", " ", str(request_body.get("cicloDominical") or "").strip())
    liturgy_date = str(request_body.get("dataLiturgica") or "").strip()
    return date_value, time_value, priest, notes, celebration, season, color, cycle, liturgy_date


def _validate_payload(values: tuple[str, ...]):
    date_value, time_value, priest, notes, celebration, season, color, cycle, liturgy_date = values
    if not valid_date_iso(date_value): return "Informe uma data válida para a escala."
    if not valid_time_24h(time_value): return "Informe um horário válido entre 00:00 e 23:59."
    if len(priest) < 2 or len(priest) > 120: return "Informe o sacerdote celebrante com até 120 caracteres."
    if len(notes) > 1200: return "As observações devem ter no máximo 1.200 caracteres."
    if any(len(value) > 180 for value in (celebration, season, color, cycle)): return "As informações litúrgicas excedem o tamanho permitido."
    if liturgy_date and not valid_date_iso(liturgy_date): return "A data da celebração litúrgica é inválida."
    return None


@router.get("/api/escalas")
async def get_scales(request: Request):
    user = current_user(request)
    store = read_main()
    windows, _ = _official_app(request)
    items = []
    for raw in list_scales(store):
        scale = _public_scale(raw)
        if windows and scale.get("celebrante"):
            scale["celebrante"] = _priest(str(scale["celebrante"]))
        scale["minha_justificativa"] = _justification(store, str(scale.get("id")), str(user.get("id"))) if user else None
        items.append(scale)
    return response(
        {"ok": True, "escalas": items, "usuarioId": user.get("id") if user else None, "tipoUsuario": user.get("tipo") if user else None},
        headers={"Cache-Control": "no-store, max-age=0"},
    )


@router.post("/api/escalas")
async def create_scale(request: Request):
    moderator = require_moderator(request)
    windows, _ = _official_app(request)
    try: body = await request.json()
    except Exception: body = None
    if not isinstance(body, dict): return response({"ok": False, "erro": "Dados inválidos."}, 400)
    request_id = str(body.get("clientRequestId") or "").strip()
    if request_id and not re.fullmatch(r"[A-Za-z0-9._:-]{8,120}", request_id):
        return response({"ok": False, "erro": "Identificador da publicação inválido."}, 400)
    values = _payload(body, windows)
    error = _validate_payload(values)
    if error: return response({"ok": False, "erro": error}, 400)
    if isinstance(body.get("pessoas"), list) and len(body["pessoas"]) > 80:
        return response({"ok": False, "erro": "A escala possui pessoas demais para uma única celebração."}, 400)
    store = read_main()
    people, people_error = _people_from_body(store, body.get("pessoas"))
    if people_error: return response({"ok": False, "erro": people_error}, 400)
    date_value, time_value, priest, notes, celebration, season, color, cycle, liturgy_date = values
    canonical = {
        "data": date_value, "horario": time_value, "celebrante": priest, "observacoes": notes,
        "celebracaoLiturgica": celebration, "tempoLiturgico": season, "corLiturgica": color,
        "cicloDominical": cycle, "dataLiturgica": liturgy_date,
        "pessoas": sorted([{"id": p.get("id") or "", "categoria": p["categoria"], "funcao": p["funcao"]} for p in people or []], key=lambda p: f"{p['id']}|{p['funcao']}"),
    }
    fingerprint = hashlib.sha256(json.dumps(canonical, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()

    if request_id:
        existing = next((s for s in store["escalas"] if isinstance(s, dict) and str(s.get("criado_por")) == str(moderator["id"]) and str(s.get("client_request_id")) == request_id), None)
        if existing:
            if existing.get("client_request_fingerprint") != fingerprint:
                return response({"ok": False, "erro": "Este identificador de publicação já foi usado com outro conteúdo."}, 409)
            return response({"ok": True, "duplicado": True, "clientRequestId": request_id, "escala": _public_scale(existing)})

    def save(data: dict[str, Any]):
        row = {
            "id": f"escala-{now_ms()}", "data": date_value, "horario": time_value, "celebrante": priest,
            "pessoas": people or [], "observacoes": notes, "celebracao_liturgica": celebration or None,
            "tempo_liturgico": season or None, "cor_liturgica": color or None, "ciclo_dominical": cycle or None,
            "data_liturgica": liturgy_date or None, "criado_em": now_ms(),
        }
        if request_id:
            row.update({"client_request_id": request_id, "client_request_fingerprint": fingerprint, "criado_por": moderator["id"]})
        data["escalas"].append(row)
        return row
    scale = mutate_main(save)

    team = approved_team(read_main())
    scheduled = {str(p.get("id")) for p in people or [] if p.get("id")}
    for member in team:
        user_id = str(member.get("id"))
        if user_id in scheduled:
            person = next(p for p in people or [] if str(p.get("id")) == user_id)
            save_notification(user_id, f"escala-publicada:{scale['id']}", "escala", "Você está na nova escala", f"{date_value[8:10]}/{date_value[5:7]}/{date_value[:4]} às {time_value} · sua função: {person['funcao']}.", "/escala")
        else:
            save_notification(user_id, f"escala-publicada:{scale['id']}", "escala", "Nova escala publicada", f"Nova escala para {date_value[8:10]}/{date_value[5:7]}/{date_value[:4]} às {time_value}. Confira a equipe e as funções.", "/escala")
    return response({"ok": True, "clientRequestId": request_id or None, "escala": _public_scale(scale)})


@router.patch("/api/escalas/{scale_id}")
async def update_scale(scale_id: str, request: Request):
    require_moderator(request)
    store = read_main()
    if not scale_id or len(scale_id) > 160 or not any(str(s.get("id")) == scale_id for s in store["escalas"] if isinstance(s, dict)):
        return response({"ok": False, "erro": "Escala não encontrada."}, 404)
    try: body = await request.json()
    except Exception: body = None
    if not isinstance(body, dict): return response({"ok": False, "erro": "Dados inválidos."}, 400)
    values = _payload(body, True)
    date_value, time_value, priest, notes, celebration, season, color, cycle, liturgy_date = values
    if not valid_date_iso(date_value) or not valid_time_24h(time_value): return response({"ok": False, "erro": "Data ou horário inválido."}, 400)
    if len(priest) < 8 or len(priest) > 120: return response({"ok": False, "erro": "Informe o sacerdote celebrante."}, 400)
    if len(notes) > 1200 or any(len(v) > 180 for v in (celebration, season, color, cycle)): return response({"ok": False, "erro": "Há informações maiores que o permitido."}, 400)
    if liturgy_date and not valid_date_iso(liturgy_date): return response({"ok": False, "erro": "Data litúrgica inválida."}, 400)
    people, people_error = _people_from_body(store, body.get("pessoas"), strict_update=True)
    if people_error: return response({"ok": False, "erro": people_error}, 400)
    def update(data: dict[str, Any]):
        row = next((s for s in data["escalas"] if isinstance(s, dict) and str(s.get("id")) == scale_id), None)
        if not row: return None
        row.update({"data": date_value, "horario": time_value, "celebrante": priest, "observacoes": notes, "pessoas": people or [], "celebracao_liturgica": celebration or None, "tempo_liturgico": season or None, "cor_liturgica": color or None, "ciclo_dominical": cycle or None, "data_liturgica": liturgy_date or None})
        return dict(row)
    return response({"ok": True, "escala": mutate_main(update)})


@router.delete("/api/escalas/{scale_id}")
async def delete_scale(scale_id: str, request: Request):
    require_moderator(request)
    if not scale_id or len(scale_id) > 160: return response({"ok": False, "erro": "Escala inválida."}, 400)
    def delete(data: dict[str, Any]):
        before = len(data["escalas"])
        data["escalas"] = [s for s in data["escalas"] if str(s.get("id")) != scale_id]
        data["escala_justificativas"] = [j for j in data["escala_justificativas"] if str(j.get("escala_id")) != scale_id]
        return before != len(data["escalas"])
    if not mutate_main(delete): return response({"ok": False, "erro": "Escala não encontrada."}, 404)
    return response({"ok": True})


@router.put("/api/escalas/{scale_id}/minha-justificativa")
async def justify_scale(scale_id: str, request: Request):
    windows, native = _official_app(request)
    if not windows and not native: return response({"erro": "Recurso disponível somente nos aplicativos oficiais Santa Luzia."}, 403)
    user = require_user(request)
    ip = request_ip(request.headers, request.client.host if request.client else None)
    if not rate_allowed(f"escala:justificativa:{user['id']}:{ip}", 12, 60 * 60): return response({"erro": "Aguarde antes de tentar novamente."}, 429)
    store = read_main()
    scale = next((s for s in store["escalas"] if isinstance(s, dict) and str(s.get("id")) == scale_id), None)
    if not scale: return response({"erro": "Escala não encontrada."}, 404)
    if not any(str(p.get("id")) == str(user["id"]) for p in scale.get("pessoas") or [] if isinstance(p, dict)): return response({"erro": "Seu perfil não está incluído nesta escala."}, 403)
    existing = _justification(store, scale_id, str(user["id"]))
    if existing: return response({"erro": "Sua falta já foi justificada e não pode mais ser alterada.", "justificativa": existing}, 409)
    try: body = await request.json()
    except Exception: body = {}
    text = str((body or {}).get("justificativa") or "").strip()
    if not 3 <= len(text) <= 500: return response({"erro": "Informe o motivo da ausência, com até 500 caracteres."}, 400)
    def save(data: dict[str, Any]):
        row = {"id": f"escala-just-{now_ms()}", "escala_id": scale_id, "usuario_id": user["id"], "justificativa": text, "criado_em": now_ms()}
        data["escala_justificativas"].append(row); return row
    row = mutate_main(save)
    for moderator in [m for m in approved_team(read_main()) if m.get("tipo") == "moderador"]:
        save_notification(str(moderator["id"]), f"escala-justificada:{row['id']}", "escala", "Falta justificada na escala", f"{user.get('nome')} justificou a ausência de {str(scale.get('data'))[8:10]}/{str(scale.get('data'))[5:7]}/{str(scale.get('data'))[:4]} às {scale.get('horario')}.", "/area-restrita/moderador/presencas")
    return response({"ok": True, "justificativa": row}, headers={"Cache-Control": "private, no-store, max-age=0"})
