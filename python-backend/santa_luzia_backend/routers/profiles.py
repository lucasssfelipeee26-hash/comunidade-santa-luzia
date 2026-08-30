from __future__ import annotations

import re
from datetime import date
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..ranking_service import calculate_ranking
from ..security import clear_session, password_matches, require_user
from ..store import DATA_DIR, approved_team, find_user, mutate_aux, mutate_main, now_ms, read_aux, read_main, safe_user
from ..utils import cuiaba_now, rate_allowed, request_ip

router = APIRouter(tags=["profiles"])
PUBLIC_PROFILES_PATH = DATA_DIR / "perfis-publicos.json"
PHOTO_RE = re.compile(r"^data:image/(?:jpeg|jpg|png|webp);base64,[a-z0-9+/=\r\n]+$", re.I)


def response(body: dict[str, Any], status: int = 200, headers: dict[str, str] | None = None):
    return JSONResponse(body, status_code=status, headers=headers)


def _bio(user_id: str) -> str:
    value = read_aux(PUBLIC_PROFILES_PATH, {})
    if not isinstance(value, dict):
        return ""
    row = value.get(user_id)
    return str(row.get("bio") or "") if isinstance(row, dict) else ""


def _save_bio(user_id: str, bio: str) -> str:
    normalized = str(bio or "").strip()[:280]

    def change(store: Any):
        if not isinstance(store, dict):
            return normalized
        if normalized:
            store[user_id] = {"bio": normalized, "atualizado_em": now_ms()}
        else:
            store.pop(user_id, None)
        return normalized

    return mutate_aux(PUBLIC_PROFILES_PATH, {}, change)


def _civil(value: str) -> bool:
    try:
        parsed = date.fromisoformat(value)
    except ValueError:
        return False
    return 1900 <= parsed.year <= date.today().year and parsed <= date.today()


def _public_profile(user: dict[str, Any], rank: dict[str, Any] | None) -> dict[str, Any]:
    return {
        "id": user.get("id"),
        "nome": user.get("nome"),
        "funcao": user.get("funcao"),
        "desde": user.get("desde"),
        "foto": user.get("foto") or None,
        "bio": _bio(str(user.get("id"))),
        "ranking": (
            {
                "posicao": rank.get("posicao"),
                "pontos": rank.get("pontos"),
                "quizzesRespondidos": rank.get("quizzesRespondidos"),
                "acertos": rank.get("acertos"),
                "aproveitamento": rank.get("aproveitamento"),
            }
            if rank
            else None
        ),
    }


@router.get("/api/perfil")
async def private_profile(request: Request):
    user = require_user(request)
    payload = safe_user(user)
    payload["bio"] = _bio(str(user["id"]))
    return response({"perfil": payload}, headers={"Cache-Control": "no-store"})


@router.patch("/api/perfil")
async def update_private_profile(request: Request):
    user = require_user(request)
    try:
        body = await request.json()
    except Exception:
        return response({"ok": False, "erro": "Dados inválidos."}, 400)
    if not isinstance(body, dict):
        return response({"ok": False, "erro": "Dados inválidos."}, 400)

    name = None if "nome" not in body else re.sub(r"\s+", " ", str(body.get("nome") or "").strip())
    birth = None if "dataNascimento" not in body else str(body.get("dataNascimento") or "").strip()
    votes_raw = None if "dataVotos" not in body else str(body.get("dataVotos") or "").strip()
    photo_present = "foto" in body
    photo = body.get("foto") if photo_present else None
    bio_present = "bio" in body
    bio = str(body.get("bio") or "").strip() if bio_present else ""

    if name is not None and not 2 <= len(name) <= 100:
        return response({"ok": False, "erro": "Informe um nome válido com até 100 caracteres."}, 400)
    if birth and not _civil(birth):
        return response({"ok": False, "erro": "Data de nascimento inválida."}, 400)
    if votes_raw and not _civil(votes_raw):
        return response({"ok": False, "erro": "Data de profissão dos votos inválida."}, 400)
    if photo_present and photo is not None:
        photo = str(photo)
        if not PHOTO_RE.fullmatch(photo):
            return response({"ok": False, "erro": "Formato de foto inválido. Use JPEG, PNG ou WebP."}, 400)
        if len(photo) > 1_400_000:
            return response({"ok": False, "erro": "A foto deve ter no máximo 1 MB."}, 400)
    if bio_present and len(bio) > 280:
        return response({"ok": False, "erro": "O recado deve ter no máximo 280 caracteres."}, 400)

    current_birth = str(user.get("data_nascimento") or "") if birth is None else birth
    current_votes = str(user.get("data_votos") or user.get("desde") or "") if votes_raw is None else votes_raw
    if current_birth and current_votes and current_votes < current_birth:
        return response({"ok": False, "erro": "A data de votos não pode ser anterior à data de nascimento."}, 400)

    def update(store: dict[str, Any]):
        target = find_user(str(user["id"]), store)
        if not target:
            return False
        if name is not None:
            target["nome"] = name
        if birth is not None:
            target["data_nascimento"] = birth or None
        if votes_raw is not None:
            target["data_votos"] = votes_raw or None
            target["desde"] = votes_raw or None
        if photo_present:
            target["foto"] = photo
        return True

    if not mutate_main(update):
        return response({"ok": False, "erro": "Usuário não encontrado."}, 404)
    if bio_present:
        _save_bio(str(user["id"]), bio)
    return response({"ok": True})


@router.get("/api/perfis")
async def profiles(request: Request):
    require_user(request)
    store = read_main()
    ranking = calculate_ranking(cuiaba_now().year, store)["ranking"]
    by_id = {str(row.get("usuarioId")): row for row in ranking}
    items = [_public_profile(user, by_id.get(str(user.get("id")))) for user in approved_team(store)]
    return response({"perfis": items}, headers={"Cache-Control": "private, max-age=30"})


@router.get("/api/perfis/{user_id}")
async def profile_by_id(user_id: str, request: Request):
    require_user(request)
    store = read_main()
    user = find_user(user_id, store)
    if not user or user.get("status") != "aprovado" or user.get("funcao") not in {"Acólito", "Coroinha"}:
        return response({"erro": "Perfil não encontrado."}, 404)
    rank = next((row for row in calculate_ranking(cuiaba_now().year, store)["ranking"] if str(row.get("usuarioId")) == user_id), None)
    return response({"perfil": _public_profile(user, rank)}, headers={"Cache-Control": "private, max-age=30"})


def _delete_account(store: dict[str, Any], user_id: str) -> bool:
    user = find_user(user_id, store)
    if not user:
        return False
    created_quizzes = {str(q.get("id")) for q in store["quizzes"] if isinstance(q, dict) and str(q.get("criado_por")) == user_id}
    occurrence_ids = {
        str(row.get("id"))
        for row in store["pontualidade_ocorrencias"]
        if isinstance(row, dict) and (str(row.get("usuario_id")) == user_id or str(row.get("reportado_por")) == user_id)
    }
    store["usuarios"] = [row for row in store["usuarios"] if str(row.get("id")) != user_id]
    store["registros"] = [row for row in store["registros"] if str(row.get("usuario_id")) != user_id]
    store["codigos_recuperacao"] = [row for row in store["codigos_recuperacao"] if str(row.get("usuario_id")) != user_id]
    for scale in store["escalas"]:
        if isinstance(scale, dict):
            scale["pessoas"] = [
                person for person in scale.get("pessoas") or []
                if isinstance(person, dict) and str(person.get("id")) != user_id and not (person.get("id") is None and person.get("nome") == user.get("nome"))
            ]
    store["escala_justificativas"] = [row for row in store["escala_justificativas"] if str(row.get("usuario_id")) != user_id]
    store["formacao_presencas"] = [row for row in store["formacao_presencas"] if str(row.get("usuario_id")) != user_id]
    store["reconhecimentos"] = [row for row in store["reconhecimentos"] if str(row.get("de_usuario_id")) != user_id and str(row.get("para_usuario_id")) != user_id]
    store["quizzes"] = [row for row in store["quizzes"] if str(row.get("criado_por")) != user_id]
    store["quiz_respostas"] = [row for row in store["quiz_respostas"] if str(row.get("usuario_id")) != user_id and str(row.get("quiz_id")) not in created_quizzes]
    store["pontualidade_ocorrencias"] = [row for row in store["pontualidade_ocorrencias"] if str(row.get("id")) not in occurrence_ids]
    store["pontualidade_reacoes"] = [row for row in store["pontualidade_reacoes"] if str(row.get("usuario_id")) != user_id and str(row.get("ocorrencia_id")) not in occurrence_ids]
    store["ranking_ajustes"] = [row for row in store["ranking_ajustes"] if str(row.get("usuario_id")) != user_id and str(row.get("criado_por")) != user_id]
    return True


@router.post("/api/perfil/excluir")
async def delete_profile(request: Request):
    ip = request_ip(request.headers, request.client.host if request.client else None)
    if not rate_allowed(f"excluir-conta:{ip}", 5, 30 * 60):
        return response({"ok": False, "erro": "Muitas tentativas. Aguarde alguns minutos."}, 429)
    user = require_user(request)
    if user.get("tipo") != "membro":
        return response({"ok": False, "erro": "Contas administrativas devem ser tratadas pela administração da comunidade."}, 403)
    try:
        body = await request.json()
    except Exception:
        body = {}
    if str((body or {}).get("confirmacao") or "").strip().upper() != "EXCLUIR":
        return response({"ok": False, "erro": "Digite EXCLUIR para confirmar."}, 400)
    if not password_matches(str((body or {}).get("senha") or ""), str(user.get("senha_hash") or "")):
        return response({"ok": False, "erro": "Senha incorreta."}, 401)
    if not mutate_main(lambda store: _delete_account(store, str(user["id"]))):
        return response({"ok": False, "erro": "Não foi possível excluir a conta."}, 500)
    response_obj = response({"ok": True})
    clear_session(response_obj)
    return response_obj
