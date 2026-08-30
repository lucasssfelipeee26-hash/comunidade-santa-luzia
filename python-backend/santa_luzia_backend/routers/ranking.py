from __future__ import annotations

import math
import re
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..ranking_service import calculate_ranking
from ..security import require_user
from ..store import approved_team, find_user, list_scales, mutate_main, now_ms, ranking_config, read_main
from ..utils import cuiaba_now, integer_number, operational_year, rate_allowed, request_ip, subtract_minutes, valid_date_iso, valid_time_24h

router = APIRouter(tags=["ranking"])
CATEGORIES = {"companheirismo", "acolhimento", "espirito_servico", "disponibilidade"}
EMOJIS = {"⏰", "😅", "🙏", "✝️", "💛"}


def response(body: dict[str, Any], status: int = 200):
    return JSONResponse(body, status_code=status)


def _approved_member(store: dict[str, Any], user_id: str):
    user = find_user(user_id, store)
    return user if user and user.get("status") == "aprovado" and user.get("funcao") in {"Acólito", "Coroinha"} else None


def _ip(request: Request) -> str:
    return request_ip(request.headers, request.client.host if request.client else None)


@router.get("/api/ranking")
async def get_ranking(request: Request):
    user = require_user(request)
    parsed = operational_year(request.query_params.get("ano"))
    year = parsed or cuiaba_now().year
    store = read_main()
    calculated = calculate_ranking(year, store)
    members = [{"id": m.get("id"), "nome": m.get("nome"), "funcao": m.get("funcao"), "foto": m.get("foto") or None} for m in approved_team(store)]
    occurrences_all = [row for row in store["pontualidade_ocorrencias"] if isinstance(row, dict)]
    visible = [
        row for row in occurrences_all
        if user.get("tipo") == "moderador" or str(row.get("usuario_id")) == str(user["id"]) or str(row.get("reportado_por")) == str(user["id"])
    ]
    visible_ids = {str(row.get("id")) for row in visible}
    occurrences = []
    for row in visible:
        target = find_user(str(row.get("usuario_id")), store)
        reporter = find_user(str(row.get("reportado_por")), store) if row.get("reportado_por") else None
        occurrences.append({
            "id": row.get("id"), "usuario_id": row.get("usuario_id"), "usuario_nome": target.get("nome") if target else "Membro",
            "escala_id": row.get("escala_id"), "data_missa": row.get("data_missa"), "horario_missa": row.get("horario_missa"),
            "limite_chegada": row.get("limite_chegada"), "observacao": row.get("observacao"), "status": row.get("status"),
            "criado_em": row.get("criado_em"), "reportado_por": row.get("reportado_por"),
            "reportado_por_nome": reporter.get("nome") if reporter else None,
        })
    reactions = [
        {"ocorrencia_id": row.get("ocorrencia_id"), "emoji": row.get("emoji")}
        for row in store["pontualidade_reacoes"]
        if isinstance(row, dict) and str(row.get("ocorrencia_id")) in visible_ids
    ]
    return response({
        "ano": year,
        "eu": {"id": user.get("id"), "nome": user.get("nome"), "tipo": user.get("tipo")},
        "config": calculated["config"], "ranking": calculated["ranking"], "membros": members,
        "ocorrencias": occurrences, "reacoes": reactions,
    })


@router.post("/api/ranking")
async def ranking_action(request: Request):
    user = require_user(request)
    try:
        body = await request.json()
    except Exception:
        body = {}
    if not isinstance(body, dict):
        body = {}
    action = str(body.get("action") or "")
    store = read_main()

    if action == "reconhecer":
        if not rate_allowed(f"ranking:reconhecer:{user['id']}:{_ip(request)}", 30, 60 * 60):
            return response({"erro": "Muitas tentativas de reconhecimento. Tente novamente mais tarde."}, 429)
        target_id = str(body.get("paraId") or "")
        category = str(body.get("categoria") or "")
        if category not in CATEGORIES:
            return response({"erro": "Categoria inválida."}, 400)
        if target_id == str(user["id"]):
            return response({"erro": "Você não pode reconhecer o próprio perfil."}, 400)
        if not _approved_member(store, target_id):
            return response({"erro": "Perfil inválido."}, 404)
        now = cuiaba_now()
        if any(
            isinstance(row, dict) and str(row.get("de_usuario_id")) == str(user["id"])
            and row.get("categoria") == category and int(row.get("ano") or 0) == now.year and int(row.get("mes") or 0) == now.month
            for row in store["reconhecimentos"]
        ):
            return response({"erro": "Você já usou este reconhecimento neste mês. Cada categoria pode ser concedida uma vez por mês."}, 409)
        def save(data: dict[str, Any]):
            row = {"id": f"rec-{now_ms()}", "de_usuario_id": user["id"], "para_usuario_id": target_id, "categoria": category, "ano": now.year, "mes": now.month, "criado_em": now_ms()}
            data["reconhecimentos"].append(row); return row
        return response({"ok": True, "reconhecimento": mutate_main(save)})

    if action == "reportar_atraso":
        if not rate_allowed(f"ranking:atraso:{user['id']}:{_ip(request)}", 20, 60 * 60):
            return response({"erro": "Muitos relatos enviados em pouco tempo. Aguarde antes de tentar novamente."}, 429)
        target_id = str(body.get("usuarioId") or "")
        scale_id = str(body.get("escalaId")) if body.get("escalaId") else None
        request_id = str(body.get("clientRequestId") or "").strip()
        if target_id == str(user["id"]):
            return response({"erro": "O atraso deve ser reportado por um colega."}, 400)
        if request_id and not re.fullmatch(r"[a-zA-Z0-9._:-]{8,100}", request_id):
            return response({"erro": "Identificador do relato inválido."}, 400)
        if request_id:
            existing = next((row for row in store["pontualidade_ocorrencias"] if isinstance(row, dict) and row.get("client_request_id") == request_id and str(row.get("reportado_por")) == str(user["id"])), None)
            if existing:
                return response({"ok": True, "ocorrencia": existing, "duplicado": True, "mensagem": "Relato já sincronizado."})
        if not _approved_member(store, target_id):
            return response({"erro": "Perfil inválido."}, 404)
        scale = next((item for item in list_scales(store) if str(item.get("id")) == str(scale_id)), None) if scale_id else None
        if scale_id and not scale:
            return response({"erro": "Escala não encontrada."}, 404)
        if scale and not any(str(person.get("id")) == target_id for person in scale.get("pessoas") or [] if isinstance(person, dict)):
            return response({"erro": "Este perfil não está incluído na escala informada."}, 409)
        mass_date = str(scale.get("data")) if scale else str(body.get("dataMissa") or "")
        mass_time = str(scale.get("horario")) if scale else str(body.get("horarioMissa") or "18:00")
        if not valid_date_iso(mass_date) or not valid_time_24h(mass_time):
            return response({"erro": "Data ou horário inválido."}, 400)
        if any(isinstance(row, dict) and str(row.get("usuario_id")) == target_id and row.get("data_missa") == mass_date and row.get("status") != "rejeitado" for row in store["pontualidade_ocorrencias"]):
            return response({"erro": "Já existe um relato de pontualidade para este perfil nesta data."}, 409)
        config = ranking_config(int(mass_date[:4]), store)
        def save(data: dict[str, Any]):
            row = {
                "id": f"atraso-{now_ms()}", "client_request_id": request_id or None, "usuario_id": target_id,
                "escala_id": scale_id, "data_missa": mass_date, "horario_missa": mass_time,
                "limite_chegada": subtract_minutes(mass_time, int(config["minutos_antecedencia"])),
                "observacao": str(body.get("observacao") or "").strip()[:300], "reportado_por": user["id"],
                "status": "pendente", "criado_em": now_ms(), "moderado_por": None, "moderado_em": None,
            }
            data["pontualidade_ocorrencias"].append(row); return row
        row = mutate_main(save)
        return response({"ok": True, "ocorrencia": row, "mensagem": "Relato enviado ao moderador para confirmação."})

    if action == "reagir":
        if not rate_allowed(f"ranking:reagir:{user['id']}:{_ip(request)}", 90, 60 * 60):
            return response({"erro": "Muitas reações em pouco tempo. Aguarde antes de tentar novamente."}, 429)
        occurrence_id = str(body.get("ocorrenciaId") or "")
        emoji = str(body.get("emoji") or "")
        if emoji not in EMOJIS:
            return response({"erro": "Reação inválida."}, 400)
        occurrence = next((row for row in store["pontualidade_ocorrencias"] if isinstance(row, dict) and str(row.get("id")) == occurrence_id), None)
        if not occurrence or occurrence.get("status") != "confirmado":
            return response({"erro": "Ocorrência não disponível para reações."}, 404)
        allowed = user.get("tipo") == "moderador" or str(occurrence.get("usuario_id")) == str(user["id"]) or str(occurrence.get("reportado_por")) == str(user["id"])
        if not allowed:
            return response({"erro": "Ocorrência não disponível para este perfil."}, 403)
        def save(data: dict[str, Any]):
            existing = next((row for row in data["pontualidade_reacoes"] if isinstance(row, dict) and str(row.get("ocorrencia_id")) == occurrence_id and str(row.get("usuario_id")) == str(user["id"])), None)
            if existing:
                existing["emoji"] = emoji; existing["criado_em"] = now_ms(); return dict(existing)
            row = {"id": f"reacao-{now_ms()}", "ocorrencia_id": occurrence_id, "usuario_id": user["id"], "emoji": emoji, "criado_em": now_ms()}
            data["pontualidade_reacoes"].append(row); return row
        return response({"ok": True, "reacao": mutate_main(save)})

    if action == "moderar_atraso":
        if user.get("tipo") != "moderador":
            return response({"erro": "Apenas moderadores."}, 403)
        occurrence_id = str(body.get("ocorrenciaId") or "")
        status_value = str(body.get("status") or "")
        if status_value not in {"confirmado", "rejeitado"}:
            return response({"erro": "Status inválido."}, 400)
        def moderate(data: dict[str, Any]):
            row = next((item for item in data["pontualidade_ocorrencias"] if isinstance(item, dict) and str(item.get("id")) == occurrence_id), None)
            if not row: return None
            row["status"] = status_value; row["moderado_por"] = user["id"]; row["moderado_em"] = now_ms(); return dict(row)
        row = mutate_main(moderate)
        if not row: return response({"erro": "Ocorrência não encontrada."}, 404)
        return response({"ok": True, "ocorrencia": row})

    if action == "ajustar_pontos":
        if user.get("tipo") != "moderador": return response({"erro": "Apenas moderadores."}, 403)
        target_id = str(body.get("usuarioId") or "")
        points = integer_number(body.get("pontos"))
        reason = str(body.get("motivo") or "").strip()
        year = operational_year(body.get("ano"))
        if not _approved_member(store, target_id) or points is None or points < -100 or points > 100 or not 3 <= len(reason) <= 300 or year is None:
            return response({"erro": "Dados inválidos para o ajuste."}, 400)
        def save(data: dict[str, Any]):
            row = {"id": f"ajuste-{now_ms()}", "usuario_id": target_id, "pontos": points, "motivo": reason, "ano": year, "criado_por": user["id"], "criado_em": now_ms()}
            data["ranking_ajustes"].append(row); return row
        return response({"ok": True, "ajuste": mutate_main(save)})

    if action == "salvar_config":
        if user.get("tipo") != "moderador": return response({"erro": "Apenas moderadores."}, 403)
        year = operational_year(body.get("ano"))
        try:
            weights = [float(body.get(key)) for key in ("peso_formacao", "peso_liturgia", "peso_pontualidade", "peso_reconhecimento")]
        except (TypeError, ValueError, OverflowError):
            return response({"erro": "Os pesos devem totalizar 100 e a antecedência deve ficar entre 10 e 120 minutos."}, 400)
        minutes = integer_number(body.get("minutos_antecedencia"))
        total = sum(weights)
        rounded_total = math.floor(total + 0.5) if math.isfinite(total) else -1
        if year is None or minutes is None or any(not math.isfinite(weight) or weight < 0 or weight > 100 for weight in weights) or rounded_total != 100 or minutes < 10 or minutes > 120:
            return response({"erro": "Os pesos devem totalizar 100 e a antecedência deve ficar entre 10 e 120 minutos."}, 400)
        def save(data: dict[str, Any]):
            row = {"ano": year, "peso_formacao": weights[0], "peso_liturgia": weights[1], "peso_pontualidade": weights[2], "peso_reconhecimento": weights[3], "minutos_antecedencia": minutes, "atualizado_em": now_ms()}
            index = next((i for i, item in enumerate(data["ranking_configs"]) if isinstance(item, dict) and int(item.get("ano") or 0) == year), None)
            if index is None: data["ranking_configs"].append(row)
            else: data["ranking_configs"][index] = row
            return row
        return response({"ok": True, "config": mutate_main(save)})

    return response({"erro": "Ação desconhecida."}, 400)
