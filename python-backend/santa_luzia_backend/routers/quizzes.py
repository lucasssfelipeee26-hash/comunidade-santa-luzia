from __future__ import annotations

import secrets
from typing import Any

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from ..liturgy_service import local_liturgy, today_liturgy
from ..quiz_service import create_attempt, daily_quiz_id, ensure_offline_liturgy_quiz, generate_daily_questions, validate_attempt
from ..ranking_notifications import notify_ranking_changes, ranking_snapshot
from ..security import require_user
from ..store import approved_team, mutate_main, now_ms, read_main, save_notification
from ..utils import cuiaba_date_iso, rate_allowed, request_ip, valid_date_iso

router = APIRouter(tags=["quizzes"])


def response(body: dict[str, Any], status: int = 200, headers: dict[str, str] | None = None):
    return JSONResponse(body, status_code=status, headers=headers)


def _quiz(store: dict[str, Any], quiz_id: str):
    return next((row for row in store["quizzes"] if isinstance(row, dict) and str(row.get("id")) == quiz_id), None)


def _answer(store: dict[str, Any], quiz_id: str, user_id: str):
    return next((row for row in store["quiz_respostas"] if isinstance(row, dict) and str(row.get("quiz_id")) == quiz_id and str(row.get("usuario_id")) == user_id), None)


def _clean_questions(value: Any) -> list[dict[str, Any]]:
    if not isinstance(value, list):
        return []
    result = []
    for index, raw in enumerate(value[:30]):
        if not isinstance(raw, dict):
            raw = {}
        options = [str(item).strip()[:500] for item in raw.get("opcoes", [])[:3]] if isinstance(raw.get("opcoes"), list) else []
        try: correct = int(raw.get("correta"))
        except (TypeError, ValueError): correct = -1
        try: points = max(1, min(100, int(float(raw.get("pontos", 10)))))
        except (TypeError, ValueError, OverflowError): points = 10
        row = {
            "id": str(raw.get("id") or f"p-{index + 1}").strip()[:120],
            "enunciado": str(raw.get("enunciado") or "").strip()[:800],
            "opcoes": options,
            "correta": correct if 0 <= correct < 3 else -1,
            "pontos": points,
        }
        explanation = str(raw.get("explicacao") or "").strip()[:1000]
        if explanation: row["explicacao"] = explanation
        if row["id"] and len(row["enunciado"]) >= 3 and len(options) == 3 and all(options) and row["correta"] >= 0:
            result.append(row)
    return result


def _notify_standalone(quiz: dict[str, Any]):
    if quiz.get("origem") == "liturgia":
        return
    for user in approved_team(read_main()):
        save_notification(str(user["id"]), f"quiz-avulso:{quiz['id']}", "avulso", "Novo quiz avulso disponível", f"{quiz.get('titulo')}{' · ' + str(quiz.get('descricao')) if quiz.get('descricao') else ''}", "/area-restrita/ranking?aba=avulsos")


def _save_answer(quiz: dict[str, Any], user_id: str, answers: list[int]):
    hits = points = total = 0
    details = []
    for index, question in enumerate(quiz["perguntas"]):
        correct = answers[index] == int(question["correta"])
        value = int(question.get("pontos") or 0)
        total += value
        if correct:
            hits += 1; points += value
        details.append({"perguntaId": question.get("id"), "correto": correct, "correta": question.get("correta"), "explicacao": question.get("explicacao") or None})
    def save(store: dict[str, Any]):
        existing = _answer(store, str(quiz["id"]), user_id)
        if existing: return existing, True
        row = {"id": f"qresp-{now_ms()}-{secrets.token_hex(3)}", "quiz_id": quiz["id"], "usuario_id": user_id, "respostas": answers, "acertos": hits, "pontos": points, "total_pontos": total, "respondido_em": now_ms()}
        store["quiz_respostas"].append(row); return row, False
    result, duplicate = mutate_main(save)
    return result, details, duplicate


@router.get("/api/quizzes")
async def list_quizzes(request: Request):
    user = require_user(request)
    today = cuiaba_date_iso()
    liturgy_today = local_liturgy(today)
    if liturgy_today:
        ensure_offline_liturgy_quiz(today)
    store = read_main()
    admin = request.query_params.get("admin") == "1" and user.get("tipo") == "moderador"
    quizzes = [row for row in store["quizzes"] if isinstance(row, dict) and (admin or row.get("ativo"))]
    quizzes = [row for row in quizzes if row.get("origem") != "liturgia" or (row.get("data_referencia") and local_liturgy(str(row.get("data_referencia"))))]
    if not admin:
        quizzes = [row for row in quizzes if row.get("origem") != "liturgia" or row.get("data_referencia") == today]
    quizzes.sort(key=lambda row: int(row.get("criado_em") or 0), reverse=True)
    if admin:
        return response({"quizzes": quizzes, "liturgiaOfflineHoje": bool(liturgy_today), "dataLiturgia": today if liturgy_today else None}, headers={"Cache-Control": "no-store"})
    public = []
    for quiz in quizzes:
        public.append({
            "id": quiz.get("id"), "titulo": quiz.get("titulo"), "descricao": quiz.get("descricao"), "origem": quiz.get("origem"),
            "data_referencia": quiz.get("data_referencia"), "ativo": quiz.get("ativo"),
            "respondido": bool(_answer(store, str(quiz.get("id")), str(user["id"]))),
            "perguntas": [{"id": q.get("id"), "enunciado": q.get("enunciado"), "opcoes": q.get("opcoes"), "pontos": q.get("pontos")} for q in quiz.get("perguntas") or [] if isinstance(q, dict)],
        })
    return response({"quizzes": public, "liturgiaOfflineHoje": bool(liturgy_today), "dataLiturgia": today if liturgy_today else None}, headers={"Cache-Control": "no-store"})


@router.post("/api/quizzes")
async def manage_quiz(request: Request):
    user = require_user(request)
    if user.get("tipo") != "moderador": return response({"erro": "Apenas moderadores."}, 403)
    ip = request_ip(request.headers, request.client.host if request.client else None)
    if not rate_allowed(f"quiz:admin:{user['id']}:{ip}", 60, 60 * 60):
        return response({"erro": "Muitas alterações de quiz em pouco tempo. Aguarde antes de tentar novamente."}, 429)
    try: body = await request.json()
    except Exception: body = {}
    if not isinstance(body, dict): body = {}
    action = str(body.get("action") or "salvar")
    if action not in {"salvar", "excluir"}: return response({"erro": "Ação inválida."}, 400)
    if action == "excluir":
        quiz_id = str(body.get("id") or "").strip()
        if not quiz_id or len(quiz_id) > 180: return response({"erro": "Quiz inválido."}, 400)
        def delete(store: dict[str, Any]):
            before = len(store["quizzes"]); store["quizzes"] = [q for q in store["quizzes"] if str(q.get("id")) != quiz_id]
            store["quiz_respostas"] = [a for a in store["quiz_respostas"] if str(a.get("quiz_id")) != quiz_id]
            return before != len(store["quizzes"])
        return response({"ok": True}) if mutate_main(delete) else response({"erro": "Quiz não encontrado."}, 404)
    origin = str(body.get("origem") or "manual")
    if origin not in {"formacao", "liturgia", "manual"}: return response({"erro": "Origem inválida."}, 400)
    reference_date = str(body.get("data_referencia")).strip() if body.get("data_referencia") else None
    if reference_date and not valid_date_iso(reference_date): return response({"erro": "Data de referência inválida."}, 400)
    if origin == "liturgia" and (not reference_date or not local_liturgy(reference_date)):
        return response({"erro": "Não é permitido publicar Quiz Litúrgico sem a Liturgia offline da mesma data."}, 400)
    questions = _clean_questions(body.get("perguntas"))
    title = str(body.get("titulo") or "").strip()
    if not 3 <= len(title) <= 180 or not questions:
        return response({"erro": "Informe um título válido e pelo menos uma pergunta completa com alternativas A/B/C."}, 400)
    received_reference = str(body.get("referencia_id") or "").strip()
    if len(received_reference) > 300: return response({"erro": "Referência do quiz muito longa."}, 400)
    data = {"titulo": title, "descricao": str(body.get("descricao") or "").strip()[:1200], "origem": origin, "referencia_id": f"liturgia-offline:{reference_date}" if origin == "liturgia" else (received_reference or None), "data_referencia": reference_date, "ativo": body.get("ativo") is not False, "perguntas": questions}
    quiz_id = str(body.get("id") or "").strip()
    if len(quiz_id) > 180: return response({"erro": "Identificador de quiz inválido."}, 400)
    if quiz_id:
        store = read_main(); existing = _quiz(store, quiz_id)
        if existing:
            was_active = bool(existing.get("ativo"))
            def update(store_data: dict[str, Any]):
                row = _quiz(store_data, quiz_id); row.update(data); row["atualizado_em"] = now_ms(); return dict(row)
            quiz = mutate_main(update)
            if quiz.get("ativo") and not was_active: _notify_standalone(quiz)
            return response({"ok": True, "quiz": quiz})
    def create(store: dict[str, Any]):
        current = now_ms(); row = {**data, "id": f"quiz-{current}-{secrets.token_hex(3)}", "criado_por": user["id"], "criado_em": current, "atualizado_em": current}; store["quizzes"].append(row); return row
    quiz = mutate_main(create)
    if quiz.get("ativo"): _notify_standalone(quiz)
    return response({"ok": True, "quiz": quiz})


@router.post("/api/quizzes/{quiz_id}/responder")
async def answer_quiz(quiz_id: str, request: Request):
    user = require_user(request)
    ip = request_ip(request.headers, request.client.host if request.client else None)
    if not rate_allowed(f"quiz:responder:{user['id']}:{ip}", 30, 60 * 60):
        return response({"erro": "Muitas tentativas de quiz em pouco tempo. Aguarde antes de tentar novamente."}, 429)
    if not quiz_id or len(quiz_id) > 180: return response({"erro": "Quiz inválido."}, 400)
    store = read_main(); quiz = _quiz(store, quiz_id)
    if not quiz or not quiz.get("ativo"): return response({"erro": "Quiz não encontrado."}, 404)
    if quiz.get("origem") == "liturgia":
        today = cuiaba_date_iso()
        if not quiz.get("data_referencia") or quiz.get("data_referencia") != today or not local_liturgy(str(quiz.get("data_referencia"))):
            return response({"erro": "Este Quiz Litúrgico não está alinhado com a Liturgia offline disponível hoje."}, 409)
    existing = _answer(store, quiz_id, str(user["id"]))
    if existing: return response({"ok": True, "duplicado": True, "resultado": existing, "mensagem": "Quiz já sincronizado."})
    try: body = await request.json()
    except Exception: body = {}
    raw_answers = body.get("respostas") if isinstance(body, dict) else None
    try: answers = [int(value) for value in raw_answers] if isinstance(raw_answers, list) else []
    except (TypeError, ValueError): answers = []
    questions = quiz.get("perguntas") if isinstance(quiz.get("perguntas"), list) else []
    if not 1 <= len(questions) <= 50 or len(answers) != len(questions) or any(value < 0 or value >= len(questions[index].get("opcoes") or []) for index, value in enumerate(answers)):
        return response({"erro": "Responda todas as perguntas com opções válidas."}, 400)
    year = int(cuiaba_date_iso()[:4]); before = ranking_snapshot(year, store)
    result, details, duplicate = _save_answer(quiz, str(user["id"]), answers)
    if not duplicate: notify_ranking_changes(year, before, str(user["id"]), f"quiz:{quiz_id}")
    client_request_id = str(body.get("clientRequestId") or "") if isinstance(body, dict) else ""
    return response({"ok": True, "resultado": result, "detalhes": details, "clientRequestId": client_request_id or None})


@router.get("/api/quizzes/liturgia")
async def dynamic_liturgy_quiz(request: Request):
    user = require_user(request)
    attempt = create_attempt(str(user["id"]))
    quiz_id = daily_quiz_id(attempt["data"])
    existing = _answer(read_main(), quiz_id, str(user["id"]))
    if existing:
        return response({"respondido": True, "resultado": existing, "data": attempt["data"]}, headers={"Cache-Control": "no-store"})
    liturgy = local_liturgy(attempt["data"])
    if not liturgy: return response({"erro": "A Liturgia de hoje ainda não pôde ser carregada para gerar o quiz."}, 503)
    questions = generate_daily_questions(liturgy, attempt["nonce"])
    if len(questions) < 3: return response({"erro": "Ainda não há informações suficientes na Liturgia de hoje para montar o quiz."}, 503)
    return response({"respondido": False, "quiz": {"token": attempt["token"], "titulo": "Quiz da Liturgia de Hoje", "descricao": "Perguntas geradas automaticamente a partir da mesma Liturgia Diária apresentada no aplicativo.", "expiraEm": attempt["expiraEm"], "duracaoSegundos": attempt["duracaoSegundos"], "perguntas": [{"id": q["id"], "enunciado": q["enunciado"], "opcoes": q["opcoes"], "pontos": q["pontos"]} for q in questions]}}, headers={"Cache-Control": "no-store"})


@router.post("/api/quizzes/liturgia/responder")
async def answer_dynamic_liturgy_quiz(request: Request):
    user = require_user(request)
    ip = request_ip(request.headers, request.client.host if request.client else None)
    if not rate_allowed(f"quiz:liturgia:{user['id']}:{ip}", 20, 60 * 60):
        return response({"erro": "Muitas tentativas em pouco tempo. Aguarde antes de tentar novamente."}, 429)
    try: body = await request.json()
    except Exception: body = {}
    token = str(body.get("token") or "") if isinstance(body, dict) else ""
    if not token or len(token) > 4096: return response({"erro": "Tentativa de quiz inválida."}, 400)
    try: attempt = validate_attempt(token, str(user["id"]))
    except ValueError as error: return response({"erro": str(error)}, 410)
    quiz_id = daily_quiz_id(attempt["data"])
    existing = _answer(read_main(), quiz_id, str(user["id"]))
    if existing: return response({"erro": "O quiz de hoje já foi concluído.", "resultado": existing}, 409)
    liturgy = local_liturgy(attempt["data"])
    if not liturgy: return response({"erro": "Não foi possível validar a Liturgia agora."}, 503)
    questions = generate_daily_questions(liturgy, attempt["nonce"])
    raw = body.get("respostas") if isinstance(body, dict) else None
    try: answers = [int(value) for value in raw] if isinstance(raw, list) else []
    except (TypeError, ValueError): answers = []
    if not 3 <= len(questions) <= 10 or len(answers) != len(questions) or any(value < 0 or value >= len(questions[index]["opcoes"]) for index, value in enumerate(answers)):
        return response({"erro": "Responda todas as perguntas antes de enviar."}, 400)
    pseudo_quiz = {"id": quiz_id, "perguntas": questions}
    result, details, _ = _save_answer(pseudo_quiz, str(user["id"]), answers)
    return response({"ok": True, "resultado": result, "detalhes": [{k: v for k, v in detail.items() if k != "explicacao"} for detail in details]})


@router.post("/api/quizzes/liturgia/offline")
async def answer_offline_liturgy_quiz(request: Request):
    user = require_user(request)
    if user.get("status") != "aprovado" or user.get("funcao") not in {"Acólito", "Coroinha"}:
        return response({"erro": "Quiz disponível apenas para perfis autorizados."}, 403)
    try: body = await request.json()
    except Exception: body = {}
    date_iso = str(body.get("dataIso") or "") if isinstance(body, dict) else ""
    if not valid_date_iso(date_iso): return response({"erro": "Data do quiz inválida."}, 400)
    quiz = ensure_offline_liturgy_quiz(date_iso)
    if not quiz: return response({"erro": "A Liturgia dessa data não está disponível para validar o quiz."}, 404)
    existing = _answer(read_main(), str(quiz["id"]), str(user["id"]))
    if existing: return response({"ok": True, "duplicado": True, "resultado": existing, "mensagem": "Quiz já sincronizado."})
    raw = body.get("respostas") if isinstance(body, dict) else None
    try: answers = [int(value) for value in raw] if isinstance(raw, list) else []
    except (TypeError, ValueError): answers = []
    questions = quiz["perguntas"]
    if len(answers) != len(questions) or any(value < 0 or value >= len(questions[index]["opcoes"]) for index, value in enumerate(answers)):
        return response({"erro": "Respostas do quiz offline estão incompletas ou inválidas."}, 400)
    result, details, _ = _save_answer(quiz, str(user["id"]), answers)
    return response({"ok": True, "resultado": result, "detalhes": [{k: v for k, v in detail.items() if k != "explicacao"} for detail in details], "mensagem": "Quiz offline sincronizado com a Jornada."})
