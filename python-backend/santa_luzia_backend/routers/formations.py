from __future__ import annotations

import hashlib
import json
import os
import re
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, JSONResponse
from starlette.datastructures import UploadFile

from ..security import require_moderator, require_user
from ..store import FORMATIONS_DIR, approved_team, find_user, list_scales, mutate_main, now_ms, read_main, save_notification
from ..utils import CUIABA, cuiaba_date_iso, cuiaba_now, rate_allowed, request_ip, valid_date_iso, valid_time_24h

router = APIRouter(tags=["formations"])
MAX_FILE_SIZE = 20 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".ppt", ".pptx", ".doc", ".docx", ".odt", ".odp", ".txt"}


def response(body: dict[str, Any], status: int = 200, headers: dict[str, str] | None = None):
    return JSONResponse(body, status_code=status, headers=headers)


def _windows_beta(request: Request) -> bool:
    return "SantaLuziaWindowsBeta/" in request.headers.get("user-agent", "") or request.headers.get("x-santa-luzia-windows-beta") == "1"


def _public(row: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in row.items() if key not in {"client_request_id", "client_request_fingerprint", "criado_por"}}


def _formations(store: dict[str, Any]) -> list[dict[str, Any]]:
    return sorted(
        [row for row in store["formacoes"] if isinstance(row, dict)],
        key=lambda row: f"{row.get('data','')} {row.get('horario') or ''}",
        reverse=True,
    )


def _find_formation(store: dict[str, Any], formation_id: str) -> dict[str, Any] | None:
    return next((row for row in store["formacoes"] if isinstance(row, dict) and str(row.get("id")) == formation_id), None)


def _formation_presence(store: dict[str, Any], formation_id: str) -> list[dict[str, Any]]:
    return sorted(
        [row for row in store["formacao_presencas"] if isinstance(row, dict) and str(row.get("formacao_id")) == formation_id],
        key=lambda row: str(row.get("usuario_id") or ""),
    )


def _user_presence_history(store: dict[str, Any], user_id: str) -> list[dict[str, Any]]:
    return sorted(
        [row for row in store["formacao_presencas"] if isinstance(row, dict) and str(row.get("usuario_id")) == user_id],
        key=lambda row: int(row.get("atualizado_em") or 0),
        reverse=True,
    )


def _sanitize_filename(name: str) -> str:
    import unicodedata
    normalized = unicodedata.normalize("NFD", name)
    normalized = "".join(ch for ch in normalized if unicodedata.category(ch) != "Mn")
    normalized = re.sub(r"[^a-zA-Z0-9._-]", "-", normalized)
    normalized = re.sub(r"-+", "-", normalized)
    return normalized[-180:] or "arquivo"


def _save_presence_rows(store: dict[str, Any], formation_id: str, records: list[dict[str, Any]], registrar_id: str):
    current = now_ms()
    ids = {str(item["usuario_id"]) for item in records}
    existing = {
        str(row.get("usuario_id")): row
        for row in store["formacao_presencas"]
        if isinstance(row, dict) and str(row.get("formacao_id")) == formation_id and str(row.get("usuario_id")) in ids
    }
    store["formacao_presencas"] = [
        row for row in store["formacao_presencas"]
        if not (isinstance(row, dict) and str(row.get("formacao_id")) == formation_id and str(row.get("usuario_id")) in ids)
    ]
    for record in records:
        if record.get("status") is None:
            continue
        previous = existing.get(str(record["usuario_id"]))
        store["formacao_presencas"].append(
            {
                "id": previous.get("id") if previous else f"presenca-{current}-{os.urandom(3).hex()}",
                "formacao_id": formation_id,
                "usuario_id": record["usuario_id"],
                "status": record["status"],
                "justificativa": record.get("justificativa") if record["status"] == "justificada" else None,
                "registrado_por": registrar_id,
                "criado_em": previous.get("criado_em") if previous else current,
                "atualizado_em": current,
            }
        )


def _fingerprint(values: dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(values, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()


@router.get("/api/formacoes")
async def get_formations(request: Request):
    user = require_user(request)
    store = read_main()
    if _windows_beta(request) and user.get("tipo") == "moderador":
        today = cuiaba_date_iso()
        hour = cuiaba_now().hour
        team_total = len(approved_team(store))
        updates: list[tuple[str, bool]] = []
        for formation in _formations(store):
            if formation.get("status") != "agendada":
                continue
            entries = _formation_presence(store, str(formation.get("id")))
            complete = team_total > 0 and len(entries) >= team_total
            deadline = str(formation.get("data") or "") < today or (str(formation.get("data") or "") == today and hour >= 22)
            if not complete and deadline:
                save_notification(str(user["id"]), f"formacao-pendente:{formation['id']}", "sistema", "Formação encerrada com registros pendentes", f"{formation.get('titulo')}: confira quem ficou sem presença, falta ou justificativa.", "/area-restrita/moderador/formacao")
            if complete or deadline:
                updates.append((str(formation["id"]), True))
        if updates:
            def finish(data: dict[str, Any]):
                wanted = {formation_id for formation_id, _ in updates}
                for row in data["formacoes"]:
                    if isinstance(row, dict) and str(row.get("id")) in wanted:
                        row["status"] = "concluida"
                        row["atualizado_em"] = now_ms()
            mutate_main(finish)
            store = read_main()

    history = {str(row.get("formacao_id")): row for row in _user_presence_history(store, str(user["id"]))}
    items = []
    for internal in _formations(store):
        formation = _public(internal)
        presence = history.get(str(formation.get("id")))
        formation["minha_presenca"] = (
            {"status": presence.get("status"), "justificativa": presence.get("justificativa"), "atualizado_em": presence.get("atualizado_em")}
            if presence else None
        )
        items.append(formation)
    return response({"formacoes": items, "usuarioId": user.get("id"), "tipoUsuario": user.get("tipo")}, headers={"Cache-Control": "no-store, max-age=0"})


async def _parse_creation(request: Request):
    content_type = request.headers.get("content-type", "").lower()
    file: UploadFile | None = None
    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            return None
        if not isinstance(body, dict):
            return None
        getter = body.get
    else:
        try:
            form = await request.form()
        except Exception:
            return None
        getter = form.get
        candidate = form.get("arquivo")
        if isinstance(candidate, UploadFile) and candidate.filename:
            file = candidate
    values = {
        "titulo": re.sub(r"\s+", " ", str(getter("titulo") or "").strip()),
        "tema": re.sub(r"\s+", " ", str(getter("tema") or "").strip()),
        "data": str(getter("data") or "").strip(),
        "horario": str(getter("horario") or "").strip(),
        "descricao": str(getter("descricao") or "").strip(),
        "status": "cancelada" if str(getter("status") or "agendada") == "cancelada" else "agendada",
        "motivo": str(getter("motivo_cancelamento") or "").strip(),
        "client_request_id": str(getter("clientRequestId") or "").strip(),
    }
    return values, file


@router.post("/api/formacoes")
async def create_formation(request: Request):
    moderator = require_moderator(request)
    parsed = await _parse_creation(request)
    if not parsed:
        return response({"erro": "Não foi possível ler os dados da formação."}, 400)
    values, file = parsed
    request_id = values["client_request_id"]
    if request_id and not re.fullmatch(r"[A-Za-z0-9._:-]{8,120}", request_id):
        return response({"erro": "Identificador da publicação inválido."}, 400)
    if not 3 <= len(values["titulo"]) <= 180 or not 3 <= len(values["tema"]) <= 180:
        return response({"erro": "Informe título e tema válidos, com até 180 caracteres."}, 400)
    if not valid_date_iso(values["data"]) or (values["horario"] and not valid_time_24h(values["horario"])):
        return response({"erro": "Data ou horário inválido."}, 400)
    if len(values["descricao"]) > 4000:
        return response({"erro": "A descrição deve ter no máximo 4.000 caracteres."}, 400)
    if values["status"] == "cancelada" and not 3 <= len(values["motivo"]) <= 1000:
        return response({"erro": "Informe o motivo do cancelamento, com até 1.000 caracteres."}, 400)

    file_bytes: bytes | None = None
    original = mime = digest = ""
    size = 0
    if file:
        original = str(file.filename or "").strip()[:240]
        extension = Path(original).suffix.lower()
        if extension not in ALLOWED_EXTENSIONS:
            return response({"erro": "Tipo de arquivo não permitido. Use PDF, PowerPoint, Word, ODT/ODP ou TXT."}, 400)
        file_bytes = await file.read(MAX_FILE_SIZE + 1)
        size = len(file_bytes)
        if size > MAX_FILE_SIZE:
            return response({"erro": "O arquivo deve ter no máximo 20 MB."}, 400)
        mime = str(file.content_type or "application/octet-stream")
        digest = hashlib.sha256(file_bytes).hexdigest()

    fingerprint = _fingerprint({
        "titulo": values["titulo"], "tema": values["tema"], "data": values["data"], "horario": values["horario"],
        "descricao": values["descricao"], "status": values["status"], "motivo": values["motivo"] if values["status"] == "cancelada" else "",
        "arquivoNome": original, "arquivoMime": mime, "arquivoTamanho": size, "arquivoHash": digest,
    })
    store = read_main()
    if request_id:
        existing = next((row for row in store["formacoes"] if isinstance(row, dict) and str(row.get("criado_por")) == str(moderator["id"]) and str(row.get("client_request_id")) == request_id), None)
        if existing:
            if existing.get("client_request_fingerprint") != fingerprint:
                return response({"erro": "Este identificador de publicação já foi usado com outro conteúdo."}, 409)
            return response({"formacao": _public(existing), "duplicado": True, "clientRequestId": request_id})

    attachment = None
    stored_path: Path | None = None
    if file_bytes is not None:
        FORMATIONS_DIR.mkdir(parents=True, exist_ok=True)
        token = hashlib.sha256(f"{moderator['id']}:{request_id}".encode()).hexdigest()[:20] if request_id else f"{now_ms()}-{os.urandom(3).hex()}"
        stored_name = f"{token}-{_sanitize_filename(original)}"
        stored_path = FORMATIONS_DIR / stored_name
        stored_path.write_bytes(file_bytes)
        attachment = {"nome_original": original, "nome_armazenado": stored_name, "mime": mime, "tamanho": size}

    try:
        def save(data: dict[str, Any]):
            current = now_ms()
            row = {
                "id": f"formacao-{current}-{os.urandom(3).hex()}", "titulo": values["titulo"], "tema": values["tema"],
                "data": values["data"], "horario": values["horario"] or None, "descricao": values["descricao"],
                "status": values["status"], "motivo_cancelamento": values["motivo"] if values["status"] == "cancelada" else None,
                "arquivo": attachment, "criado_em": current, "atualizado_em": current,
            }
            if request_id:
                row.update({"client_request_id": request_id, "client_request_fingerprint": fingerprint, "criado_por": moderator["id"]})
            data["formacoes"].append(row)
            return row
        row = mutate_main(save)
    except Exception:
        if stored_path and stored_path.exists():
            stored_path.unlink(missing_ok=True)
        raise
    return response({"formacao": _public(row), "clientRequestId": request_id or None}, 201)


@router.patch("/api/formacoes/{formation_id}")
async def update_formation(formation_id: str, request: Request):
    require_moderator(request)
    if not formation_id or len(formation_id) > 160:
        return response({"erro": "Formação inválida."}, 400)
    try:
        body = await request.json()
    except Exception:
        body = None
    if not isinstance(body, dict):
        return response({"erro": "Requisição inválida."}, 400)
    if "status" not in body:
        title = str(body.get("titulo") or "").strip()
        theme = str(body.get("tema") or "").strip()
        date_value = str(body.get("data") or "").strip()
        time_value = str(body.get("horario") or "").strip()
        description = str(body.get("descricao") or "").strip()
        if not 2 <= len(title) <= 180 or not 2 <= len(theme) <= 180 or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", date_value) or (time_value and not re.fullmatch(r"\d{2}:\d{2}", time_value)):
            return response({"erro": "Informe título, tema, data e horário válidos."}, 400)
        if len(description) > 4000:
            return response({"erro": "A descrição deve ter no máximo 4.000 caracteres."}, 400)
        patch = {"titulo": title, "tema": theme, "data": date_value, "horario": time_value or None, "descricao": description}
    else:
        status_value = str(body.get("status"))
        if status_value not in {"agendada", "concluida", "cancelada"}:
            return response({"erro": "Status da formação inválido."}, 400)
        reason = str(body.get("motivo_cancelamento") or "").strip()
        if status_value == "cancelada" and not 3 <= len(reason) <= 1000:
            return response({"erro": "Informe o motivo do cancelamento, com até 1.000 caracteres."}, 400)
        patch = {"status": status_value, "motivo_cancelamento": reason if status_value == "cancelada" else None}

    def update(data: dict[str, Any]):
        row = _find_formation(data, formation_id)
        if not row:
            return None
        row.update(patch)
        row["atualizado_em"] = now_ms()
        return dict(row)
    row = mutate_main(update)
    if not row:
        return response({"erro": "Formação não encontrada."}, 404)
    return response({"formacao": row}, headers={"Cache-Control": "no-store"})


@router.delete("/api/formacoes/{formation_id}")
async def delete_formation(formation_id: str, request: Request):
    require_moderator(request)
    if not formation_id or len(formation_id) > 160:
        return response({"erro": "Formação inválida."}, 400)
    def delete(data: dict[str, Any]):
        row = _find_formation(data, formation_id)
        if not row:
            return None
        data["formacoes"] = [item for item in data["formacoes"] if str(item.get("id")) != formation_id]
        data["formacao_presencas"] = [item for item in data["formacao_presencas"] if str(item.get("formacao_id")) != formation_id]
        return dict(row)
    row = mutate_main(delete)
    if not row:
        return response({"erro": "Formação não encontrada."}, 404)
    attachment = row.get("arquivo")
    if isinstance(attachment, dict) and attachment.get("nome_armazenado"):
        (FORMATIONS_DIR / Path(str(attachment["nome_armazenado"])).name).unlink(missing_ok=True)
    return response({"ok": True})


@router.get("/api/formacoes/{formation_id}/download")
async def formation_download(formation_id: str, request: Request):
    require_user(request)
    row = _find_formation(read_main(), formation_id)
    attachment = row.get("arquivo") if row else None
    if not isinstance(attachment, dict):
        return response({"erro": "Arquivo não encontrado."}, 404)
    path = FORMATIONS_DIR / Path(str(attachment.get("nome_armazenado") or "")).name
    if not path.exists():
        return response({"erro": "Arquivo indisponível no servidor."}, 404)
    return FileResponse(
        path,
        media_type=str(attachment.get("mime") or "application/octet-stream"),
        filename=str(attachment.get("nome_original") or path.name),
        headers={"Cache-Control": "private, no-store"},
    )


@router.put("/api/formacoes/{formation_id}/minha-presenca")
async def own_presence(formation_id: str, request: Request):
    user = require_user(request)
    if user.get("status") != "aprovado" or user.get("funcao") not in {"Acólito", "Coroinha"}:
        return response({"erro": "Seu cadastro não está liberado para a lista de presença."}, 403)
    ip = request_ip(request.headers, request.client.host if request.client else None)
    if not rate_allowed(f"formacao:minha-presenca:{user['id']}:{ip}", 30, 60 * 60):
        return response({"erro": "Muitas alterações em pouco tempo. Aguarde antes de tentar novamente."}, 429)
    if not formation_id or len(formation_id) > 160:
        return response({"erro": "Formação inválida."}, 400)
    store = read_main()
    formation = _find_formation(store, formation_id)
    if not formation:
        return response({"erro": "Formação não encontrada."}, 404)
    if formation.get("status") == "cancelada":
        return response({"erro": "Não é possível registrar presença em uma formação cancelada."}, 409)
    try: body = await request.json()
    except Exception: body = None
    situation = str((body or {}).get("situacao") or "")
    if situation == "falta":
        return response({"erro": "A falta é registrada somente pela moderação."}, 403)
    previous = next((row for row in _user_presence_history(store, str(user["id"])) if str(row.get("formacao_id")) == formation_id), None)
    if previous:
        return response({"erro": "Sua participação já foi registrada e não pode mais ser alterada.", "presenca": previous}, 409)
    today = cuiaba_date_iso()
    formation_date = str(formation.get("data") or "")
    if formation_date != today:
        if not (formation_date > today and situation == "justificada"):
            message = "A presença só poderá ser marcada no dia da formação." if formation_date > today else "O período para marcar presença nesta formação já terminou."
            return response({"erro": message, "dataFormacao": formation_date, "hoje": today}, 409)
    if situation == "presente" and formation.get("horario"):
        try:
            start = datetime.fromisoformat(f"{formation_date}T{formation['horario']}:00").replace(tzinfo=CUIABA)
            if cuiaba_now() < start:
                return response({"erro": f"A presença será liberada às {formation['horario']}."}, 425)
        except ValueError:
            pass
    if situation not in {"presente", "justificada"}:
        return response({"erro": "Situação de presença inválida."}, 400)
    justification = str((body or {}).get("justificativa") or "").strip()
    if situation == "justificada" and len(justification) < 3:
        return response({"erro": "Informe o motivo da falta justificada."}, 400)
    if len(justification) > 500:
        return response({"erro": "A justificativa deve ter no máximo 500 caracteres."}, 400)
    mutate_main(lambda data: _save_presence_rows(data, formation_id, [{"usuario_id": user["id"], "status": situation, "justificativa": justification if situation == "justificada" else None}], str(user["id"])))
    latest = next((row for row in _user_presence_history(read_main(), str(user["id"])) if str(row.get("formacao_id")) == formation_id), None)
    payload = {"status": latest.get("status"), "justificativa": latest.get("justificativa"), "atualizado_em": latest.get("atualizado_em")} if latest else None
    return response({"ok": True, "presenca": payload}, headers={"Cache-Control": "private, no-store, max-age=0"})


@router.get("/api/formacoes/{formation_id}/presencas")
async def formation_presences(formation_id: str, request: Request):
    moderator = require_moderator(request)
    if not formation_id or len(formation_id) > 160:
        return response({"erro": "Formação inválida."}, 400)
    store = read_main()
    if not _find_formation(store, formation_id):
        return response({"erro": "Formação não encontrada."}, 404)
    by_user = {str(row.get("usuario_id")): row for row in _formation_presence(store, formation_id)}
    participants = []
    for user in approved_team(store):
        presence = by_user.get(str(user.get("id")))
        locked = user.get("tipo") == "moderador" and str(user.get("id")) != str(moderator["id"])
        participants.append({
            "id": user.get("id"), "nome": user.get("nome"), "funcao": user.get("funcao"), "tipo": user.get("tipo"),
            "editavel": not locked,
            "motivo_bloqueio": "Outro moderador registra a própria presença." if locked else None,
            "situacao": presence.get("status") if presence else "nao_registrado",
            "justificativa": presence.get("justificativa") if presence else "",
            "atualizado_em": presence.get("atualizado_em") if presence else None,
        })
    return response({"participantes": participants}, headers={"Cache-Control": "no-store, max-age=0"})


@router.put("/api/formacoes/{formation_id}/presencas")
async def update_presences(formation_id: str, request: Request):
    moderator = require_moderator(request)
    ip = request_ip(request.headers, request.client.host if request.client else None)
    if not rate_allowed(f"formacao:presencas:{moderator['id']}:{ip}", 40, 15 * 60):
        return response({"erro": "Muitas alterações em pouco tempo. Aguarde alguns minutos."}, 429)
    if not formation_id or len(formation_id) > 160:
        return response({"erro": "Formação inválida."}, 400)
    store = read_main()
    formation = _find_formation(store, formation_id)
    if not formation:
        return response({"erro": "Formação não encontrada."}, 404)
    if formation.get("status") == "cancelada":
        return response({"erro": "Não é possível alterar presença em uma formação cancelada."}, 409)
    try: body = await request.json()
    except Exception: body = None
    raw = body.get("presencas") if isinstance(body, dict) else None
    if not isinstance(raw, list):
        return response({"erro": "Envie a lista de presença da formação."}, 400)
    if len(raw) > 300:
        return response({"erro": "A lista de presença excede o limite permitido."}, 413)
    team = {str(user.get("id")): user for user in approved_team(store)}
    seen: set[str] = set()
    records = []
    for item in raw:
        if not isinstance(item, dict): return response({"erro": "A lista contém um usuário inválido ou duplicado."}, 400)
        user_id = str(item.get("usuarioId") or "").strip()
        if not user_id or len(user_id) > 160 or user_id in seen or user_id not in team:
            return response({"erro": "A lista contém um usuário inválido ou duplicado."}, 400)
        seen.add(user_id)
        target = team[user_id]
        if target.get("tipo") == "moderador" and user_id != str(moderator["id"]):
            return response({"erro": "Um moderador não pode alterar a presença de outro moderador."}, 403)
        situation = str(item.get("situacao") or "")
        if situation not in {"nao_registrado", "presente", "falta", "justificada"}:
            return response({"erro": "Situação de presença inválida."}, 400)
        justification = str(item.get("justificativa") or "").strip()
        if situation == "justificada" and len(justification) < 3:
            return response({"erro": f"Informe a justificativa da falta de {target.get('nome')}."}, 400)
        if len(justification) > 500:
            return response({"erro": "A justificativa deve ter no máximo 500 caracteres."}, 400)
        records.append({"usuario_id": user_id, "status": None if situation == "nao_registrado" else situation, "justificativa": justification if situation == "justificada" else None})
    mutate_main(lambda data: _save_presence_rows(data, formation_id, records, str(moderator["id"])))
    return response({"ok": True, "participantesAtualizados": len(records)})


@router.get("/api/formacoes/presencas/resumo")
async def presence_summary(request: Request):
    user = require_user(request)
    personal = request.query_params.get("escopo") == "me"
    if not personal and user.get("tipo") != "moderador":
        return response({"erro": "Acesso exclusivo do moderador."}, 403)
    store = read_main()
    full_team = approved_team(store)
    team = [member for member in full_team if str(member.get("id")) == str(user["id"])] if personal else full_team
    team_by_id = {str(member.get("id")): member for member in team}
    formations = _formations(store)
    formation_by_id = {str(item.get("id")): item for item in formations}
    entries = [row for row in store["formacao_presencas"] if isinstance(row, dict) and str(row.get("usuario_id")) in team_by_id and str(row.get("formacao_id")) in formation_by_id]
    admin_records = [row for row in store["registros"] if isinstance(row, dict) and str(row.get("usuario_id")) in team_by_id and (not personal or row.get("tipo") != "observacoes")]
    delays = [row for row in store["pontualidade_ocorrencias"] if isinstance(row, dict) and row.get("status") == "confirmado" and str(row.get("usuario_id")) in team_by_id]
    scale_justifications = [row for row in store["escala_justificativas"] if isinstance(row, dict) and str(row.get("usuario_id")) in team_by_id]
    scales = list_scales(store)

    def count(rows: list[dict[str, Any]]):
        return {"presencas": sum(r.get("status") == "presente" for r in rows), "faltas": sum(r.get("status") == "falta" for r in rows), "justificadas": sum(r.get("status") == "justificada" for r in rows), "total": len(rows)}

    people = []
    for member in team:
        uid = str(member.get("id"))
        frows = [row for row in entries if str(row.get("usuario_id")) == uid]
        base = count(frows)
        arows = [row for row in admin_records if str(row.get("usuario_id")) == uid]
        missing = base["faltas"] + sum(row.get("tipo") == "faltas" for row in arows)
        justified = base["justificadas"] + sum(row.get("tipo") == "justificativas" for row in arows) + sum(str(row.get("usuario_id")) == uid for row in scale_justifications)
        warnings = sum(row.get("tipo") == "advertencias" for row in arows)
        observations = sum(row.get("tipo") == "observacoes" for row in arows)
        user_delays = sum(str(row.get("usuario_id")) == uid for row in delays)
        total = base["presencas"] + missing + justified + warnings + user_delays + observations
        people.append({"id": member.get("id"), "nome": member.get("nome"), "funcao": member.get("funcao"), "tipo": member.get("tipo"), "presencas": base["presencas"], "faltas": missing, "justificadas": justified, "advertencias": warnings, "atrasos": user_delays, "total": total})
    people.sort(key=lambda item: str(item["nome"]).casefold())

    per_formation = []
    for formation in formations:
        rows = [row for row in entries if str(row.get("formacao_id")) == str(formation.get("id"))]
        per_formation.append({"id": formation.get("id"), "titulo": formation.get("titulo"), "tema": formation.get("tema"), "data": formation.get("data"), "horario": formation.get("horario"), "status": formation.get("status"), "naoRegistrados": max(0, len(team) - len(rows)), **count(rows)})

    recent = []
    for row in entries:
        member = team_by_id[str(row.get("usuario_id"))]; formation = formation_by_id[str(row.get("formacao_id"))]
        recent.append({"id": row.get("id"), "usuarioId": member.get("id"), "usuarioNome": member.get("nome"), "usuarioFuncao": member.get("funcao"), "usuarioTipo": member.get("tipo"), "formacaoId": formation.get("id"), "formacaoTitulo": formation.get("titulo"), "formacaoData": formation.get("data"), "formacaoHorario": formation.get("horario"), "status": row.get("status"), "justificativa": row.get("justificativa"), "atualizadoEm": row.get("atualizado_em")})
    labels = {"advertencias": ("Advertência", "advertencia"), "faltas": ("Falta administrativa", "falta"), "justificativas": ("Justificativa", "justificada"), "observacoes": ("Observação", "observacao")}
    for row in admin_records:
        member = team_by_id[str(row.get("usuario_id"))]; title, status_value = labels.get(str(row.get("tipo")), ("Observação", "observacao"))
        recent.append({"id": f"administrativo-{row.get('id')}", "usuarioId": member.get("id"), "usuarioNome": member.get("nome"), "usuarioFuncao": member.get("funcao"), "usuarioTipo": member.get("tipo"), "formacaoId": None, "formacaoTitulo": title, "formacaoData": row.get("data"), "formacaoHorario": None, "status": status_value, "justificativa": row.get("descricao"), "atualizadoEm": row.get("criado_em")})
    for row in delays:
        member = team_by_id.get(str(row.get("usuario_id")))
        if member:
            recent.append({"id": f"atraso-{row.get('id')}", "usuarioId": member.get("id"), "usuarioNome": member.get("nome"), "usuarioFuncao": member.get("funcao"), "usuarioTipo": member.get("tipo"), "formacaoId": None, "formacaoTitulo": f"Atraso · Missa às {row.get('horario_missa')}", "formacaoData": row.get("data_missa"), "formacaoHorario": row.get("horario_missa"), "status": "atraso", "justificativa": row.get("observacao") or f"Limite de chegada: {row.get('limite_chegada')}", "atualizadoEm": row.get("moderado_em") or row.get("criado_em")})
    for row in scale_justifications:
        member = team_by_id.get(str(row.get("usuario_id"))); scale = next((item for item in scales if str(item.get("id")) == str(row.get("escala_id"))), None)
        if member and scale:
            recent.append({"id": f"escala-justificada-{row.get('id')}", "usuarioId": member.get("id"), "usuarioNome": member.get("nome"), "usuarioFuncao": member.get("funcao"), "usuarioTipo": member.get("tipo"), "formacaoId": scale.get("id"), "formacaoTitulo": f"Falta justificada na missa · {scale.get('celebracao_liturgica') or 'Celebração litúrgica'}", "formacaoData": scale.get("data"), "formacaoHorario": scale.get("horario"), "status": "justificada", "justificativa": row.get("justificativa"), "atualizadoEm": row.get("criado_em")})
    recent.sort(key=lambda item: int(item.get("atualizadoEm") or 0), reverse=True)
    recent = recent[:500]

    base = count(entries)
    admin_missing = sum(row.get("tipo") == "faltas" for row in admin_records)
    admin_justified = sum(row.get("tipo") == "justificativas" for row in admin_records)
    warnings = sum(row.get("tipo") == "advertencias" for row in admin_records)
    observations = sum(row.get("tipo") == "observacoes" for row in admin_records)
    missing = base["faltas"] + admin_missing
    justified = base["justificadas"] + admin_justified + len(scale_justifications)
    total = base["presencas"] + missing + justified + warnings + len(delays) + observations
    summary = {"presencas": base["presencas"], "faltas": missing, "justificadas": justified, "advertencias": warnings, "atrasos": len(delays), "observacoes": observations, "total": total, "naoRegistrados": max(0, len(team) * sum(item.get("status") != "cancelada" for item in formations) - len(entries)), "participantes": len(team), "formacoes": len(formations)}
    return response({"escopo": "me" if personal else "equipe", "resumo": summary, "pessoas": people, "formacoes": per_formation, "recentes": recent}, headers={"Cache-Control": "no-store, max-age=0"})
